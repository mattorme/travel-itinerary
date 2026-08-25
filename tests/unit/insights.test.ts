import { beforeEach, describe, expect, it } from 'vitest';
import { computeInsights, metersToSteps } from '@/domain/insights/insights';
import {
  makeActivity,
  makeDay,
  makeItinerary,
  makePlace,
  resetFixtureIds,
} from '../fixtures/itinerary';

const walk = (minutes: number, meters: number) =>
  ({ mode: 'walking' as const, minutes, meters, polyline: null, source: 'routes' as const });
const transit = (minutes: number, meters: number) =>
  ({ mode: 'transit' as const, minutes, meters, polyline: null, source: 'routes' as const });

beforeEach(resetFixtureIds);

describe('trip insights', () => {
  it('is defined for a trip with nothing in it', () => {
    // A half-generated trip should render a quiet panel, not crash.
    const insights = computeInsights(makeItinerary({ days: [] }));
    expect(insights.isEmpty).toBe(true);
    expect(insights.stops).toBe(0);
    expect(insights.busiestDay).toBeNull();
    expect(insights.lightestDay).toBeNull();
    expect(insights.freeStopShare).toBe(0);
  });

  it('counts only walking towards distance covered', () => {
    // Counting a train ride would make a day trip look like a hike.
    const trip = makeItinerary({
      days: [
        makeDay({
          activities: [
            makeActivity({ inboundTravel: walk(12, 900) }),
            makeActivity({ inboundTravel: transit(40, 24_000) }),
            makeActivity({ inboundTravel: walk(8, 600) }),
          ],
        }),
      ],
    });

    const insights = computeInsights(trip);
    expect(insights.walkingMeters).toBe(1500);
    expect(insights.travelMinutes).toBe(60);
  });

  it('ranks the busiest day on committed time, not stop count', () => {
    // Four long museums beat six quick coffees, which stop count gets backwards.
    const museums = makeDay({
      dayIndex: 1,
      title: 'Museums',
      activities: Array.from({ length: 4 }, () => makeActivity({ durationMinutes: 120 })),
    });
    const coffees = makeDay({
      dayIndex: 2,
      title: 'Coffees',
      activities: Array.from({ length: 6 }, () => makeActivity({ durationMinutes: 30 })),
    });

    const insights = computeInsights(
      makeItinerary({
        request: {
          ...makeItinerary().request,
          dates: { mode: 'flexible', start: null, end: null, durationDays: 2 },
        },
        days: [museums, coffees],
      }),
    );

    expect(insights.busiestDay?.title).toBe('Museums');
    expect(insights.lightestDay?.title).toBe('Coffees');
    expect(insights.busiestDay?.stops).toBeLessThan(insights.lightestDay!.stops);
  });

  it('counts a revisited place once', () => {
    const shared = makePlace({ id: 'same' });
    const trip = makeItinerary({
      days: [
        makeDay({
          activities: [makeActivity({ place: shared }), makeActivity({ place: shared })],
        }),
      ],
    });
    const insights = computeInsights(trip);
    expect(insights.stops).toBe(2);
    expect(insights.distinctPlaces).toBe(1);
  });

  it('reports the share of stops that cost nothing', () => {
    const trip = makeItinerary({
      days: [
        makeDay({
          activities: [
            makeActivity({ estimatedCost: 0 }),
            makeActivity({ estimatedCost: 0 }),
            makeActivity({ estimatedCost: 40 }),
            makeActivity({ estimatedCost: 12 }),
          ],
        }),
      ],
    });
    expect(computeInsights(trip).freeStopShare).toBe(0.5);
  });

  it('ignores activities with no cost rather than treating them as free', () => {
    // An unpriced stop is unknown, not zero — averaging it in as free would
    // quietly understate the trip.
    const trip = makeItinerary({
      days: [
        makeDay({
          activities: [
            makeActivity({ estimatedCost: null }),
            makeActivity({ estimatedCost: 30 }),
          ],
        }),
      ],
    });
    expect(computeInsights(trip).freeStopShare).toBe(0);
  });

  it('finds the earliest start and latest finish across the whole trip', () => {
    const trip = makeItinerary({
      request: {
        ...makeItinerary().request,
        dates: { mode: 'flexible', start: null, end: null, durationDays: 2 },
      },
      days: [
        makeDay({ dayIndex: 1, activities: [makeActivity({ startMinute: 9 * 60, endMinute: 10 * 60 })] }),
        makeDay({ dayIndex: 2, activities: [makeActivity({ startMinute: 7 * 60, endMinute: 22 * 60 })] }),
      ],
    });
    const insights = computeInsights(trip);
    expect(insights.earliestStart).toBe(7 * 60);
    expect(insights.latestFinish).toBe(22 * 60);
  });

  it('has no lightest day when there is only one day', () => {
    // Calling the only day both the busiest and the lightest reads as a bug.
    const insights = computeInsights(
      makeItinerary({ days: [makeDay({ activities: [makeActivity()] })] }),
    );
    expect(insights.busiestDay).not.toBeNull();
    expect(insights.lightestDay).toBeNull();
  });

  it('converts distance to a step count people have intuition for', () => {
    expect(metersToSteps(7200)).toBe(10_000);
    expect(metersToSteps(0)).toBe(0);
  });
});
