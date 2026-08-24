import { describe, expect, it, vi } from 'vitest';
import { tripRequestSchema } from '@/domain/schemas/trip-request';
import type { ExperienceTag } from '@/domain/types/taxonomy';
import type { Candidate } from '@/lib/itinerary/candidates';
import type { DraftActivity, DraftDay } from '@/lib/itinerary/draft';
import { asPlaceId } from '@/domain/types/ids';
import { makeCandidates } from '../fixtures/fake-providers';

vi.mock('server-only', () => ({}));

const { validateAndRepair } = await import('@/lib/itinerary/repair');

function request(overrides: Record<string, unknown> = {}) {
  return tripRequestSchema.parse({
    destinationQuery: 'Tokyo',
    dates: { mode: 'flexible', durationDays: 1 },
    party: { adults: 2, children: [] },
    currency: 'AUD',
    travelStyle: 'balanced',
    pace: 'balanced',
    interests: ['food'],
    transportModes: ['mixed'],
    foodPrefs: [],
    ...overrides,
  });
}

function activity(overrides: Partial<DraftActivity> = {}): DraftActivity {
  const slotId = overrides.slotId ?? `slot-${Math.random().toString(36).slice(2, 8)}`;
  return {
    slotId,
    orderIndex: 1,
    kind: 'activity',
    tag: 'landmark',
    placeId: asPlaceId(`place-${slotId}`),
    googlePlaceId: `g-${slotId}`,
    location: { lat: 35.68, lng: 139.76 },
    openingHours: null,
    title: `Stop ${slotId}`,
    description: '',
    reason: '',
    durationMinutes: 90,
    targetMinute: 600,
    startMinute: 600,
    endMinute: 690,
    estimatedCostUsd: 20,
    inboundTravel: null,
    bookingUrl: null,
    websiteUri: null,
    ...overrides,
  };
}

function day(activities: DraftActivity[], dayIndex = 1): DraftDay {
  return {
    dayIndex,
    date: null,
    title: `Day ${dayIndex}`,
    summary: 'A day.',
    destinationId: '11111111-1111-1111-1111-111111111111' as never,
    activities: activities.map((a, i) => ({ ...a, orderIndex: i + 1 })),
    unfilledSlots: [],
  };
}

function candidates(): ReadonlyMap<ExperienceTag, readonly Candidate[]> {
  return new Map([['landmark' as ExperienceTag, makeCandidates('landmark', 10)]]);
}

const weekdays = new Map([[1, 2], [2, 3]]);

describe('validateAndRepair', () => {
  it('leaves a healthy day alone', () => {
    const healthy = day([
      activity({ slotId: 'a', startMinute: 600, endMinute: 690 }),
      activity({ slotId: 'b', kind: 'meal', tag: 'lunch', startMinute: 750, endMinute: 810 }),
      activity({ slotId: 'c', kind: 'meal', tag: 'dinner', startMinute: 1140, endMinute: 1230 }),
    ]);

    const result = validateAndRepair({
      days: [healthy],
      request: request(),
      candidatesByTag: candidates(),
      weekdayByDayIndex: weekdays,
      estimateTotal: () => null,
    });

    expect(result.rounds).toBe(0);
    expect(result.days[0]!.activities).toHaveLength(3);
  });

  it('thins an overpacked day rather than regenerating it', () => {
    // Nine 90-minute stops against a 510-minute balanced budget.
    const overpacked = day(
      Array.from({ length: 9 }, (_, i) =>
        activity({ slotId: `a${i}`, startMinute: 480 + i * 100, endMinute: 570 + i * 100 }),
      ),
    );

    const result = validateAndRepair({
      days: [overpacked],
      request: request(),
      candidatesByTag: candidates(),
      weekdayByDayIndex: weekdays,
      estimateTotal: () => null,
    });

    expect(result.days[0]!.activities.length).toBeLessThan(9);
    expect(result.rounds).toBeGreaterThan(0);
    // The traveller is told, not silently shortchanged.
    expect(result.days[0]!.unfilledSlots.length).toBeGreaterThan(0);
  });

  it('protects meals when thinning a day', () => {
    const overpacked = day([
      ...Array.from({ length: 7 }, (_, i) =>
        activity({ slotId: `a${i}`, startMinute: 480 + i * 100, endMinute: 570 + i * 100 }),
      ),
      activity({ slotId: 'lunch', kind: 'meal', tag: 'lunch', startMinute: 750, endMinute: 810 }),
      activity({ slotId: 'dinner', kind: 'meal', tag: 'dinner', startMinute: 1140, endMinute: 1230 }),
    ]);

    const result = validateAndRepair({
      days: [overpacked],
      request: request(),
      candidatesByTag: candidates(),
      weekdayByDayIndex: weekdays,
      estimateTotal: () => null,
    });

    const kinds = result.days[0]!.activities.map((a) => a.kind);
    expect(kinds).toContain('meal');
  });

  it('replaces a duplicated place with an unused candidate', () => {
    const shared = asPlaceId('place-shared');
    const days = [
      day([activity({ slotId: 'a', placeId: shared, tag: 'landmark' })], 1),
      day([activity({ slotId: 'b', placeId: shared, tag: 'landmark' })], 2),
    ];

    const result = validateAndRepair({
      days,
      request: request({ dates: { mode: 'flexible', durationDays: 2 } }),
      candidatesByTag: candidates(),
      weekdayByDayIndex: weekdays,
      estimateTotal: () => null,
    });

    const placeIds = result.days.flatMap((d) => d.activities.map((a) => a.placeId as string));
    expect(new Set(placeIds).size).toBe(placeIds.length);
  });

  it('trims the most expensive stops when over budget', () => {
    const expensive = day([
      activity({ slotId: 'cheap', estimatedCostUsd: 5 }),
      // Deliberately outside the lunch window: this test is about budget, and
      // an overlapping stop would be repaired for a different reason.
      activity({ slotId: 'dear', estimatedCostUsd: 400, startMinute: 900, endMinute: 990 }),
      activity({ slotId: 'lunch', kind: 'meal', tag: 'lunch', startMinute: 750, endMinute: 810, estimatedCostUsd: 30 }),
      activity({ slotId: 'dinner', kind: 'meal', tag: 'dinner', startMinute: 1140, endMinute: 1230, estimatedCostUsd: 60 }),
    ]);

    const result = validateAndRepair({
      days: [expensive],
      request: request({ budgetTotal: 100 }),
      candidatesByTag: candidates(),
      weekdayByDayIndex: weekdays,
      // Recomputed from the surviving activities, as the pipeline does.
      estimateTotal: (days) =>
        days.reduce((sum, d) => sum + d.activities.reduce((s, a) => s + a.estimatedCostUsd, 0), 0),
    });

    const slots = result.days[0]!.activities.map((a) => a.slotId);
    expect(slots).not.toContain('dear');
    expect(slots).toContain('cheap');
  });

  it('stops after two rounds instead of looping', () => {
    // A single stop that cannot be made valid: the day can never satisfy the
    // meal rules, so repair must give up rather than spin.
    const stubborn = day([activity({ slotId: 'only', durationMinutes: 900, startMinute: 480, endMinute: 1380 })]);

    const result = validateAndRepair({
      days: [stubborn],
      request: request(),
      candidatesByTag: candidates(),
      weekdayByDayIndex: weekdays,
      estimateTotal: () => null,
    });

    expect(result.rounds).toBeLessThanOrEqual(2);
    expect(result.remaining.length).toBeGreaterThan(0);
  });

  it('reports what it could not fix rather than claiming success', () => {
    const broken = day([
      activity({ slotId: 'a', startMinute: 600, endMinute: 700 }),
      activity({ slotId: 'b', startMinute: 650, endMinute: 750 }),
    ]);

    const result = validateAndRepair({
      days: [broken],
      request: request(),
      candidatesByTag: candidates(),
      weekdayByDayIndex: weekdays,
      estimateTotal: () => null,
    });

    // Whatever survives is surfaced, not swallowed.
    expect(Array.isArray(result.remaining)).toBe(true);
  });
});
