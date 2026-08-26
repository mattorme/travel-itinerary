import 'server-only';
import type { TripRequestParsed } from '@/domain/schemas/trip-request';
import type { ExperienceTag } from '@/domain/types/taxonomy';
import { centroid, type LatLng } from '@/domain/types/geo';
import { rankCandidates } from '@/domain/ranking/rank';
import { PACE_PROFILES, nextOpenMinute, scheduleDay } from '@/domain/sequencing/schedule';
import { sequenceDay, type SequenceNode } from '@/domain/sequencing/sequence';
import { admissionCostUsd, mealCostUsd, type CostInputs } from '@/domain/cost/model';
import { isMealTag } from '@/domain/types/taxonomy';
import { SEARCH_SPEC } from '@/lib/google/places/taxonomy';
import { createOpenAiClient } from '@/lib/ai/openai';
import type { LlmClient } from '@/lib/ai/client';
import { withLedger } from '@/lib/ai/instrumented';
import {
  planShapeFromWire,
  planShapeJsonSchema,
  planShapeWire,
  type PlanShape,
  type PlannedDay,
} from '@/lib/ai/wire/plan-shape';
import {
  assignPlacesJsonSchema,
  assignPlacesWire,
  assignmentsFromWire,
} from '@/lib/ai/wire/assign-places';
import { narrativeFromWire, narrativeJsonSchema, narrativeWire } from '@/lib/ai/wire/narrative';
import { PLAN_SHAPE_SYSTEM, buildPlanShapeInput } from '@/lib/ai/prompts/plan-shape';
import {
  ASSIGN_PLACES_SYSTEM,
  buildAssignPlacesInput,
  type CandidateLine,
} from '@/lib/ai/prompts/assign-places';
import { NARRATIVE_SYSTEM, buildNarrativeInput } from '@/lib/ai/prompts/narrative';
import { resolveDestination, type ResolvedDestination } from './destination';
import { resolveCandidates, type Candidate } from './candidates';
import { resolveDayLegs } from './routing';
import { mapWithConcurrency } from '@/lib/utils/async';
import type { DraftDay, DraftItinerary } from './draft';
import { buildDay } from './stages/build-day';
import { dateFor, mealWindowFor, weekdayFor } from './trip-time';
import type { PipelineContext } from './context';
import { validateAndRepair } from './repair';
import { ServiceError } from '@/lib/observability/errors';
import { tripCover } from '@/lib/images';
import { STAGE_COPY, STAGE_PROGRESS, type Stage } from './stage-names';

export { STAGE_COPY, type Stage };

/**
 * The generation pipeline.
 *
 * Stages marked [AI] use a model; everything else is deterministic. There are
 * exactly three model calls for a single-destination trip regardless of length:
 * one to shape the trip, one per day to assign places (batched), one to write
 * the narrative. Ranking, sequencing, scheduling, routing and costing are all
 * plain code — see docs/ARCHITECTURE.md §6.3.
 */

export type { PipelineContext } from './context';

export interface PipelineDeps {
  readonly llm: LlmClient;
  readonly resolveDestination: typeof resolveDestination;
  readonly resolveCandidates: typeof resolveCandidates;
  readonly resolveDayLegs: typeof resolveDayLegs;
}

function defaultDeps(context: PipelineContext): PipelineDeps {
  return {
    llm: withLedger(createOpenAiClient(), { tripId: context.tripId, jobId: context.jobId }),
    resolveDestination,
    resolveCandidates,
    resolveDayLegs,
  };
}

export async function generateItinerary(
  context: PipelineContext,
  deps: PipelineDeps = defaultDeps(context),
): Promise<DraftItinerary> {
  const { request } = context;
  const llm = deps.llm;

  // -- Stage 0: destination -------------------------------------------------
  await stage(context, 'resolving_destination');
  const destination = await deps.resolveDestination(request.destinationQuery, context);
  const destinations = [destination];

  const costInputs: CostInputs = {
    costIndex: destination.costIndex,
    style: request.travelStyle,
    pace: request.pace,
    adults: request.party.adults,
    children: request.party.children,
    accommodation: request.accommodation,
    nights: Math.max(0, request.dates.durationDays - 1),
  };

  // -- Stage 1 [AI]: shape --------------------------------------------------
  await stage(context, 'understanding_style');
  const plan = await buildPlanShape(llm, request, destinations);

  // -- Stage 2: candidates --------------------------------------------------
  await stage(context, 'finding_places');
  const tags = new Set<ExperienceTag>();
  for (const day of plan.days) for (const slot of day.slots) tags.add(slot.tag);

  const candidatesByTag = await deps.resolveCandidates(
    [...tags].map((tag) => ({
      tag,
      destinationId: destination.id,
      destinationName: destination.name,
      centre: destination.location,
      radiusMeters: destination.radiusMeters,
    })),
    context,
  );

  if ([...candidatesByTag.values()].every((list) => list.length === 0)) {
    throw new ServiceError({
      kind: 'no_results',
      provider: 'google_places',
      message: `No candidates found for ${destination.name}`,
      userMessage: `We could not find enough places in ${destination.name} to build a trip. Try a nearby city.`,
    });
  }

  // -- Stages 3-4: rank, then assign ---------------------------------------
  await stage(context, 'choosing_places');
  const chosen = new Set<string>();
  const chosenNames: string[] = [];
  const draftDays: DraftDay[] = [];

  // Days run sequentially rather than in parallel: each needs to know what the
  // previous days used so the trip does not repeat itself. The cost is latency,
  // which `onDayReady` hides by streaming days to the UI as they land.
  for (const plannedDay of plan.days) {
    const day = await buildDay({
      llm,
      context,
      plannedDay,
      destination,
      candidatesByTag,
      chosen,
      chosenNames,
      costInputs,
    });
    draftDays.push(day);
    for (const activity of day.activities) {
      if (activity.placeId) {
        chosen.add(activity.placeId);
        chosenNames.push(activity.title);
      }
    }
    await context.onDayReady?.(day);
  }

  // -- Stage 6: real routes -------------------------------------------------
  await stage(context, 'optimising_route');
  const routedDays = await mapWithConcurrency(draftDays, 3, (day) =>
    applyRealRoutes(day, request, context, deps.resolveDayLegs),
  );

  // -- Stages 5+7: re-time with measured travel, then cost ------------------
  await stage(context, 'timing_the_days');
  let timedDays: readonly DraftDay[] = routedDays.map((day) => retimeDay(day, request, destination));

  // -- Stages 8-9: validate, then repair deterministically ------------------
  await stage(context, 'balancing_budget');

  const weekdays = new Map(
    timedDays.map((day) => [day.dayIndex, weekdayFor(request, day.dayIndex, destination.timezone) ?? 2]),
  );

  const repair = validateAndRepair({
    days: timedDays,
    request,
    candidatesByTag,
    weekdayByDayIndex: weekdays,
    estimateTotal: (days) => estimateDraftTotal(days, request),
  });

  if (repair.rounds > 0) {
    // A repair changed the shape of one or more days, so travel and timings for
    // those days are stale. Re-route and re-time only what actually moved —
    // regenerating everything is the expensive mistake repair exists to avoid.
    const changed = new Set(
      repair.days
        .filter((day) => day.activities.some((a) => a.inboundTravel === null && a.orderIndex > 1))
        .map((day) => day.dayIndex),
    );

    const rerouted = await mapWithConcurrency([...changed], 3, async (dayIndex) => {
      const day = repair.days.find((d) => d.dayIndex === dayIndex);
      return day ? applyRealRoutes(day, request, context, deps.resolveDayLegs) : null;
    });

    const byIndex = new Map(
      rerouted.filter((d): d is DraftDay => d !== null).map((d) => [d.dayIndex, d]),
    );
    timedDays = repair.days.map((day) =>
      retimeDay(byIndex.get(day.dayIndex) ?? day, request, destination),
    );
  } else {
    timedDays = repair.days;
  }

  // -- Stage 10 [AI]: narrative --------------------------------------------
  // Imagery is resolved alongside it: neither depends on the other, and the
  // cover search is a network round trip we would otherwise wait on twice.
  await stage(context, 'writing');
  const [narrative, cover] = await Promise.all([
    buildNarrative(llm, request, destinations, timedDays),
    tripCover({
      destinationName: destination.name,
      countryName: destination.countryName,
      interests: request.interests,
    }).catch(() => null),
  ]);

  await stage(context, 'finalising');

  return {
    cover,
    title: plan.title,
    subtitle: plan.subtitle,
    summary: narrative.summary,
    highlights: narrative.highlights,
    destination,
    days: timedDays.map((day) => {
      const written = narrative.dayTitles.get(day.dayIndex);
      return written ? { ...day, title: written.title, summary: written.summary } : day;
    }),
    costInputs,
  };
}

// ---------------------------------------------------------------------------

async function stage(context: PipelineContext, name: Stage): Promise<void> {
  await context.onStage(name, STAGE_PROGRESS[name]);
}

async function buildPlanShape(
  llm: LlmClient,
  request: TripRequestParsed,
  destinations: readonly ResolvedDestination[],
): Promise<PlanShape> {
  const { value } = await llm.generateStructured({
    schema: planShapeJsonSchema,
    schemaName: 'plan_shape',
    parse: (raw) => planShapeFromWire(planShapeWire.parse(raw)),
    system: PLAN_SHAPE_SYSTEM,
    input: buildPlanShapeInput(
      request,
      destinations.map((d) => ({
        name: d.name,
        countryName: d.countryName,
        nights: Math.max(1, request.dates.durationDays - 1),
      })),
    ),
    tier: 'fast',
    stage: 'plan_shape',
    maxOutputTokens: 12_000,
  });

  // The model occasionally returns the wrong number of days. Truncating or
  // padding here is cheaper and more reliable than a repair round-trip.
  const wanted = request.dates.durationDays;
  const days = value.days.slice(0, wanted);
  while (days.length < wanted) {
    const last = days[days.length - 1];
    days.push({
      dayIndex: days.length + 1,
      theme: 'A slower day',
      narrative: 'Time to revisit what you liked and see what you missed.',
      destinationIndex: 0,
      slots: last ? last.slots.map((s, i) => ({ ...s, slotId: `d${days.length + 1}-s${i}` })) : [],
    });
  }
  return { ...value, days: days.map((d, i) => ({ ...d, dayIndex: i + 1 })) };
}

async function applyRealRoutes(
  day: DraftDay,
  request: TripRequestParsed,
  context: PipelineContext,
  resolveLegs: typeof resolveDayLegs,
): Promise<DraftDay> {
  const stops = day.activities.map((a) => ({ placeId: a.placeId, location: a.location }));
  const legs = await resolveLegs({
    stops,
    allowedModes: request.transportModes,
    departAt: day.date ? new Date(`${day.date}T09:00:00Z`) : null,
    context,
  });

  const activities = day.activities.map((activity, index) => {
    if (index === 0) return activity;
    const leg = legs[index - 1];
    return leg
      ? {
          ...activity,
          inboundTravel: {
            mode: leg.mode,
            minutes: leg.minutes,
            meters: leg.meters,
            polyline: leg.polyline,
            source: leg.source,
          },
        }
      : activity;
  });

  return { ...day, activities };
}

/** Re-run the scheduler now that travel times are measured rather than modelled. */
function retimeDay(
  day: DraftDay,
  request: TripRequestParsed,
  destination: ResolvedDestination,
): DraftDay {
  const weekday = weekdayFor(request, day.dayIndex, destination.timezone) ?? 2;

  const { scheduled, unplaced } = scheduleDay(
    day.activities.map((a) => ({
      id: a.slotId,
      durationMinutes: a.durationMinutes,
      inboundTravel: a.inboundTravel,
      openingHours: a.openingHours,
      window: mealWindowFor(a.tag),
      isLocked: false,
      lockedStart: null,
    })),
    request.pace,
    weekday,
  );

  const times = new Map(scheduled.map((s) => [s.id, s]));
  const dropped = new Set(unplaced);

  const activities = day.activities
    .filter((a) => !dropped.has(a.slotId))
    .map((a) => {
      const t = times.get(a.slotId);
      return t ? { ...a, startMinute: t.startMinute, endMinute: t.endMinute } : a;
    })
    .map((a, i) => ({ ...a, orderIndex: i + 1 }));

  const stillUnfilled = [
    ...day.unfilledSlots,
    ...unplaced.map((slotId) => ({
      slotId,
      why: 'It could not be fitted into the day once travel times were measured.',
    })),
  ];

  return { ...day, activities, unfilledSlots: stillUnfilled };
}

async function buildNarrative(
  llm: LlmClient,
  request: TripRequestParsed,
  destinations: readonly ResolvedDestination[],
  days: readonly DraftDay[],
) {
  const { value } = await llm.generateStructured({
    schema: narrativeJsonSchema,
    schemaName: 'narrative',
    parse: (raw) => narrativeFromWire(narrativeWire.parse(raw)),
    system: NARRATIVE_SYSTEM,
    input: buildNarrativeInput({
      request,
      destinationNames: destinations.map((d) => d.name),
      days: days.map((d) => ({
        dayIndex: d.dayIndex,
        theme: d.title,
        places: d.activities.map((a) => a.title),
      })),
    }),
    tier: 'fast',
    stage: 'narrative',
    maxOutputTokens: 6000,
  });
  return value;
}

// ---------------------------------------------------------------------------

/** Rough total for the budget check during repair, before FX conversion. */
function estimateDraftTotal(days: readonly DraftDay[], request: TripRequestParsed): number | null {
  if (request.budgetTotal === null) return null;
  return days.reduce(
    (sum, day) => sum + day.activities.reduce((s, a) => s + a.estimatedCostUsd, 0),
    0,
  );
}
