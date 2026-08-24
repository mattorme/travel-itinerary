import { haversineMeters } from '../types/geo';
import type { Itinerary, TripDay } from '../types/itinerary';
import { INTEREST_TAGS, type ExperienceTag, type Interest } from '../types/taxonomy';
import { isOpenAt, PACE_PROFILES } from '../sequencing/schedule';
import type { ItineraryIssue } from './issues';

/**
 * Deterministic validation. Pure: no IO, no clock, no randomness — every issue
 * is reproducible from the itinerary alone, which is what makes the golden
 * fixtures in tests/unit meaningful.
 */

export interface ValidationContext {
  /** Weekday (0 = Sunday) for each day index. Null when the trip has no dates. */
  readonly weekdayByDayIndex: ReadonlyMap<number, number>;
  /** Tags actually attached to each place, for interest coverage. */
  readonly tagsByActivityId: ReadonlyMap<string, readonly ExperienceTag[]>;
  /** How far over budget is tolerable before it becomes an error. */
  readonly budgetTolerance: number;
}

export const DEFAULT_BUDGET_TOLERANCE = 0.15;

export function validateItinerary(
  itinerary: Itinerary,
  context: ValidationContext,
): readonly ItineraryIssue[] {
  const issues: ItineraryIssue[] = [];

  validateDuration(itinerary, issues);
  validateDates(itinerary, issues);

  for (const day of itinerary.days) {
    validateDaySchedule(itinerary, day, context, issues);
    validateDayGeography(itinerary, day, issues);
    validateDayMeals(day, issues);
  }

  validateDuplicates(itinerary, issues);
  validateInterests(itinerary, context, issues);
  validateBudget(itinerary, context, issues);

  return issues;
}

// ---------------------------------------------------------------------------

function validateDuration(itinerary: Itinerary, issues: ItineraryIssue[]): void {
  const expected = itinerary.request.dates.durationDays;
  const actual = itinerary.days.length;
  if (expected !== actual) {
    issues.push({ code: 'DURATION_MISMATCH', severity: 'error', expected, actual });
  }
}

function validateDates(itinerary: Itinerary, issues: ItineraryIssue[]): void {
  const start = itinerary.request.dates.start;
  if (!start) return;

  for (const day of itinerary.days) {
    if (!day.date) continue;
    const expected = addDays(start, day.dayIndex - 1);
    if (day.date !== expected) {
      issues.push({
        code: 'DATE_MISMATCH',
        severity: 'error',
        dayIndex: day.dayIndex,
        expected,
        actual: day.date,
      });
    }
  }
}

function validateDaySchedule(
  itinerary: Itinerary,
  day: TripDay,
  context: ValidationContext,
  issues: ItineraryIssue[],
): void {
  const profile = PACE_PROFILES[itinerary.request.pace];
  const weekday = context.weekdayByDayIndex.get(day.dayIndex) ?? null;

  const timed = day.activities
    .filter((a) => a.startMinute !== null && a.endMinute !== null)
    .sort((a, b) => (a.startMinute ?? 0) - (b.startMinute ?? 0));

  // Overlaps and travel feasibility, pairwise along the sorted schedule.
  for (let i = 1; i < timed.length; i++) {
    const prev = timed[i - 1]!;
    const curr = timed[i]!;
    const gap = (curr.startMinute ?? 0) - (prev.endMinute ?? 0);

    if (gap < 0) {
      issues.push({
        code: 'OVERLAP',
        severity: 'error',
        dayIndex: day.dayIndex,
        activityIds: [prev.id, curr.id],
        overlapMinutes: -gap,
      });
      continue;
    }

    const needed = curr.inboundTravel?.minutes ?? 0;
    if (needed > gap) {
      issues.push({
        code: 'TRAVEL_TIME_IMPOSSIBLE',
        severity: 'error',
        dayIndex: day.dayIndex,
        fromId: prev.id,
        toId: curr.id,
        needMinutes: needed,
        haveMinutes: gap,
      });
    }
  }

  // Opening hours.
  for (const activity of day.activities) {
    const hours = activity.place?.hydrated?.openingHours ?? null;
    if (activity.startMinute === null) continue;

    if (hours === null) {
      // Only worth flagging for places where being closed ruins the visit.
      if (activity.kind === 'activity' || activity.kind === 'meal') {
        issues.push({
          code: 'HOURS_UNKNOWN',
          severity: 'warning',
          dayIndex: day.dayIndex,
          activityId: activity.id,
        });
      }
      continue;
    }

    if (weekday !== null && !isOpenAt(hours, weekday, activity.startMinute)) {
      issues.push({
        code: 'CLOSED_AT_VISIT',
        severity: 'error',
        dayIndex: day.dayIndex,
        activityId: activity.id,
        visitMinute: activity.startMinute,
      });
    }
  }

  // Unresolvable place references. Should be impossible by construction — the
  // model only ever selects from a server-supplied candidate set — so this
  // firing means something upstream is broken.
  for (const activity of day.activities) {
    if (activity.kind === 'free_time' || activity.kind === 'accommodation') continue;
    if (activity.place === null && activity.customName === null) {
      issues.push({
        code: 'UNKNOWN_PLACE',
        severity: 'error',
        dayIndex: day.dayIndex,
        activityId: activity.id,
      });
    }
  }

  // Load.
  const activeMinutes = day.activities.reduce(
    (sum, a) => sum + (a.durationMinutes ?? 0) + (a.inboundTravel?.minutes ?? 0),
    0,
  );
  if (activeMinutes > profile.maxActiveMinutes) {
    issues.push({
      code: 'OVERPACKED',
      severity: 'error',
      dayIndex: day.dayIndex,
      activeMinutes,
      limitMinutes: profile.maxActiveMinutes,
    });
  }

  const substantive = day.activities.filter(
    (a) => a.kind === 'activity' || a.kind === 'meal',
  ).length;
  if (substantive > profile.maxActivities) {
    issues.push({
      code: 'TOO_MANY_ACTIVITIES',
      severity: 'warning',
      dayIndex: day.dayIndex,
      count: substantive,
      limit: profile.maxActivities,
    });
  }
  if (substantive < 2) {
    issues.push({ code: 'UNDERFILLED', severity: 'warning', dayIndex: day.dayIndex, count: substantive });
  }
}

/**
 * The rule that stops "Day 1: Tokyo Tower, Shibuya, Shinjuku, Harajuku, teamLab,
 * Asakusa" — a list of famous names scattered across a city with no regard for
 * how you would actually get between them.
 */
function validateDayGeography(itinerary: Itinerary, day: TripDay, issues: ItineraryIssue[]): void {
  const points = day.activities
    .map((a) => a.place?.hydrated?.location ?? null)
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const travelMinutes = day.activities.reduce((sum, a) => sum + (a.inboundTravel?.minutes ?? 0), 0);
  const limit = travelLimitMinutes(itinerary.request.pace);
  if (travelMinutes > limit) {
    issues.push({
      code: 'GEOGRAPHIC_THRASH',
      severity: 'warning',
      dayIndex: day.dayIndex,
      travelMinutes,
      limitMinutes: limit,
    });
  }

  // Implausible modes: walking 12km between stops, or hailing a car for 300m.
  for (const activity of day.activities) {
    const leg = activity.inboundTravel;
    if (!leg) continue;
    const tooFarToWalk = leg.mode === 'walking' && leg.meters > 4000;
    const tooCloseToDrive =
      (leg.mode === 'driving' || leg.mode === 'rideshare') && leg.meters > 0 && leg.meters < 500;
    if (tooFarToWalk || tooCloseToDrive) {
      issues.push({
        code: 'IMPLAUSIBLE_MODE',
        severity: 'warning',
        dayIndex: day.dayIndex,
        activityId: activity.id,
        mode: leg.mode,
        meters: leg.meters,
      });
    }
  }

  // A day whose stops span an absurd radius is thrashing even if each individual
  // leg looked acceptable.
  if (points.length >= 2) {
    let maxSpan = 0;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        maxSpan = Math.max(maxSpan, haversineMeters(points[i]!, points[j]!));
      }
    }
    if (maxSpan > 60_000 && travelMinutes <= limit) {
      issues.push({
        code: 'GEOGRAPHIC_THRASH',
        severity: 'warning',
        dayIndex: day.dayIndex,
        travelMinutes,
        limitMinutes: limit,
      });
    }
  }
}

function travelLimitMinutes(pace: Itinerary['request']['pace']): number {
  switch (pace) {
    case 'relaxed':
      return 75;
    case 'balanced':
      return 110;
    case 'packed':
      return 150;
  }
}

function validateDayMeals(day: TripDay, issues: ItineraryIssue[]): void {
  const meals = day.activities.filter((a) => a.kind === 'meal');
  const hasIn = (from: number, to: number): boolean =>
    meals.some((m) => m.startMinute !== null && m.startMinute >= from && m.startMinute <= to);

  if (!hasIn(11 * 60, 15 * 60)) {
    issues.push({ code: 'MISSING_MEAL', severity: 'warning', dayIndex: day.dayIndex, meal: 'lunch' });
  }
  if (!hasIn(17 * 60, 22 * 60)) {
    issues.push({ code: 'MISSING_MEAL', severity: 'warning', dayIndex: day.dayIndex, meal: 'dinner' });
  }
}

function validateDuplicates(itinerary: Itinerary, issues: ItineraryIssue[]): void {
  const seen = new Map<string, number[]>();
  for (const day of itinerary.days) {
    for (const activity of day.activities) {
      const placeId = activity.place?.placeId;
      if (!placeId) continue;
      const days = seen.get(placeId) ?? [];
      if (!days.includes(day.dayIndex)) days.push(day.dayIndex);
      seen.set(placeId, days);
    }
  }
  for (const [placeId, dayIndexes] of seen) {
    if (dayIndexes.length > 1) {
      issues.push({
        code: 'DUPLICATE_PLACE',
        severity: 'error',
        placeId: placeId as never,
        dayIndexes,
      });
    }
  }
}

function validateInterests(
  itinerary: Itinerary,
  context: ValidationContext,
  issues: ItineraryIssue[],
): void {
  const covered = new Set<ExperienceTag>();
  for (const day of itinerary.days) {
    for (const activity of day.activities) {
      for (const tag of context.tagsByActivityId.get(activity.id) ?? []) covered.add(tag);
      for (const tag of activity.place?.tags ?? []) covered.add(tag);
    }
  }

  for (const interest of itinerary.request.interests as readonly Interest[]) {
    const satisfying = INTEREST_TAGS[interest];
    if (!satisfying.some((tag) => covered.has(tag))) {
      issues.push({ code: 'INTEREST_UNMET', severity: 'warning', interest });
    }
  }
}

function validateBudget(
  itinerary: Itinerary,
  context: ValidationContext,
  issues: ItineraryIssue[],
): void {
  const budget = itinerary.request.budgetTotal;
  const estimate = itinerary.estimatedCost?.total;
  if (budget === null || budget <= 0 || estimate === undefined) return;

  const ratio = (estimate - budget) / budget;
  if (ratio > context.budgetTolerance) {
    issues.push({
      code: 'BUDGET_EXCEEDED',
      severity: 'error',
      overBy: Math.round(estimate - budget),
      ratio,
    });
  } else if (ratio < -0.35) {
    // Well under budget is a missed opportunity, not a failure: the traveller
    // could be doing more. Warning only.
    issues.push({
      code: 'BUDGET_UNDERSPENT',
      severity: 'warning',
      underBy: Math.round(budget - estimate),
      ratio,
    });
  }
}

function addDays(iso: string, days: number): string {
  const ms = Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}
