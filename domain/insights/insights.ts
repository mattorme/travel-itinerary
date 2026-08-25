import type { Itinerary, TripDay } from '../types/itinerary';

/**
 * What the itinerary actually asks of you.
 *
 * A list of stops does not tell a traveller whether a trip is a gentle week or
 * a forced march — and that is usually the thing they most want to know before
 * committing. These are the numbers a person would work out by hand if they
 * had the patience: how far they are walking, how much of each day is spoken
 * for, which day is the heavy one, and how much of it is free.
 *
 * Pure and total: every field is defined for an empty trip, because a
 * half-generated itinerary should render a quiet panel rather than crash.
 */

export interface DayLoad {
  readonly dayIndex: number;
  readonly title: string;
  readonly stops: number;
  readonly activeMinutes: number;
  readonly travelMinutes: number;
  readonly walkingMeters: number;
  readonly cost: number | null;
}

export interface TripInsights {
  readonly stops: number;
  readonly meals: number;
  /** Distinct places, so a trip that revisits somewhere is not double counted. */
  readonly distinctPlaces: number;

  readonly walkingMeters: number;
  readonly travelMinutes: number;
  readonly activeMinutes: number;

  /** Share of stops that cost nothing. A useful signal for a budget trip. */
  readonly freeStopShare: number;

  readonly busiestDay: DayLoad | null;
  readonly lightestDay: DayLoad | null;
  readonly perDay: readonly DayLoad[];

  /** Earliest start and latest finish across the trip, minutes since midnight. */
  readonly earliestStart: number | null;
  readonly latestFinish: number | null;

  /** True when nothing has been scheduled yet — a draft, or a failed generation. */
  readonly isEmpty: boolean;
}

export function computeInsights(itinerary: Itinerary): TripInsights {
  const perDay = itinerary.days.map(dayLoad);

  const stops = perDay.reduce((sum, d) => sum + d.stops, 0);
  const meals = itinerary.days.reduce(
    (sum, day) => sum + day.activities.filter((a) => a.kind === 'meal').length,
    0,
  );

  const places = new Set<string>();
  for (const day of itinerary.days) {
    for (const activity of day.activities) {
      if (activity.place) places.add(activity.place.placeId);
    }
  }

  const costed = itinerary.days.flatMap((day) =>
    day.activities.filter((a) => a.kind !== 'transit' && a.estimatedCost !== null),
  );
  const free = costed.filter((a) => (a.estimatedCost ?? 0) <= 0).length;

  const starts = itinerary.days.flatMap((day) =>
    day.activities.map((a) => a.startMinute).filter((m): m is number => m !== null),
  );
  const ends = itinerary.days.flatMap((day) =>
    day.activities.map((a) => a.endMinute).filter((m): m is number => m !== null),
  );

  // Ranked on committed time rather than stop count: four museums is a heavier
  // day than six coffees, and stop count would say the opposite.
  const ranked = [...perDay].sort(
    (a, b) => b.activeMinutes + b.travelMinutes - (a.activeMinutes + a.travelMinutes),
  );

  return {
    stops,
    meals,
    distinctPlaces: places.size,
    walkingMeters: perDay.reduce((sum, d) => sum + d.walkingMeters, 0),
    travelMinutes: perDay.reduce((sum, d) => sum + d.travelMinutes, 0),
    activeMinutes: perDay.reduce((sum, d) => sum + d.activeMinutes, 0),
    freeStopShare: costed.length > 0 ? free / costed.length : 0,
    busiestDay: ranked[0] ?? null,
    lightestDay: ranked.length > 1 ? (ranked[ranked.length - 1] ?? null) : null,
    perDay,
    earliestStart: starts.length > 0 ? Math.min(...starts) : null,
    latestFinish: ends.length > 0 ? Math.max(...ends) : null,
    isEmpty: stops === 0,
  };
}

function dayLoad(day: TripDay): DayLoad {
  let activeMinutes = 0;
  let travelMinutes = 0;
  let walkingMeters = 0;
  let cost = 0;
  let hasCost = false;

  for (const activity of day.activities) {
    activeMinutes += activity.durationMinutes ?? 0;

    const leg = activity.inboundTravel;
    if (leg) {
      travelMinutes += leg.minutes;
      // Only actual walking counts. Counting a train ride as distance covered
      // would make a day-trip look like a hike.
      if (leg.mode === 'walking') walkingMeters += leg.meters;
    }

    if (activity.estimatedCost !== null) {
      cost += activity.estimatedCost;
      hasCost = true;
    }
  }

  return {
    dayIndex: day.dayIndex,
    title: day.title,
    stops: day.activities.filter((a) => a.kind === 'activity' || a.kind === 'meal').length,
    activeMinutes,
    travelMinutes,
    walkingMeters,
    cost: hasCost ? Math.round(cost) : null,
  };
}

/** Rough steps, for the one number everyone has an intuition for. */
export function metersToSteps(meters: number): number {
  // ~0.72 m per step at an adult walking pace, rounded to the nearest hundred
  // so it reads as the estimate it is.
  return Math.round(meters / 0.72 / 100) * 100;
}
