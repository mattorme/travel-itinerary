import { describe, expect, it } from 'vitest';
import {
  ARC_SPAN,
  ARC_START,
  arcSegments,
  bandCounts,
  bandOf,
  describeArc,
} from '@/domain/schedule/time-of-day';

describe('bandOf', () => {
  it('splits the day at noon and 5pm', () => {
    expect(bandOf(0)).toBe('morning');
    expect(bandOf(11 * 60 + 59)).toBe('morning');
    expect(bandOf(12 * 60)).toBe('afternoon');
    expect(bandOf(16 * 60 + 59)).toBe('afternoon');
    expect(bandOf(17 * 60)).toBe('evening');
    expect(bandOf(23 * 60 + 30)).toBe('evening');
  });
});

describe('arcSegments', () => {
  it('places a stop at its real fraction of the window', () => {
    // Noon is six hours into an eighteen-hour window.
    const [segment] = arcSegments([{ startMinute: 12 * 60, durationMinutes: 60 }]);
    expect(segment?.offset).toBeCloseTo(6 / 18, 5);
    expect(segment?.width).toBeCloseTo(60 / ARC_SPAN, 5);
    expect(segment?.band).toBe('afternoon');
  });

  it('skips stops with no time, because the arc only shows the schedule', () => {
    expect(arcSegments([{ startMinute: null, durationMinutes: 90 }])).toHaveLength(0);
  });

  it('gives a very short stop a visible minimum width', () => {
    const [segment] = arcSegments([{ startMinute: 9 * 60, durationMinutes: 5 }]);
    expect(segment?.width).toBeGreaterThan(5 / ARC_SPAN);
  });

  it('pins an early start to the left edge rather than overflowing', () => {
    const [segment] = arcSegments([{ startMinute: 4 * 60, durationMinutes: 60 }]);
    expect(segment?.offset).toBe(0);
    // Still coloured by the hour it actually happens at, not by where it is drawn.
    expect(segment?.band).toBe('morning');
  });

  it('never lets a late stop run past the right edge', () => {
    const [segment] = arcSegments([{ startMinute: 23 * 60 + 30, durationMinutes: 180 }]);
    expect((segment?.offset ?? 0) + (segment?.width ?? 0)).toBeLessThanOrEqual(1);
  });

  it('starts the window at 6am', () => {
    const [segment] = arcSegments([{ startMinute: ARC_START, durationMinutes: 60 }]);
    expect(segment?.offset).toBe(0);
  });
});

describe('describeArc', () => {
  it('says how the day is weighted, not that it is an image', () => {
    const segments = arcSegments([
      { startMinute: 9 * 60, durationMinutes: 60 },
      { startMinute: 10 * 60 + 30, durationMinutes: 60 },
      { startMinute: 19 * 60, durationMinutes: 120 },
    ]);
    expect(bandCounts(segments)).toEqual({ morning: 2, afternoon: 0, evening: 1 });
    expect(describeArc('Day 1', segments)).toBe('Day 1: 3 stops — 2 morning, 1 evening');
  });

  it('is honest about an empty day', () => {
    expect(describeArc('Day 4', [])).toBe('Day 4: nothing scheduled');
  });
});
