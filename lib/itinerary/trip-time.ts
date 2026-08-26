import type { TripRequestParsed } from '@/domain/schemas/trip-request';
import type { ExperienceTag } from '@/domain/types/taxonomy';
import type { MEAL_WINDOWS } from '@/domain/sequencing/schedule';

/**
 * Time and travel-mode derivations shared by the pipeline stages.
 *
 * Small, but worth one home: `weekdayFor` in particular has to resolve the
 * destination's local weekday rather than the server's, and a second copy that
 * quietly used UTC would put a museum's Monday closure on the wrong day.
 */

/** The calendar date of a given day index, or null for a duration-only trip. */
export function dateFor(request: TripRequestParsed, dayIndex: number): string | null {
  if (!request.dates.start) return null;
  const ms = Date.parse(`${request.dates.start}T00:00:00Z`) + (dayIndex - 1) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Local weekday at the destination — 0 = Sunday — which is what opening hours
 * are keyed on. Null when the trip has no dates.
 */
export function weekdayFor(
  request: TripRequestParsed,
  dayIndex: number,
  timezone: string,
): number | null {
  const date = dateFor(request, dayIndex);
  if (!date) return null;
  try {
    const label = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' })
      .format(new Date(`${date}T12:00:00Z`));
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(label);
  } catch {
    // An unknown timezone is better handled as UTC than as a crash.
    return new Date(`${date}T12:00:00Z`).getUTCDay();
  }
}

/** The mode to assume when sequencing a day, given what the traveller allowed. */
export function primaryMode(request: TripRequestParsed): string {
  const modes = request.transportModes;
  if (modes.includes('walking') && modes.length === 1) return 'walking';
  if (modes.includes('driving')) return 'driving';
  if (modes.includes('transit')) return 'transit';
  return 'mixed';
}

/** The meal window a tag belongs to, if any. Drives where a meal can be placed. */
export function mealWindowFor(tag: ExperienceTag): keyof typeof MEAL_WINDOWS | null {
  switch (tag) {
    case 'breakfast': return 'breakfast';
    case 'lunch': return 'lunch';
    case 'dinner': return 'dinner';
    case 'coffee': return 'coffee';
    case 'street_food': return 'street_food';
    default: return null;
  }
}
