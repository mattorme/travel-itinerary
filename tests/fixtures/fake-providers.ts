import type { LlmClient, StructuredRequest, StructuredResult } from '@/lib/ai/client';
import type { Candidate } from '@/lib/itinerary/candidates';
import type { ResolvedDestination } from '@/lib/itinerary/destination';
import type { ResolvedLeg } from '@/lib/itinerary/routing';
import { asDestinationId, asPlaceId } from '@/domain/types/ids';
import type { ExperienceTag } from '@/domain/types/taxonomy';
import { estimateTravelSeconds, haversineMeters } from '@/domain/types/geo';
import type { PlanShapeWire } from '@/lib/ai/wire/plan-shape';
import type { AssignPlacesWire } from '@/lib/ai/wire/assign-places';
import type { NarrativeWire } from '@/lib/ai/wire/narrative';

/**
 * Stand-ins for the pipeline's three external boundaries.
 *
 * These are not mocks of the pipeline — the real orchestration runs. They
 * replace only the network: a scripted model, a fixed destination, a synthetic
 * place corpus, and haversine legs. That makes the whole of stages 0-11
 * testable in CI without a key, which is the only way prompt or ranking changes
 * can be evaluated at all.
 */

export const TOKYO: ResolvedDestination = {
  id: asDestinationId('11111111-1111-1111-1111-111111111111'),
  name: 'Tokyo',
  countryCode: 'JP',
  countryName: 'Japan',
  location: { lat: 35.6812, lng: 139.7671 },
  timezone: 'Asia/Tokyo',
  bbox: null,
  costIndex: 1,
  radiusMeters: 12_000,
};

/**
 * A corpus with real geographic structure: two clusters ~7km apart, so a
 * sequencer that ignores geography produces a measurably worse day than one
 * that does not.
 */
export function makeCandidates(tag: ExperienceTag, count = 8): Candidate[] {
  return Array.from({ length: count }, (_, i) => {
    const west = i % 2 === 0;
    const placeId = asPlaceId(`${tag}-${i}`);
    const location = {
      lat: 35.68 + (west ? 0 : 0.03) + i * 0.0015,
      lng: 139.70 + (west ? 0 : 0.07) + i * 0.0015,
    };
    return {
      placeId,
      googlePlaceId: `g-${tag}-${i}`,
      tags: [tag],
      location,
      hydration: {
        displayName: `${tag.replace(/_/g, ' ')} ${i}`,
        formattedAddress: 'Tokyo, Japan',
        location,
        rating: 4.7 - i * 0.1,
        userRatingCount: 2000 - i * 150,
        priceLevel: 'PRICE_LEVEL_MODERATE' as const,
        openingHours: null,
        websiteUri: null,
        googleMapsUri: null,
        editorialSummary: null,
        photoNames: [],
        businessStatus: 'OPERATIONAL',
      },
    };
  });
}

export interface ScriptedLlmOptions {
  /** Force the model to return ids outside the candidate set, to test rejection. */
  readonly emitInvalidPlaceIds?: boolean;
  /** Return the wrong number of days, to test the pad/truncate guard. */
  readonly dayCountOverride?: number;
}

export interface ScriptedLlm extends LlmClient {
  readonly calls: { stage: string; input: string }[];
}

export function createScriptedLlm(
  request: { durationDays: number; slotsPerDay?: number },
  options: ScriptedLlmOptions = {},
): ScriptedLlm {
  const calls: { stage: string; input: string }[] = [];
  const slotsPerDay = request.slotsPerDay ?? 4;

  const client: LlmClient = {
    async generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
      calls.push({ stage: req.stage, input: req.input });

      const raw =
        req.stage === 'plan_shape'
          ? planShape(options.dayCountOverride ?? request.durationDays, slotsPerDay)
          : req.stage === 'assign_places'
            ? assignPlaces(req.input, options.emitInvalidPlaceIds ?? false)
            : narrative(request.durationDays);

      return {
        value: req.parse(raw),
        usage: {
          model: 'scripted',
          inputTokens: 100,
          outputTokens: 200,
          cachedTokens: 0,
          reasoningTokens: 0,
          costUsd: 0,
          latencyMs: 1,
        },
      };
    },
  };

  return Object.assign(client, { calls });
}

const DAY_TAGS: ExperienceTag[] = ['landmark', 'lunch', 'museum', 'dinner', 'market', 'coffee'];

function planShape(days: number, slotsPerDay: number): PlanShapeWire {
  return {
    trip_title: `${days} days in Tokyo`,
    trip_subtitle: 'Neighbourhood by neighbourhood',
    days: Array.from({ length: days }, (_, d) => ({
      day_index: d + 1,
      theme: `Day ${d + 1} theme`,
      narrative: 'A day that starts slowly and gets better as it goes on, ending with dinner.',
      destination_index: 0,
      slots: Array.from({ length: slotsPerDay }, (_, s) => ({
        slot_id: `d${d + 1}-s${s}`,
        tag: DAY_TAGS[s % DAY_TAGS.length] as ExperienceTag,
        target_minute: 9 * 60 + s * 150,
        duration_minutes: 75,
        intent: 'Chosen because it fits how this traveller said they like to spend a day.',
      })),
    })),
  };
}

/**
 * Picks the first candidate offered for each slot by parsing the prompt — which
 * also asserts that the prompt actually contains parseable candidate ids.
 */
function assignPlaces(input: string, invalid: boolean): AssignPlacesWire {
  const assignments: AssignPlacesWire['assignments'] = [];
  const blocks = input.split(/^SLOT /m).slice(1);

  for (const block of blocks) {
    const slotId = block.split(' ')[0]?.trim();
    const firstId = /\[([^\]]+)\]/.exec(block)?.[1];
    if (!slotId || !firstId) continue;
    assignments.push({
      slot_id: slotId,
      place_id: invalid ? `hallucinated-${slotId}` : firstId,
      reason: 'Small, well run, and exactly the kind of thing they asked for.',
      description: 'A short, factual description of the place and why it is worth the time.',
    });
  }

  return { assignments, unfilled: [] };
}

function narrative(days: number): NarrativeWire {
  return {
    summary:
      'A trip that trades breadth for depth: two or three neighbourhoods properly, rather than a checklist of famous names crossed off at speed.',
    highlights: ['Morning markets', 'A proper sit-down lunch', 'One long walk'],
    day_titles: Array.from({ length: days }, (_, d) => ({
      day_index: d + 1,
      title: `Day ${d + 1}`,
      summary: 'Written after the fact, describing what actually ended up in the day.',
    })),
  };
}

/** Haversine legs, standing in for the Routes API. */
export async function fakeResolveDayLegs(args: {
  stops: readonly { placeId: ReturnType<typeof asPlaceId>; location: { lat: number; lng: number } }[];
  allowedModes: readonly string[];
}): Promise<readonly ResolvedLeg[]> {
  const { stops } = args;
  if (stops.length < 2) return [];

  return stops.slice(1).map((to, i) => {
    const from = stops[i]!;
    const meters = Math.round(haversineMeters(from.location, to.location));
    return {
      fromPlaceId: from.placeId,
      toPlaceId: to.placeId,
      mode: 'transit' as const,
      minutes: Math.round(estimateTravelSeconds(from.location, to.location, 'transit') / 60),
      meters,
      polyline: null,
      source: 'routes' as const,
    };
  });
}
