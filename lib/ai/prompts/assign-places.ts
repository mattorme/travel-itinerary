import type { TripRequestParsed } from '@/domain/schemas/trip-request';
import type { PlannedDay } from '../wire/plan-shape';
import { describeParty, fenceUserText, INJECTION_GUARD } from './shared';
import { formatMinute } from '@/domain/sequencing/schedule';

/**
 * Stage 4. The model sees only what it needs to choose well: a shortlist per
 * slot, with the signals a person would actually use.
 *
 * Candidate lines are deliberately compact — this prompt is the largest input in
 * the pipeline and output tokens dominate cost.
 */

export const ASSIGN_PLACES_SYSTEM = `
You are choosing specific places for a day that has already been planned in
outline. For each slot you are given a shortlist of REAL, verified candidates.

Rules, in order of importance:

1. You may only return place ids that appear in that slot's candidate list.
   Never invent an id. Never modify one. An id outside the list is discarded and
   the slot is left empty.
2. Choose for THIS traveller, not for a generic tourist. A high rating is not a
   reason on its own — a 4.7 chain cafe is worse than a 4.3 place that is
   actually the thing they came for.
3. Keep the day tight. Prefer candidates near the others you have chosen for the
   same day; a slightly lesser place ten minutes away usually beats a marginally
   better one across town.
4. Never choose the same place twice in a trip.
5. If nothing in a shortlist genuinely fits, leave the slot unfilled and say why.
   An honest gap is better than a bad recommendation.

For each choice write:
- reason: one line, specific to this traveller, in plain language. Not marketing
  copy. "Small counter, ten seats, the tempura is the reason to come" — not
  "a must-visit destination offering an unforgettable experience".
- description: two or three sentences of useful context.

${INJECTION_GUARD}
`.trim();

export interface CandidateLine {
  readonly id: string;
  readonly name: string;
  readonly rating: number | null;
  readonly reviews: number | null;
  readonly priceLevel: string | null;
  readonly summary: string | null;
  /** Metres from the day's centre of gravity. */
  readonly distanceFromDayCentre: number | null;
  readonly openWhenNeeded: boolean;
}

export function buildAssignPlacesInput(args: {
  request: TripRequestParsed;
  day: PlannedDay;
  destinationName: string;
  candidatesBySlot: ReadonlyMap<string, readonly CandidateLine[]>;
  alreadyChosenNames: readonly string[];
}): string {
  const { request, day, candidatesBySlot } = args;

  const slotBlocks = day.slots.map((slot) => {
    const candidates = candidatesBySlot.get(slot.slotId) ?? [];
    const lines =
      candidates.length === 0
        ? '  (no candidates found — leave this slot unfilled)'
        : candidates.map(formatCandidate).join('\n');
    return `SLOT ${slot.slotId} — ${slot.tag}, around ${formatMinute(slot.targetMinute)}, ~${slot.durationMinutes} min
  Intent: ${slot.intent}
${lines}`;
  });

  return `
DAY ${day.dayIndex} in ${args.destinationName}: ${day.theme}
${day.narrative}

TRAVELLER
${describeParty(request.party)} · ${request.travelStyle} · ${request.pace} pace
Interests: ${request.interests.join(', ')}
Food: ${request.foodPrefs.length > 0 ? request.foodPrefs.join(', ') : 'no constraints'}
In their words: ${fenceUserText(request.notes)}

${args.alreadyChosenNames.length > 0 ? `ALREADY USED ON OTHER DAYS (do not repeat):\n${args.alreadyChosenNames.map((n) => `  - ${n}`).join('\n')}\n` : ''}
SLOTS AND CANDIDATES

${slotBlocks.join('\n\n')}

Return one assignment per slot you can fill, and list the rest under "unfilled".
`.trim();
}

function formatCandidate(c: CandidateLine): string {
  const bits = [`  [${c.id}] ${c.name}`];
  if (c.rating !== null) bits.push(`${c.rating.toFixed(1)}★${c.reviews ? ` (${compact(c.reviews)})` : ''}`);
  if (c.priceLevel) bits.push(priceGlyph(c.priceLevel));
  if (c.distanceFromDayCentre !== null) bits.push(`${(c.distanceFromDayCentre / 1000).toFixed(1)}km from day centre`);
  if (!c.openWhenNeeded) bits.push('CLOSED at the planned time');
  const head = bits.join(' · ');
  return c.summary ? `${head}\n      ${c.summary}` : head;
}

function priceGlyph(level: string): string {
  switch (level) {
    case 'PRICE_LEVEL_FREE': return 'free';
    case 'PRICE_LEVEL_INEXPENSIVE': return '$';
    case 'PRICE_LEVEL_MODERATE': return '$$';
    case 'PRICE_LEVEL_EXPENSIVE': return '$$$';
    case 'PRICE_LEVEL_VERY_EXPENSIVE': return '$$$$';
    default: return '';
  }
}

function compact(n: number): string {
  return n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n);
}
