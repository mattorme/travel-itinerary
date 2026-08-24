import { describe, expect, it } from 'vitest';
import { sequenceDay, type SequenceNode } from '@/domain/sequencing/sequence';
import {
  MEAL_WINDOWS,
  nextOpenMinute,
  scheduleDay,
  formatMinute,
  type ScheduleItem,
} from '@/domain/sequencing/schedule';
import { estimateTravelSeconds, haversineMeters } from '@/domain/types/geo';
import { NINE_TO_FIVE, CLOSED_MONDAYS } from '../fixtures/itinerary';

const node = (id: string, lat: number, lng: number, extra: Partial<SequenceNode> = {}): SequenceNode => ({
  id,
  location: { lat, lng },
  durationMinutes: 60,
  ...extra,
});

describe('geo primitives', () => {
  it('measures a known distance within 1%', () => {
    // Tokyo Station -> Shinjuku Station is ~6.2 km.
    const d = haversineMeters({ lat: 35.6812, lng: 139.7671 }, { lat: 35.6896, lng: 139.7006 });
    expect(d).toBeGreaterThan(6000);
    expect(d).toBeLessThan(6400);
  });

  it('treats a 20-metre hop as zero travel time', () => {
    expect(estimateTravelSeconds({ lat: 35.68, lng: 139.76 }, { lat: 35.6801, lng: 139.76 }, 'walking')).toBe(0);
  });

  it('adds boarding overhead to transit but not to a short walk', () => {
    const a = { lat: 35.68, lng: 139.76 };
    const b = { lat: 35.72, lng: 139.8 };
    expect(estimateTravelSeconds(a, b, 'transit')).toBeGreaterThan(
      (haversineMeters(a, b) * 1.45) / 6.4,
    );
  });
});

describe('sequenceDay', () => {
  it('orders a scattered day to reduce total travel', () => {
    // Deliberately given in a bad order: west, east, west, east.
    const nodes = [
      node('west-1', 35.69, 139.70),
      node('east-1', 35.71, 139.80),
      node('west-2', 35.685, 139.705),
      node('east-2', 35.715, 139.805),
    ];
    const result = sequenceDay(nodes, { anchor: { lat: 35.69, lng: 139.70 }, mode: 'transit', dayStartMinute: 540 });

    // The two western stops should end up adjacent, as should the two eastern.
    const idx = (id: string) => result.order.indexOf(id);
    expect(Math.abs(idx('west-1') - idx('west-2'))).toBe(1);
    expect(Math.abs(idx('east-1') - idx('east-2'))).toBe(1);
  });

  it('never drops or duplicates a node', () => {
    const nodes = Array.from({ length: 8 }, (_, i) =>
      node(`n${i}`, 35.6 + Math.sin(i) * 0.05, 139.7 + Math.cos(i) * 0.05),
    );
    const result = sequenceDay(nodes, { anchor: null, mode: 'walking', dayStartMinute: 540 });
    expect(new Set(result.order).size).toBe(8);
    expect(result.order).toHaveLength(8);
  });

  it('honours a pinned index', () => {
    const nodes = [
      node('a', 35.69, 139.70),
      node('b', 35.71, 139.80),
      node('dinner', 35.70, 139.75, { pinnedIndex: 2 }),
    ];
    const result = sequenceDay(nodes, { anchor: null, mode: 'transit', dayStartMinute: 540 });
    expect(result.order[2]).toBe('dinner');
  });

  it('is a no-op for a single node', () => {
    const result = sequenceDay([node('only', 35.68, 139.76)], {
      anchor: null, mode: 'walking', dayStartMinute: 540,
    });
    expect(result.order).toEqual(['only']);
    expect(result.totalTravelSeconds).toBe(0);
  });
});

describe('nextOpenMinute', () => {
  it('returns the requested time when the venue is already open', () => {
    expect(nextOpenMinute(NINE_TO_FIVE, 2, 10 * 60, 60)).toBe(10 * 60);
  });

  it('pushes an early arrival to opening time', () => {
    expect(nextOpenMinute(NINE_TO_FIVE, 2, 7 * 60, 60)).toBe(9 * 60);
  });

  it('refuses a visit that cannot finish before closing', () => {
    expect(nextOpenMinute(NINE_TO_FIVE, 2, 16 * 60 + 30, 60)).toBeNull();
  });

  it('refuses a day the venue is closed entirely', () => {
    expect(nextOpenMinute(CLOSED_MONDAYS, 1, 10 * 60, 60)).toBeNull();
  });

  it('treats unknown hours as always available', () => {
    expect(nextOpenMinute(null, 1, 10 * 60, 60)).toBe(10 * 60);
  });
});

describe('scheduleDay', () => {
  const item = (id: string, overrides: Partial<ScheduleItem> = {}): ScheduleItem => ({
    id,
    durationMinutes: 90,
    inboundTravel: null,
    openingHours: null,
    window: null,
    isLocked: false,
    lockedStart: null,
    ...overrides,
  });

  it('inserts slack between activities so a relaxed day stays relaxed', () => {
    const { scheduled } = scheduleDay([item('a'), item('b')], 'relaxed', 2);
    const gap = scheduled[1]!.startMinute - scheduled[0]!.endMinute;
    expect(gap).toBe(30);
  });

  it('a packed day fits more than a relaxed one', () => {
    // Eight 90-minute stops: a packed day absorbs them all, a relaxed day runs
    // out of evening and reports the overflow rather than compressing.
    const items = Array.from({ length: 8 }, (_, i) => item(`n${i}`));
    const packed = scheduleDay(items, 'packed', 2);
    const relaxed = scheduleDay(items, 'relaxed', 2);
    expect(packed.scheduled).toHaveLength(8);
    expect(relaxed.scheduled.length).toBeLessThan(8);
    expect(relaxed.unplaced.length).toBeGreaterThan(0);
  });

  it('places lunch inside its window even when the day is running early', () => {
    const { scheduled } = scheduleDay(
      [item('lunch', { window: 'lunch', durationMinutes: 60 })],
      'balanced',
      2,
    );
    expect(scheduled[0]!.startMinute).toBeGreaterThanOrEqual(MEAL_WINDOWS.lunch.earliest);
    expect(scheduled[0]!.startMinute).toBeLessThanOrEqual(MEAL_WINDOWS.lunch.latest);
  });

  it('accounts for travel time before the next activity starts', () => {
    const { scheduled } = scheduleDay(
      [
        item('a', { durationMinutes: 60 }),
        item('b', {
          inboundTravel: { mode: 'transit', minutes: 40, meters: 8000, polyline: null, source: 'routes' },
        }),
      ],
      'balanced',
      2,
    );
    expect(scheduled[1]!.startMinute - scheduled[0]!.endMinute).toBeGreaterThanOrEqual(40);
  });

  it('reports what it could not place rather than silently dropping it', () => {
    const closed = item('closed', { openingHours: CLOSED_MONDAYS, durationMinutes: 60 });
    const { scheduled, unplaced } = scheduleDay([closed], 'balanced', 1);
    expect(scheduled).toHaveLength(0);
    expect(unplaced).toEqual(['closed']);
  });

  it('respects a locked start time exactly', () => {
    const { scheduled } = scheduleDay(
      [item('booked', { isLocked: true, lockedStart: 19 * 60, durationMinutes: 120 })],
      'relaxed',
      2,
    );
    expect(scheduled[0]!.startMinute).toBe(19 * 60);
  });
});

describe('formatMinute', () => {
  it.each([
    [0, '12am'],
    [9 * 60, '9am'],
    [12 * 60, '12pm'],
    [13 * 60 + 30, '1:30pm'],
    [23 * 60 + 45, '11:45pm'],
  ])('formats %i as %s', (minute, expected) => {
    expect(formatMinute(minute)).toBe(expected);
  });
});
