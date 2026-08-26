import type { CostBreakdown, Itinerary, TripDay } from '../types/itinerary';
import type { TransportMode } from '../types/taxonomy';
import {
  accommodationPerNightUsd,
  bufferRate,
  legCostUsd,
  type CostInputs,
} from './model';

export interface DayCost {
  readonly dayIndex: number;
  readonly food: number;
  readonly activities: number;
  readonly localTransport: number;
  readonly total: number;
}

/**
 * Sums the per-activity figures already attached during generation, adds the
 * nightly accommodation line and a contingency buffer.
 *
 * Deliberately additive rather than re-deriving: an activity whose cost the user
 * has edited (`costBasis: 'user'`) must survive re-estimation.
 */
export function estimateTripCost(
  days: readonly TripDay[],
  input: CostInputs,
  fxRate: number,
): { breakdown: CostBreakdown; perDay: readonly DayCost[] } {
  const perDay: DayCost[] = [];

  let food = 0;
  let activities = 0;
  let localTransport = 0;

  for (const day of days) {
    let dayFood = 0;
    let dayActivities = 0;
    let dayTransport = 0;

    for (const activity of day.activities) {
      const cost = activity.estimatedCost ?? 0;
      if (activity.kind === 'meal') dayFood += cost;
      else if (activity.kind !== 'accommodation') dayActivities += cost;

      const leg = activity.inboundTravel;
      if (leg) {
        dayTransport += legCostUsd(leg.mode as TransportMode, leg.meters, input) * fxRate;
      }
    }

    food += dayFood;
    activities += dayActivities;
    localTransport += dayTransport;

    perDay.push({
      dayIndex: day.dayIndex,
      food: roundMoney(dayFood),
      activities: roundMoney(dayActivities),
      localTransport: roundMoney(dayTransport),
      total: roundMoney(dayFood + dayActivities + dayTransport),
    });
  }

  const accommodation = accommodationPerNightUsd(input) * input.nights * fxRate;
  const subtotal = accommodation + food + activities + localTransport;
  const buffer = subtotal * bufferRate(input);

  return {
    breakdown: {
      accommodation: roundMoney(accommodation),
      food: roundMoney(food),
      activities: roundMoney(activities),
      localTransport: roundMoney(localTransport),
      buffer: roundMoney(buffer),
      total: roundMoney(subtotal + buffer),
      excludesFlights: true,
    },
    perDay,
  };
}

/**
 * How far the estimate sits from the stated budget.
 * Positive = over budget. Null when no budget was given.
 */
export function budgetDelta(
  itinerary: Pick<Itinerary, 'request' | 'estimatedCost'>,
): { absolute: number; ratio: number } | null {
  const budget = itinerary.request.budgetTotal;
  const estimate = itinerary.estimatedCost?.total;
  if (budget === null || budget <= 0 || estimate === undefined) return null;
  return { absolute: estimate - budget, ratio: (estimate - budget) / budget };
}

/** Money is stored to the cent; every figure in the product goes through here. */
export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
