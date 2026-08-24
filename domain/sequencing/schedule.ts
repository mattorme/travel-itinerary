import type { MinuteOfDay, OpeningHours, TravelLeg } from '../types/itinerary';
import type { Pace } from '../types/taxonomy';

/**
 * Turning an ordered list of places into wall-clock times.
 *
 * Pace is the constraint that makes an itinerary feel human: it caps how much of
 * the day is spoken for, and it sets the slack between activities. A "relaxed"
 * day that schedules seven things back to back is not relaxed, whatever the
 * label says.
 */

export interface PaceProfile {
  /** Minutes of the day that may be committed to activities and travel. */
  readonly maxActiveMinutes: number;
  /** Breathing room inserted after each activity, on top of travel time. */
  readonly slackMinutes: number;
  readonly dayStart: MinuteOfDay;
  readonly dayEnd: MinuteOfDay;
  readonly maxActivities: number;
}

export const PACE_PROFILES: Readonly<Record<Pace, PaceProfile>> = {
  relaxed: {
    maxActiveMinutes: 6 * 60,
    slackMinutes: 30,
    dayStart: 9 * 60 + 30,
    dayEnd: 21 * 60,
    maxActivities: 4,
  },
  balanced: {
    maxActiveMinutes: 8 * 60 + 30,
    slackMinutes: 20,
    dayStart: 9 * 60,
    dayEnd: 21 * 60 + 30,
    maxActivities: 6,
  },
  packed: {
    maxActiveMinutes: 11 * 60,
    slackMinutes: 10,
    dayStart: 8 * 60,
    dayEnd: 22 * 60 + 30,
    maxActivities: 8,
  },
};

/** Meal windows, in local minutes. Used both to place meals and to validate them. */
export const MEAL_WINDOWS = {
  breakfast: { earliest: 7 * 60, latest: 10 * 60 + 30, ideal: 8 * 60 + 30 },
  coffee: { earliest: 8 * 60, latest: 17 * 60, ideal: 15 * 60 },
  lunch: { earliest: 11 * 60 + 30, latest: 14 * 60 + 30, ideal: 12 * 60 + 45 },
  street_food: { earliest: 11 * 60, latest: 21 * 60, ideal: 18 * 60 },
  dinner: { earliest: 17 * 60 + 30, latest: 21 * 60 + 30, ideal: 19 * 60 },
} as const;

export interface ScheduleItem {
  readonly id: string;
  readonly durationMinutes: number;
  readonly inboundTravel: TravelLeg | null;
  readonly openingHours: OpeningHours | null;
  /** Meal window key, when this item is a meal. */
  readonly window: keyof typeof MEAL_WINDOWS | null;
  readonly isLocked: boolean;
  readonly lockedStart: MinuteOfDay | null;
}

export interface ScheduledItem {
  readonly id: string;
  readonly startMinute: MinuteOfDay;
  readonly endMinute: MinuteOfDay;
}

/**
 * Lays items onto a day in the order given, respecting travel time, opening
 * hours, meal windows and locked start times. Returns the schedule plus the
 * items that could not be placed — the caller decides whether to drop them or
 * escalate to repair, because "we couldn't fit this" is information the
 * traveller should sometimes see rather than have silently hidden.
 */
export function scheduleDay(
  items: readonly ScheduleItem[],
  pace: Pace,
  weekday: number,
): { scheduled: readonly ScheduledItem[]; unplaced: readonly string[] } {
  const profile = PACE_PROFILES[pace];
  const scheduled: ScheduledItem[] = [];
  const unplaced: string[] = [];

  let cursor = profile.dayStart;

  for (const item of items) {
    const travel = item.inboundTravel?.minutes ?? 0;
    let start = cursor + travel;

    if (item.isLocked && item.lockedStart !== null) {
      start = item.lockedStart;
    } else {
      if (item.window) {
        const w = MEAL_WINDOWS[item.window];
        start = Math.max(start, w.earliest);
        // A meal pushed past its window is worse than a meal slightly early.
        if (start > w.latest) start = w.latest;
      }
      const opened = nextOpenMinute(item.openingHours, weekday, start, item.durationMinutes);
      if (opened === null) {
        unplaced.push(item.id);
        continue;
      }
      start = opened;
    }

    const end = start + item.durationMinutes;
    if (!item.isLocked && end > profile.dayEnd) {
      unplaced.push(item.id);
      continue;
    }

    scheduled.push({ id: item.id, startMinute: start, endMinute: end });
    cursor = end + profile.slackMinutes;
  }

  return { scheduled, unplaced };
}

/**
 * The earliest minute at or after `from` at which the venue is open for the
 * whole visit. Null when it cannot fit today at all.
 *
 * Unknown hours are treated as open: Google's coverage is patchy and refusing to
 * schedule anything without hours would gut the itinerary. Validation surfaces
 * this separately as a soft warning rather than a hard error.
 */
export function nextOpenMinute(
  hours: OpeningHours | null,
  weekday: number,
  from: MinuteOfDay,
  durationMinutes: number,
): MinuteOfDay | null {
  if (!hours || hours.alwaysOpen || hours.periods.length === 0) return from;

  const today = hours.periods.filter((p) => p.day === weekday);
  if (today.length === 0) return null; // closed all day

  let best: MinuteOfDay | null = null;
  for (const period of today) {
    const start = Math.max(from, period.open);
    if (start + durationMinutes <= period.close) {
      best = best === null ? start : Math.min(best, start);
    }
  }
  return best;
}

export function isOpenAt(
  hours: OpeningHours | null,
  weekday: number,
  minute: MinuteOfDay,
): boolean {
  if (!hours || hours.alwaysOpen || hours.periods.length === 0) return true;
  return hours.periods.some((p) => p.day === weekday && minute >= p.open && minute < p.close);
}

export function formatMinute(minute: MinuteOfDay): string {
  const wrapped = ((minute % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  const suffix = h < 12 ? 'am' : 'pm';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12}${suffix}` : `${hour12}:${String(m).padStart(2, '0')}${suffix}`;
}
