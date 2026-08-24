import { describe, expect, it, beforeEach } from 'vitest';
import { validateItinerary, DEFAULT_BUDGET_TOLERANCE } from '@/domain/validation/validate';
import type { ValidationContext } from '@/domain/validation/validate';
import type { ItineraryIssue, IssueCode } from '@/domain/validation/issues';
import {
  CLOSED_MONDAYS,
  makeActivity,
  makeDay,
  makeItinerary,
  makePlace,
  resetFixtureIds,
} from '../fixtures/itinerary';

const ctx = (weekday = 2): ValidationContext => ({
  weekdayByDayIndex: new Map([[1, weekday]]),
  tagsByActivityId: new Map(),
  budgetTolerance: DEFAULT_BUDGET_TOLERANCE,
});

const codes = (issues: readonly ItineraryIssue[]): IssueCode[] => issues.map((i) => i.code);

beforeEach(resetFixtureIds);

describe('schedule validation', () => {
  it('flags overlapping activities with the overlap amount', () => {
    const day = makeDay({
      activities: [
        makeActivity({ startMinute: 600, endMinute: 720, durationMinutes: 120 }),
        makeActivity({ startMinute: 690, endMinute: 780, durationMinutes: 90 }),
      ],
    });
    const issues = validateItinerary(makeItinerary({ days: [day] }), ctx());
    const overlap = issues.find((i) => i.code === 'OVERLAP');
    expect(overlap).toBeDefined();
    expect(overlap && 'overlapMinutes' in overlap && overlap.overlapMinutes).toBe(30);
  });

  it('accepts a gap that exactly fits the travel time, and rejects one minute less', () => {
    const build = (gap: number) =>
      makeDay({
        activities: [
          makeActivity({ startMinute: 600, endMinute: 660, durationMinutes: 60 }),
          makeActivity({
            startMinute: 660 + gap,
            endMinute: 720 + gap,
            durationMinutes: 60,
            inboundTravel: { mode: 'transit', minutes: 25, meters: 6000, polyline: null, source: 'routes' },
          }),
        ],
      });

    expect(codes(validateItinerary(makeItinerary({ days: [build(25)] }), ctx())))
      .not.toContain('TRAVEL_TIME_IMPOSSIBLE');
    expect(codes(validateItinerary(makeItinerary({ days: [build(24)] }), ctx())))
      .toContain('TRAVEL_TIME_IMPOSSIBLE');
  });

  it('flags a visit while the venue is closed, using the day of week', () => {
    const closedPlace = makePlace({ openingHours: CLOSED_MONDAYS });
    const day = makeDay({
      activities: [makeActivity({ place: closedPlace, startMinute: 10 * 60, endMinute: 11 * 60 })],
    });
    const trip = makeItinerary({ days: [day] });

    // Monday (1): closed.
    expect(codes(validateItinerary(trip, ctx(1)))).toContain('CLOSED_AT_VISIT');
    // Tuesday (2): open.
    expect(codes(validateItinerary(trip, ctx(2)))).not.toContain('CLOSED_AT_VISIT');
  });

  it('treats unknown opening hours as a warning, not a blocker', () => {
    const day = makeDay({ activities: [makeActivity()] });
    const issues = validateItinerary(makeItinerary({ days: [day] }), ctx());
    const hoursIssue = issues.find((i) => i.code === 'HOURS_UNKNOWN');
    expect(hoursIssue?.severity).toBe('warning');
  });

  it('flags a day that exceeds the pace budget', () => {
    const activities = Array.from({ length: 6 }, (_, i) =>
      makeActivity({
        startMinute: 8 * 60 + i * 120,
        endMinute: 8 * 60 + i * 120 + 110,
        durationMinutes: 110,
      }),
    );
    const trip = makeItinerary({ days: [makeDay({ activities })] });
    // 6 x 110 = 660 min, over the 510-minute 'balanced' limit.
    expect(codes(validateItinerary(trip, ctx()))).toContain('OVERPACKED');
  });
});

describe('geography validation', () => {
  it('flags walking legs that are too long to walk', () => {
    const day = makeDay({
      activities: [
        makeActivity({
          inboundTravel: { mode: 'walking', minutes: 90, meters: 7000, polyline: null, source: 'estimated' },
        }),
      ],
    });
    expect(codes(validateItinerary(makeItinerary({ days: [day] }), ctx()))).toContain(
      'IMPLAUSIBLE_MODE',
    );
  });

  it('flags a rideshare hailed for 300 metres', () => {
    const day = makeDay({
      activities: [
        makeActivity({
          inboundTravel: { mode: 'rideshare', minutes: 4, meters: 300, polyline: null, source: 'routes' },
        }),
      ],
    });
    expect(codes(validateItinerary(makeItinerary({ days: [day] }), ctx()))).toContain(
      'IMPLAUSIBLE_MODE',
    );
  });

  it('flags a day scattered across a whole prefecture', () => {
    const day = makeDay({
      activities: [
        makeActivity({ place: makePlace({ lat: 35.68, lng: 139.76 }) }),  // Tokyo
        makeActivity({ place: makePlace({ lat: 35.44, lng: 139.64 }) }),  // Yokohama
        makeActivity({ place: makePlace({ lat: 36.56, lng: 139.88 }) }),  // Nikko, ~100km away
      ],
    });
    expect(codes(validateItinerary(makeItinerary({ days: [day] }), ctx()))).toContain(
      'GEOGRAPHIC_THRASH',
    );
  });

  it('does not flag a tight, walkable day', () => {
    const day = makeDay({
      activities: [
        makeActivity({ place: makePlace({ lat: 35.6812, lng: 139.7671 }) }),
        makeActivity({
          place: makePlace({ lat: 35.6852, lng: 139.7528 }),
          startMinute: 13 * 60,
          endMinute: 14 * 60,
          inboundTravel: { mode: 'walking', minutes: 18, meters: 1400, polyline: null, source: 'routes' },
        }),
      ],
    });
    expect(codes(validateItinerary(makeItinerary({ days: [day] }), ctx()))).not.toContain(
      'GEOGRAPHIC_THRASH',
    );
  });
});

describe('trip-level validation', () => {
  it('flags the same place appearing on two days', () => {
    const shared = makePlace({ id: 'shared' });
    const trip = makeItinerary({
      request: {
        ...makeItinerary().request,
        dates: { mode: 'exact', start: '2026-09-01', end: '2026-09-02', durationDays: 2 },
      },
      days: [
        makeDay({ dayIndex: 1, date: '2026-09-01', activities: [makeActivity({ place: shared })] }),
        makeDay({ dayIndex: 2, date: '2026-09-02', activities: [makeActivity({ place: shared })] }),
      ],
    });
    const dupe = validateItinerary(trip, ctx()).find((i) => i.code === 'DUPLICATE_PLACE');
    expect(dupe).toBeDefined();
    expect(dupe && 'dayIndexes' in dupe && dupe.dayIndexes).toEqual([1, 2]);
  });

  it('flags a day count that does not match the request', () => {
    const trip = makeItinerary({
      request: {
        ...makeItinerary().request,
        dates: { mode: 'flexible', start: null, end: null, durationDays: 5 },
      },
      days: [makeDay()],
    });
    const issue = validateItinerary(trip, ctx()).find((i) => i.code === 'DURATION_MISMATCH');
    expect(issue).toMatchObject({ expected: 5, actual: 1 });
  });

  it('flags a day dated out of sequence', () => {
    const trip = makeItinerary({ days: [makeDay({ dayIndex: 1, date: '2026-09-04' })] });
    expect(codes(validateItinerary(trip, ctx()))).toContain('DATE_MISMATCH');
  });

  it('flags an interest with nothing covering it', () => {
    const trip = makeItinerary({
      request: { ...makeItinerary().request, interests: ['nightlife'] },
      days: [makeDay({ activities: [makeActivity({ place: makePlace({ tags: ['museum'] }) })] })],
    });
    const issue = validateItinerary(trip, ctx()).find((i) => i.code === 'INTEREST_UNMET');
    expect(issue).toMatchObject({ interest: 'nightlife' });
  });

  it('accepts an interest covered by any of its satisfying tags', () => {
    const trip = makeItinerary({
      request: { ...makeItinerary().request, interests: ['history'] },
      days: [makeDay({ activities: [makeActivity({ place: makePlace({ tags: ['temple_shrine'] }) })] })],
    });
    expect(codes(validateItinerary(trip, ctx()))).not.toContain('INTEREST_UNMET');
  });
});

describe('budget validation', () => {
  const withBudget = (budget: number, total: number) =>
    makeItinerary({
      request: { ...makeItinerary().request, budgetTotal: budget, budgetDaily: budget },
      estimatedCost: {
        accommodation: 0, food: 0, activities: total, localTransport: 0,
        buffer: 0, total, excludesFlights: true,
      },
      days: [makeDay({ activities: [makeActivity()] })],
    });

  it('accepts an estimate inside the tolerance band', () => {
    expect(codes(validateItinerary(withBudget(1000, 1140), ctx()))).not.toContain('BUDGET_EXCEEDED');
  });

  it('flags an estimate outside the tolerance band', () => {
    const issue = validateItinerary(withBudget(1000, 1300), ctx()).find(
      (i) => i.code === 'BUDGET_EXCEEDED',
    );
    expect(issue).toMatchObject({ overBy: 300 });
  });

  it('treats a large underspend as an opportunity, not an error', () => {
    const issue = validateItinerary(withBudget(1000, 500), ctx()).find(
      (i) => i.code === 'BUDGET_UNDERSPENT',
    );
    expect(issue?.severity).toBe('warning');
  });

  it('says nothing when no budget was given', () => {
    const trip = makeItinerary({ days: [makeDay({ activities: [makeActivity()] })] });
    expect(codes(validateItinerary(trip, ctx()))).not.toContain('BUDGET_EXCEEDED');
  });
});
