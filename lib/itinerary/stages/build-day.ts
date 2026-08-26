import 'server-only';
import type { TripRequestParsed } from '@/domain/schemas/trip-request';
import { centroid, haversineMeters, type LatLng } from '@/domain/types/geo';
import { rankCandidates } from '@/domain/ranking/rank';
import { PACE_PROFILES, nextOpenMinute } from '@/domain/sequencing/schedule';
import { sequenceDay, type SequenceNode } from '@/domain/sequencing/sequence';
import { admissionCostUsd, mealCostUsd, type CostInputs } from '@/domain/cost/model';
import { isMealTag, type ExperienceTag } from '@/domain/types/taxonomy';
import { SEARCH_SPEC } from '@/lib/google/places/taxonomy';
import type { LlmClient } from '@/lib/ai/client';
import {
  assignPlacesJsonSchema,
  assignPlacesWire,
  assignmentsFromWire,
} from '@/lib/ai/wire/assign-places';
import type { PlannedDay } from '@/lib/ai/wire/plan-shape';
import {
  ASSIGN_PLACES_SYSTEM,
  buildAssignPlacesInput,
  type CandidateLine,
} from '@/lib/ai/prompts/assign-places';
import type { Candidate } from '../candidates';
import type { ResolvedDestination } from '../destination';
import type { DraftActivity, DraftDay } from '../draft';
import type { PipelineContext } from '../context';
import { dateFor, primaryMode, weekdayFor } from '../trip-time';

/**
 * Stage 4: choose real places for one day's planned slots.
 *
 * The only stage where the model has any say over what ends up in the trip, and
 * its authority is deliberately narrow — it picks an id from a shortlist the
 * server assembled. Ranking happens before it and sequencing after it, both in
 * plain code, so a bad model day is a slightly worse choice from a good list,
 * never an invented restaurant or a day that crosses the city four times.
 *
 * Extracted from pipeline.ts, where it was a 167-line function inside a
 * 643-line orchestrator.
 */

export interface BuildDayArgs {
  llm: LlmClient;
  context: PipelineContext;
  plannedDay: PlannedDay;
  destination: ResolvedDestination;
  candidatesByTag: ReadonlyMap<ExperienceTag, readonly Candidate[]>;
  chosen: ReadonlySet<string>;
  chosenNames: readonly string[];
  costInputs: CostInputs;
}

/**
 * Rank candidates for each slot, ask the model to choose, then sequence and
 * schedule the result. The model's only authority is picking an ID from the
 * shortlist we hand it.
 */
export async function buildDay(args: BuildDayArgs): Promise<DraftDay> {
  const { plannedDay, candidatesByTag, chosen, context } = args;
  const request = context.request;

  // A day's centre of gravity, seeded from whatever we already picked for it.
  let dayCentre: LatLng | null = args.destination.location;

  const candidatesBySlot = new Map<string, readonly CandidateLine[]>();
  const allowedBySlot = new Map<string, ReadonlySet<string>>();
  const candidateIndex = new Map<string, Candidate>();
  const weekday = weekdayFor(request, plannedDay.dayIndex, args.destination.timezone);

  for (const slot of plannedDay.slots) {
    const pool = candidatesByTag.get(slot.tag) ?? [];
    const spec = SEARCH_SPEC[slot.tag];

    const ranked = rankCandidates(
      pool.map((c) => ({
        id: c.placeId,
        location: c.location,
        rating: c.hydration.rating,
        userRatingCount: c.hydration.userRatingCount,
        priceLevel: c.hydration.priceLevel,
        tags: c.tags,
        hasEditorialSummary: c.hydration.editorialSummary !== null,
        ourSignal: 0,
      })),
      {
        tag: slot.tag,
        dayCentre,
        style: request.travelStyle,
        minReviews: spec.minReviews,
        excludedIds: chosen,
      },
      6,
    );

    const lines: CandidateLine[] = [];
    const allowed = new Set<string>();

    for (const scored of ranked) {
      const candidate = pool.find((c) => c.placeId === scored.id);
      if (!candidate) continue;
      candidateIndex.set(candidate.placeId, candidate);
      allowed.add(candidate.placeId);
      lines.push({
        id: candidate.placeId,
        name: candidate.hydration.displayName,
        rating: candidate.hydration.rating,
        reviews: candidate.hydration.userRatingCount,
        priceLevel: candidate.hydration.priceLevel,
        summary: candidate.hydration.editorialSummary,
        distanceFromDayCentre: dayCentre
          ? Math.round(haversineMeters(candidate.location, dayCentre))
          : null,
        openWhenNeeded:
          weekday === null ||
          nextOpenMinute(
            candidate.hydration.openingHours,
            weekday,
            slot.targetMinute,
            slot.durationMinutes,
          ) !== null,
      });
    }

    candidatesBySlot.set(slot.slotId, lines);
    allowedBySlot.set(slot.slotId, allowed);
  }

  const { value } = await args.llm.generateStructured({
    schema: assignPlacesJsonSchema,
    schemaName: 'assign_places',
    parse: (raw) => assignmentsFromWire(assignPlacesWire.parse(raw), allowedBySlot),
    system: ASSIGN_PLACES_SYSTEM,
    input: buildAssignPlacesInput({
      request,
      day: plannedDay,
      destinationName: args.destination.name,
      candidatesBySlot,
      alreadyChosenNames: args.chosenNames.slice(-24),
    }),
    tier: 'strong',
    stage: 'assign_places',
    maxOutputTokens: 6000,
  });

  if (value.rejected.length > 0) {
    // Should be impossible — the schema plus the candidate-set check make it a
    // structural impossibility rather than a prompt request. Loud on purpose.
    console.warn('[pipeline] model returned ids outside the candidate set', value.rejected);
  }

  // Assemble activities in the model's chosen order, then let the sequencer fix
  // the geography.
  const slotById = new Map(plannedDay.slots.map((s) => [s.slotId, s]));
  const picked = value.assignments.flatMap((assignment) => {
    const slot = slotById.get(assignment.slotId);
    const candidate = candidateIndex.get(assignment.placeId);
    if (!slot || !candidate) return [];
    return [{ slot, candidate, assignment }];
  });

  if (picked.length > 0) {
    dayCentre = centroid(picked.map((p) => p.candidate.location));
  }

  const nodes: SequenceNode[] = picked.map((p) => ({
    id: p.slot.slotId,
    location: p.candidate.location,
    durationMinutes: p.slot.durationMinutes,
    // Meals are pinned to their position so the sequencer cannot move dinner to
    // 11am in pursuit of a shorter walk.
    ...(isMealTag(p.slot.tag) ? { pinnedIndex: plannedDay.slots.indexOf(p.slot) } : {}),
  }));

  const sequenced = sequenceDay(nodes, {
    anchor: args.destination.location,
    mode: primaryMode(request),
    dayStartMinute: PACE_PROFILES[request.pace].dayStart,
  });

  const ordered = sequenced.order.flatMap((slotId) => {
    const entry = picked.find((p) => p.slot.slotId === slotId);
    return entry ? [entry] : [];
  });

  const activities: DraftActivity[] = ordered.map((entry, index) => {
    const isMeal = isMealTag(entry.slot.tag);
    const cost = isMeal
      ? mealCostUsd(entry.slot.tag, entry.candidate.hydration.priceLevel, args.costInputs)
      : admissionCostUsd(entry.slot.tag, args.costInputs);

    return {
      slotId: entry.slot.slotId,
      orderIndex: index + 1,
      kind: isMeal ? 'meal' : 'activity',
      tag: entry.slot.tag,
      placeId: entry.candidate.placeId,
      googlePlaceId: entry.candidate.googlePlaceId,
      location: entry.candidate.location,
      openingHours: entry.candidate.hydration.openingHours,
      title: entry.candidate.hydration.displayName,
      description: entry.assignment.description,
      reason: entry.assignment.reason,
      durationMinutes: entry.slot.durationMinutes,
      targetMinute: entry.slot.targetMinute,
      startMinute: null,
      endMinute: null,
      estimatedCostUsd: cost,
      inboundTravel: null,
      bookingUrl: null,
      websiteUri: entry.candidate.hydration.websiteUri,
    };
  });

  return {
    dayIndex: plannedDay.dayIndex,
    date: dateFor(request, plannedDay.dayIndex),
    title: plannedDay.theme,
    summary: plannedDay.narrative,
    destinationId: args.destination.id,
    activities,
    unfilledSlots: value.unfilled,
  };
}
