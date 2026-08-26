import type { MinuteOfDay } from '@/domain/types/itinerary';

/**
 * Time of day.
 *
 * The product's visual identity is built on this: every stop belongs to a
 * morning, an afternoon or an evening, and that is what colours it everywhere
 * it appears. Three bands rather than four because three is how people
 * actually describe a day — nobody plans a "late morning" and a "midday" as
 * separate things when they are deciding what a trip feels like.
 */
export const TIME_BANDS = ['morning', 'afternoon', 'evening'] as const;
export type TimeBand = (typeof TIME_BANDS)[number];

/** Noon and 5pm, in minutes since local midnight. */
const AFTERNOON_FROM = 12 * 60;
const EVENING_FROM = 17 * 60;

export function bandOf(minute: MinuteOfDay): TimeBand {
  if (minute < AFTERNOON_FROM) return 'morning';
  if (minute < EVENING_FROM) return 'afternoon';
  return 'evening';
}

/**
 * The window every day is drawn against: 06:00 to midnight.
 *
 * Anything earlier is pinned to the left edge rather than given its own space —
 * a 4am airport run should not squash the other eighteen hours of the trip.
 */
export const ARC_START: MinuteOfDay = 6 * 60;
export const ARC_END: MinuteOfDay = 24 * 60;
export const ARC_SPAN = ARC_END - ARC_START;

/** A stop's position in the arc, as fractions of the window. */
export interface ArcSegment {
  readonly band: TimeBand;
  /** 0–1 from the left edge of the window. */
  readonly offset: number;
  /** 0–1 of the window's width, floored so a short stop stays visible. */
  readonly width: number;
}

/** Shortest stop that still reads as a mark rather than a hairline. */
const MIN_VISIBLE_MINUTES = 40;

export function arcSegments(
  activities: readonly { startMinute: MinuteOfDay | null; durationMinutes: number | null }[],
): ArcSegment[] {
  const segments: ArcSegment[] = [];
  for (const activity of activities) {
    if (activity.startMinute === null) continue;
    const start = Math.min(Math.max(activity.startMinute, ARC_START), ARC_END);
    const minutes = Math.max(activity.durationMinutes ?? MIN_VISIBLE_MINUTES, MIN_VISIBLE_MINUTES);
    const offset = (start - ARC_START) / ARC_SPAN;
    segments.push({
      band: bandOf(activity.startMinute),
      offset,
      width: Math.min(minutes / ARC_SPAN, 1 - offset),
    });
  }
  return segments;
}

/** How many stops fall in each band. Drives the arc's accessible description. */
export function bandCounts(segments: readonly ArcSegment[]): Record<TimeBand, number> {
  const counts: Record<TimeBand, number> = { morning: 0, afternoon: 0, evening: 0 };
  for (const segment of segments) counts[segment.band] += 1;
  return counts;
}

/**
 * The arc's text equivalent.
 *
 * A screen reader gets the same information a sighted reader takes from the
 * shape — how the day is weighted — rather than "image".
 */
export function describeArc(label: string, segments: readonly ArcSegment[]): string {
  if (segments.length === 0) return `${label}: nothing scheduled`;
  const counts = bandCounts(segments);
  const parts = TIME_BANDS.filter((band) => counts[band] > 0).map(
    (band) => `${counts[band]} ${band}`,
  );
  const stops = segments.length === 1 ? '1 stop' : `${segments.length} stops`;
  return `${label}: ${stops}, ${parts.join(', ')}`;
}
