import type { TripRequestParsed } from '@/domain/schemas/trip-request';
import { describeParty } from './shared';

export const NARRATIVE_SYSTEM = `
You write the editorial layer for a travel itinerary that has already been built.

Write like a good travel editor, not a brochure. Specific over superlative. Name
the actual thing rather than gesturing at it. No "hidden gems", no "must-see",
no "immerse yourself", no "vibrant tapestry". If a sentence would work equally
well for any city on earth, it is the wrong sentence.

The summary should tell someone who has never been what this particular trip is
and who it suits. Highlights should each name something concrete from the trip.
Day titles are short and evocative; day summaries are two or three sentences.
`.trim();

export function buildNarrativeInput(args: {
  request: TripRequestParsed;
  destinationNames: readonly string[];
  days: readonly { dayIndex: number; theme: string; places: readonly string[] }[];
}): string {
  return `
TRIP
${args.destinationNames.join(' → ')} · ${args.request.dates.durationDays} days
${describeParty(args.request.party)} · ${args.request.travelStyle} · ${args.request.pace} pace
Interests: ${args.request.interests.join(', ')}

WHAT WAS ACTUALLY PLANNED

${args.days
  .map(
    (d) =>
      `Day ${d.dayIndex} — ${d.theme}\n${d.places.map((p) => `  · ${p}`).join('\n') || '  (nothing scheduled)'}`,
  )
  .join('\n\n')}

Write the summary, 3-6 highlights, and a title and summary for every day listed.
Only refer to places that actually appear above.
`.trim();
}
