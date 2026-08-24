import type { TripRequestParsed } from '@/domain/schemas/trip-request';
import { PACE_PROFILES } from '@/domain/sequencing/schedule';
import { describeParty, fenceUserText, formatMoney, INJECTION_GUARD } from './shared';

export const PLAN_SHAPE_SYSTEM = `
You are a travel planner who has spent years in the places you plan. You are
designing the SHAPE of a trip: what each day should feel like, and what kinds of
experiences belong in it, in what order.

You do NOT choose specific venues. You never write the name of a restaurant,
museum, hotel, or attraction. A later step resolves your slots to real places
using live data — if you name somewhere, it will be discarded.

What makes a day good:
- It has a narrative. A day is somewhere you went and something that happened,
  not a list of famous names.
- It is geographically coherent. One part of the city, or one clear excursion.
  A day that crosses a metropolis three times is a bad day however good the
  individual stops are.
- It respects the traveller's pace. A relaxed day genuinely has fewer things in
  it, with room to sit down.
- It varies across the trip. Do not schedule three museums in a row, or the same
  rhythm every day. Consecutive days should feel different.
- It puts food where food belongs: breakfast early, lunch in the middle, dinner
  in the evening — and treats meals as part of the experience, not filler.
- It respects what the traveller said they dislike. If they said they hate
  nightlife, there is no bar slot. This is not negotiable.

${INJECTION_GUARD}
`.trim();

export function buildPlanShapeInput(
  request: TripRequestParsed,
  destinations: readonly { name: string; countryName: string; nights: number }[],
): string {
  const profile = PACE_PROFILES[request.pace];
  const days = request.dates.durationDays;

  return `
TRIP BRIEF

Destinations (use destination_index to refer to these):
${destinations.map((d, i) => `  [${i}] ${d.name}, ${d.countryName} — ${d.nights} night(s)`).join('\n')}

Duration: ${days} day${days === 1 ? '' : 's'}${request.dates.start ? `, ${request.dates.start} to ${request.dates.end}` : ' (dates flexible)'}
Travellers: ${describeParty(request.party)}
Budget: ${formatMoney(request.budgetTotal, request.currency)} total (${formatMoney(request.budgetDaily, request.currency)} per day), excluding flights
Travel style: ${request.travelStyle}
Pace: ${request.pace} — at most ${profile.maxActivities} substantive stops per day, roughly ${Math.round(profile.maxActiveMinutes / 60)} active hours, day running ${Math.floor(profile.dayStart / 60)}:00 to ${Math.floor(profile.dayEnd / 60)}:00
Interests: ${request.interests.join(', ')}
Getting around: ${request.transportModes.join(', ')}
Food preferences: ${request.foodPrefs.length > 0 ? request.foodPrefs.join(', ') : 'no constraints given'}
Accommodation: ${request.accommodation ?? 'not specified'}

In the traveller's own words:
${fenceUserText(request.notes)}

INSTRUCTIONS

Produce exactly ${days} day${days === 1 ? '' : 's'}, day_index 1 to ${days}.

For each day give a theme, a short narrative describing the arc of the day, and
an ordered list of slots. Each slot is a KIND of experience (its tag), roughly
when it should happen, how long it should take, and why it belongs here for this
particular traveller.

Slot count must respect the pace: ${profile.maxActivities} substantive stops is the
ceiling, and a relaxed traveller should usually get fewer. Include meal slots
(breakfast/lunch/dinner/coffee/street_food) at sensible times.

Arrival and departure days should be lighter than the middle of the trip.

Every interest the traveller listed must appear somewhere across the trip. Not
every day — across the trip.
`.trim();
}
