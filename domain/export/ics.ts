import type { Itinerary, TripDay } from '../types/itinerary';

/**
 * iCalendar export (RFC 5545).
 *
 * Pure and dependency-free, which matters more than it sounds: this is the one
 * feature a traveller uses after they have stopped looking at the app. It has
 * to be right in Apple Calendar, Google Calendar and Outlook without a server
 * round trip to fix it later.
 *
 * Three details that are easy to get wrong and are handled here:
 *
 *  - Times are floating local (no Z, no TZID) rather than UTC. A stop at 9am in
 *    Kyoto should read 9am on the traveller's phone whether they are in Kyoto
 *    or still at home, and every calendar client honours that for a date-time
 *    with no zone. Converting to UTC makes the whole trip shift by hours the
 *    moment the device timezone changes.
 *  - Lines are folded at 75 octets, counted in UTF-8 bytes rather than
 *    characters. Fold a multi-byte character in half and the file is corrupt.
 *  - UIDs are stable across exports, so re-importing updates the event instead
 *    of duplicating the trip.
 */

export interface IcsOptions {
  /** Used in UIDs and PRODID. */
  readonly domain: string;
  /** Absolute URL of the trip, attached to every event. */
  readonly tripUrl: string;
}

export function itineraryToIcs(itinerary: Itinerary, options: IcsOptions): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${options.domain}//Wayfare//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(itinerary.title)}`,
  ];

  for (const day of itinerary.days) {
    for (const event of dayEvents(itinerary, day, options)) {
      lines.push(...event);
    }
  }

  lines.push('END:VCALENDAR');
  return lines.flatMap(fold).join('\r\n') + '\r\n';
}

function dayEvents(
  itinerary: Itinerary,
  day: TripDay,
  options: IcsOptions,
): string[][] {
  // Without dates there is no calendar to add to. A duration-only trip exports
  // nothing rather than inventing a start date.
  const date = day.date;
  if (!date) return [];

  return day.activities.flatMap((activity) => {
    if (activity.startMinute === null) return [];

    const end = activity.endMinute ?? activity.startMinute + (activity.durationMinutes ?? 60);
    const hydrated = activity.place?.hydrated ?? null;

    const description = [
      activity.reason,
      activity.description,
      activity.inboundTravel
        ? `Getting here: ${activity.inboundTravel.minutes} min ${activity.inboundTravel.mode}`
        : null,
      `Part of "${itinerary.title}". ${options.tripUrl}`,
    ]
      .filter((v): v is string => Boolean(v))
      .join('\n\n');

    const event = [
      'BEGIN:VEVENT',
      `UID:${activity.id}@${options.domain}`,
      // Deterministic: a changing DTSTAMP makes every re-export look like an
      // edit to clients that diff on it.
      `DTSTAMP:${stampFrom(itinerary.updatedAt)}`,
      `DTSTART:${localStamp(date, activity.startMinute)}`,
      `DTEND:${localStamp(date, end)}`,
      `SUMMARY:${escapeText(activity.title)}`,
      `DESCRIPTION:${escapeText(description)}`,
      `URL:${escapeText(options.tripUrl)}`,
      'TRANSP:OPAQUE',
    ];

    if (hydrated?.formattedAddress) {
      event.push(`LOCATION:${escapeText(hydrated.formattedAddress)}`);
    }
    if (hydrated?.location) {
      event.push(`GEO:${hydrated.location.lat.toFixed(6)};${hydrated.location.lng.toFixed(6)}`);
    }

    event.push('END:VEVENT');
    return [event];
  });
}

/** yyyymmddThhmmss — floating local time, deliberately without a zone. */
function localStamp(date: string, minute: number): string {
  const dayOffset = Math.floor(minute / 1440);
  const within = ((minute % 1440) + 1440) % 1440;

  const base = Date.parse(`${date}T00:00:00Z`) + dayOffset * 86_400_000;
  const shifted = new Date(base).toISOString().slice(0, 10).replace(/-/g, '');

  const hh = String(Math.floor(within / 60)).padStart(2, '0');
  const mm = String(within % 60).padStart(2, '0');
  return `${shifted}T${hh}${mm}00`;
}

function stampFrom(iso: string): string {
  const ms = Date.parse(iso);
  const date = new Date(Number.isNaN(ms) ? 0 : ms);
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** RFC 5545 §3.3.11: backslash, semicolon, comma and newline are special. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Fold to 75 octets, counting UTF-8 bytes.
 *
 * Splitting on character count corrupts the file the first time a trip contains
 * a multi-byte name — which, for a travel product, is immediately.
 */
function fold(line: string): string[] {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return [line];

  const out: string[] = [];
  let current = '';
  let bytes = 0;
  // Continuation lines start with a space, which costs one of the 75 octets.
  let limit = 75;

  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > limit) {
      out.push(current);
      current = ' ';
      bytes = 1;
      limit = 75;
    }
    current += char;
    bytes += size;
  }

  if (current.length > 0) out.push(current);
  return out;
}

export function icsFilename(itinerary: Itinerary): string {
  const slug = itinerary.slug.replace(/[^a-z0-9-]/gi, '').slice(0, 60) || 'trip';
  return `${slug}.ics`;
}
