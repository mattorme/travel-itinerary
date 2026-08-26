import type { ItineraryIssue } from '@/domain/validation/issues';
import { describeIssue } from '@/domain/validation/issues';
import { validateItinerary, DEFAULT_BUDGET_TOLERANCE } from '@/domain/validation/validate';
import type { Itinerary, TripDay } from '@/domain/types/itinerary';
import {
  asActivityId,
  asDestinationId,
  asPlaceId,
  asTripDayId,
  asTripId,
} from '@/domain/types/ids';
import type { ExperienceTag } from '@/domain/types/taxonomy';
import type { TripRequestParsed } from '@/domain/schemas/trip-request';
import { PACE_PROFILES } from '@/domain/sequencing/schedule';
import type { Candidate } from './candidates';
import type { DraftActivity, DraftDay } from './draft';

/**
 * Validation and repair.
 *
 * Most issues have a deterministic fix and must never cost a model call: an
 * overpacked day drops its weakest stop, a duplicate is swapped for the next
 * candidate, an over-budget trip trades down. Regenerating a whole trip because
 * one day ran twenty minutes long is the expensive mistake this exists to
 * prevent.
 *
 * Anything that survives two rounds is surfaced honestly to the traveller rather
 * than hidden — "we couldn't fit this" is useful information.
 *
 * See docs/ARCHITECTURE.md §8.
 */

export interface RepairResult {
  readonly days: readonly DraftDay[];
  readonly resolved: readonly ItineraryIssue[];
  readonly remaining: readonly ItineraryIssue[];
  readonly rounds: number;
}

const MAX_ROUNDS = 2;

export function validateAndRepair(args: {
  days: readonly DraftDay[];
  request: TripRequestParsed;
  candidatesByTag: ReadonlyMap<ExperienceTag, readonly Candidate[]>;
  weekdayByDayIndex: ReadonlyMap<number, number>;
  /**
   * Recomputed each round, not passed as a fixed number: a stale total makes the
   * budget rule fire again on the trip it just trimmed, and the second round
   * cuts something that was never over budget.
   */
  estimateTotal: (days: readonly DraftDay[]) => number | null;
}): RepairResult {
  let days = [...args.days];
  const resolved: ItineraryIssue[] = [];
  let rounds = 0;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const issues = validate(days, args);
    const errors = issues.filter((i) => i.severity === 'error');
    if (errors.length === 0) {
      rounds = round - 1;
      return { days, resolved, remaining: issues, rounds };
    }

    rounds = round;
    const before = serialise(days);
    days = applyFixes(days, errors, args);

    // A round that changed nothing will not change anything next time either.
    if (serialise(days) === before) break;
    resolved.push(...errors);
  }

  const remaining = validate(days, args);
  return {
    days,
    resolved: resolved.filter((r) => !remaining.some((x) => x.code === r.code)),
    remaining,
    rounds,
  };
}

// ---------------------------------------------------------------------------

function validate(
  days: readonly DraftDay[],
  args: {
    request: TripRequestParsed;
    weekdayByDayIndex: ReadonlyMap<number, number>;
    estimateTotal: (days: readonly DraftDay[]) => number | null;
  },
): readonly ItineraryIssue[] {
  return validateItinerary(toItineraryView(days, args.request, args.estimateTotal(days)), {
    weekdayByDayIndex: args.weekdayByDayIndex,
    tagsByActivityId: new Map(
      days.flatMap((d) => d.activities.map((a) => [a.slotId, [a.tag]] as const)),
    ),
    budgetTolerance: DEFAULT_BUDGET_TOLERANCE,
  });
}

function applyFixes(
  days: readonly DraftDay[],
  errors: readonly ItineraryIssue[],
  args: {
    request: TripRequestParsed;
    candidatesByTag: ReadonlyMap<ExperienceTag, readonly Candidate[]>;
  },
): DraftDay[] {
  let next = [...days];

  for (const issue of errors) {
    switch (issue.code) {
      case 'OVERPACKED':
      case 'OVERLAP':
      case 'TRAVEL_TIME_IMPOSSIBLE': {
        // All three are the same shape of problem: the day is trying to hold
        // more than it can. Drop the weakest unlocked stop and let the
        // scheduler re-lay the rest.
        const dayIndex = issue.dayIndex;
        next = next.map((day) =>
          day.dayIndex === dayIndex ? dropWeakest(day) : day,
        );
        break;
      }

      case 'DUPLICATE_PLACE': {
        // Keep the first appearance, swap the later ones for the next-best
        // candidate of the same tag that is not already used anywhere.
        const used = new Set(next.flatMap((d) => d.activities.map((a) => a.placeId as string)));
        let seen = false;
        next = next.map((day) => {
          if (!issue.dayIndexes.includes(day.dayIndex)) return day;
          const activities = day.activities.flatMap((activity) => {
            if ((activity.placeId as string) !== (issue.placeId as string)) return [activity];
            if (!seen) {
              seen = true;
              return [activity];
            }
            const replacement = nextCandidate(args.candidatesByTag, activity.tag, used);
            if (!replacement) return [];
            used.add(replacement.placeId as string);
            return [swapPlace(activity, replacement)];
          });
          return { ...day, activities: reindex(activities) };
        });
        break;
      }

      case 'BUDGET_EXCEEDED': {
        next = trimToBudget(next, issue.overBy);
        break;
      }

      case 'CLOSED_AT_VISIT':
      case 'UNKNOWN_PLACE': {
        next = next.map((day) =>
          day.dayIndex === issue.dayIndex
            ? {
                ...day,
                activities: reindex(
                  day.activities.filter((a) => a.slotId !== issueActivitySlot(day, issue)),
                ),
                unfilledSlots: [
                  ...day.unfilledSlots,
                  { slotId: 'repaired', why: describeIssue(issue) },
                ],
              }
            : day,
        );
        break;
      }

      case 'DURATION_MISMATCH':
      case 'DATE_MISMATCH':
        // Structural, and already guarded upstream in buildPlanShape. Reaching
        // here means something is wrong that a repair pass cannot fix.
        break;

      default:
        break;
    }
  }

  return next;
}

/**
 * The stop whose loss buys the day the most room back.
 *
 * Meals are protected — a day without lunch is not a fixed day. Among the rest,
 * the biggest total time sink goes first: its own duration plus the journey to
 * reach it, since dropping it removes both. Cost breaks any remaining tie, on
 * the grounds that an expensive stop is the one most likely to be replaceable
 * by something else the traveller would enjoy as much.
 */
function dropWeakest(day: DraftDay): DraftDay {
  const droppable = day.activities.filter((a) => a.kind !== 'meal');
  const pool = droppable.length > 0 ? droppable : day.activities;
  if (pool.length <= 1) return day;

  const sink = (a: DraftActivity): number => a.durationMinutes + (a.inboundTravel?.minutes ?? 0);
  const victim = [...pool].sort((a, b) => sink(b) - sink(a) || b.estimatedCostUsd - a.estimatedCostUsd)[0];
  if (!victim) return day;

  return {
    ...day,
    activities: reindex(day.activities.filter((a) => a.slotId !== victim.slotId)),
    unfilledSlots: [
      ...day.unfilledSlots,
      { slotId: victim.slotId, why: `We dropped ${victim.title}. The day was too full to do it justice.` },
    ],
  };
}

/** Trade down on cost, cheapest-first, until the overspend is covered. */
function trimToBudget(days: readonly DraftDay[], overBy: number): DraftDay[] {
  let remaining = overBy;
  const next = days.map((d) => ({ ...d, activities: [...d.activities] }));

  const ranked = next
    .flatMap((day) => day.activities.map((activity) => ({ day, activity })))
    .filter(({ activity }) => activity.kind !== 'meal')
    .sort((a, b) => b.activity.estimatedCostUsd - a.activity.estimatedCostUsd);

  for (const { day, activity } of ranked) {
    if (remaining <= 0) break;
    if (activity.estimatedCostUsd <= 0) continue;
    // Only remove things that are genuinely expensive; stripping every free walk
    // would not help and would gut the day.
    day.activities = day.activities.filter((a) => a.slotId !== activity.slotId);
    day.unfilledSlots = [
      ...day.unfilledSlots,
      { slotId: activity.slotId, why: `We left out ${activity.title} to stay closer to your budget.` },
    ];
    remaining -= activity.estimatedCostUsd;
  }

  return next.map((day) => ({ ...day, activities: reindex(day.activities) }));
}

function nextCandidate(
  candidatesByTag: ReadonlyMap<ExperienceTag, readonly Candidate[]>,
  tag: ExperienceTag,
  used: ReadonlySet<string>,
): Candidate | null {
  const pool = candidatesByTag.get(tag) ?? [];
  return pool.find((c) => !used.has(c.placeId as string)) ?? null;
}

function swapPlace(activity: DraftActivity, replacement: Candidate): DraftActivity {
  return {
    ...activity,
    placeId: replacement.placeId,
    googlePlaceId: replacement.googlePlaceId,
    location: replacement.location,
    openingHours: replacement.hydration.openingHours,
    title: replacement.hydration.displayName,
    websiteUri: replacement.hydration.websiteUri,
    // Travel is now wrong; the caller re-routes and re-times after a repair pass.
    inboundTravel: null,
    startMinute: null,
    endMinute: null,
  };
}

function reindex(activities: readonly DraftActivity[]): DraftActivity[] {
  return activities.map((a, i) => ({ ...a, orderIndex: i + 1 }));
}

function issueActivitySlot(day: DraftDay, issue: ItineraryIssue): string | null {
  if (!('activityId' in issue)) return null;
  return day.activities.find((a) => a.slotId === (issue.activityId as string))?.slotId ?? null;
}

function serialise(days: readonly DraftDay[]): string {
  return days
    .map((d) => `${d.dayIndex}:${d.activities.map((a) => `${a.slotId}@${a.startMinute}`).join(',')}`)
    .join('|');
}

/**
 * Adapts a draft into the shape the pure validator expects.
 *
 * The validator works on the domain model so that the same rules apply to a
 * freshly generated trip and to one a user has edited — there is exactly one
 * definition of "valid" in the codebase.
 */
function toItineraryView(
  days: readonly DraftDay[],
  request: TripRequestParsed,
  estimatedTotal: number | null,
): Itinerary {
  const profile = PACE_PROFILES[request.pace];
  void profile;

  const domainDays: TripDay[] = days.map((day) => ({
    id: asTripDayId(`day-${day.dayIndex}`),
    dayIndex: day.dayIndex,
    date: day.date,
    title: day.title,
    summary: day.summary,
    destinationId: asDestinationId(day.destinationId),
    estimatedCost: null,
    notes: null,
    activities: day.activities.map((a) => ({
      id: asActivityId(a.slotId),
      orderIndex: a.orderIndex,
      kind: a.kind,
      place: {
        placeId: asPlaceId(a.placeId),
        googlePlaceId: a.googlePlaceId,
        tags: [a.tag],
        hydrated: {
          displayName: a.title,
          formattedAddress: null,
          location: a.location,
          rating: null,
          userRatingCount: null,
          priceLevel: null,
          openingHours: a.openingHours,
          websiteUri: a.websiteUri,
          googleMapsUri: null,
          editorialSummary: null,
          photoNames: [],
          businessStatus: 'OPERATIONAL',
        },
      },
      customName: null,
      title: a.title,
      description: a.description,
      reason: a.reason,
      startMinute: a.startMinute,
      endMinute: a.endMinute,
      durationMinutes: a.durationMinutes,
      estimatedCost: a.estimatedCostUsd,
      costBasis: 'modelled' as const,
      inboundTravel: a.inboundTravel,
      bookingUrl: null,
      isLocked: false,
      source: 'generated' as const,
    })),
  }));

  return {
    id: asTripId('draft'),
    slug: 'draft',
    title: 'draft',
    subtitle: null,
    status: 'generating',
    visibility: 'private',
    request: {
      destinationQuery: request.destinationQuery,
      destinationId: null,
      dates: request.dates,
      party: request.party,
      currency: request.currency,
      budgetTotal: request.budgetTotal,
      budgetDaily: request.budgetDaily,
      travelStyle: request.travelStyle,
      pace: request.pace,
      interests: request.interests,
      transportModes: request.transportModes,
      foodPrefs: request.foodPrefs,
      accommodation: request.accommodation,
      notes: request.notes,
    },
    summary: null,
    highlights: [],
    destinations: [],
    days: domainDays,
    estimatedCost:
      estimatedTotal === null
        ? null
        : {
            accommodation: 0,
            food: 0,
            activities: estimatedTotal,
            localTransport: 0,
            buffer: 0,
            total: estimatedTotal,
            excludesFlights: true,
          },
    heroImageUrl: null,
    heroCredit: null,
    lineage: {
      forkedFromTripId: null,
      forkedFromVersion: null,
      rootTripId: null,
      originCreatorUsername: null,
      originTitle: null,
    },
    counters: { likes: 0, saves: 0, views: 0, clones: 0, shares: 0 },
    isIndexable: false,
    creator: null,
    version: 1,
    publishedAt: null,
    updatedAt: new Date().toISOString(),
  };
}
