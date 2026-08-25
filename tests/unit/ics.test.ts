import { describe, expect, it, beforeEach } from 'vitest';
import { itineraryToIcs, icsFilename } from '@/domain/export/ics';
import {
  makeActivity,
  makeDay,
  makeItinerary,
  makePlace,
  resetFixtureIds,
} from '../fixtures/itinerary';

const options = { domain: 'wayfare.app', tripUrl: 'https://wayfare.app/t/tokyo' };

const build = (overrides = {}) =>
  itineraryToIcs(makeItinerary(overrides), options);

const lines = (ics: string) => ics.split('\r\n');

beforeEach(resetFixtureIds);

/**
 * This is the one feature a traveller uses after they have stopped looking at
 * the app, so it has to be correct in Apple Calendar, Google Calendar and
 * Outlook with no chance to fix it server-side afterwards.
 */
describe('iCalendar export', () => {
  it('produces a well-formed calendar with CRLF line endings', () => {
    const ics = build({
      days: [makeDay({ activities: [makeActivity()] })],
    });

    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
    // A bare \n anywhere would break strict parsers.
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('emits floating local times, never UTC', () => {
    // A 10am stop in Kyoto must read 10am regardless of the phone's timezone.
    // A trailing Z would shift the whole trip by hours.
    const ics = build({
      days: [
        makeDay({
          date: '2026-09-01',
          activities: [makeActivity({ startMinute: 10 * 60, endMinute: 11 * 60 })],
        }),
      ],
    });

    expect(ics).toContain('DTSTART:20260901T100000');
    expect(ics).toContain('DTEND:20260901T110000');
    expect(ics).not.toMatch(/DTSTART:\d{8}T\d{6}Z/);
    expect(ics).not.toContain('TZID');
  });

  it('rolls an after-midnight end time onto the next day', () => {
    const ics = build({
      days: [
        makeDay({
          date: '2026-09-01',
          activities: [makeActivity({ startMinute: 23 * 60, endMinute: 25 * 60 })],
        }),
      ],
    });
    expect(ics).toContain('DTSTART:20260901T230000');
    expect(ics).toContain('DTEND:20260902T010000');
  });

  it('escapes the characters RFC 5545 reserves', () => {
    const ics = build({
      days: [
        makeDay({
          activities: [
            makeActivity({
              title: 'Bar; with, commas',
              description: 'Line one\nline two \\ backslash',
            }),
          ],
        }),
      ],
    });

    expect(ics).toContain('SUMMARY:Bar\; with\\, commas');
    expect(ics).toContain('\\nline two \\\\ backslash');
  });

  it('folds long lines at 75 octets without splitting a character', () => {
    // The failure mode this guards is specific: folding on character count
    // corrupts the file the first time a place has a multi-byte name, which for
    // a travel product is immediately.
    const ics = build({
      days: [
        makeDay({
          activities: [makeActivity({ title: '東京'.repeat(60) })],
        }),
      ],
    });

    const encoder = new TextEncoder();
    for (const line of lines(ics)) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    // Unfolding must reproduce the original text intact.
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('東京'.repeat(60));
  });

  it('gives each activity a stable UID so re-importing updates rather than duplicates', () => {
    const trip = makeItinerary({ days: [makeDay({ activities: [makeActivity()] })] });
    const first = itineraryToIcs(trip, options);
    const second = itineraryToIcs(trip, options);
    expect(first).toBe(second);
    expect(first).toMatch(/UID:[^\r\n]+@wayfare\.app/);
  });

  it('attaches a location and coordinates when the place is known', () => {
    const ics = build({
      days: [
        makeDay({
          activities: [makeActivity({ place: makePlace({ lat: 35.7203, lng: 139.7594 }) })],
        }),
      ],
    });
    expect(ics).toContain('GEO:35.720300;139.759400');
  });

  it('exports nothing for a trip with no dates rather than inventing them', () => {
    const ics = build({
      days: [makeDay({ date: null, activities: [makeActivity()] })],
    });
    expect(ics).not.toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('skips activities that were never given a time', () => {
    const ics = build({
      days: [
        makeDay({
          activities: [
            makeActivity({ startMinute: null, endMinute: null }),
            makeActivity({ startMinute: 600, endMinute: 660 }),
          ],
        }),
      ],
    });
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  it('names the file after the trip', () => {
    expect(icsFilename(makeItinerary({ slug: 'three-slow-days-in-tokyo' }))).toBe(
      'three-slow-days-in-tokyo.ics',
    );
  });
});
