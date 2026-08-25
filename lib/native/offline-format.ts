/**
 * The offline snapshot format.
 *
 * Deliberately not the domain `Itinerary`. This is a flat, self-contained
 * reading copy: no place references to hydrate, no cache to consult, no
 * network. A traveller with their phone in aeroplane mode in a city they have
 * never been to should get everything they need from this object alone.
 *
 * Versioned because it is written to a device and read back by a build that may
 * be months newer. The offline shell refuses a version it does not understand
 * rather than rendering half a trip.
 */
export const OFFLINE_SNAPSHOT_VERSION = 1;

export interface OfflineActivity {
  readonly title: string;
  readonly reason: string | null;
  readonly description: string | null;
  readonly start: string | null;
  readonly durationMinutes: number | null;
  readonly cost: number | null;
  readonly kind: string;
  readonly travel: { mode: string; minutes: number; meters: number } | null;
  readonly address: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
  /** So "open in maps" works with no network and no Places call. */
  readonly mapsUrl: string | null;
}

export interface OfflineDay {
  readonly dayIndex: number;
  readonly date: string | null;
  readonly title: string;
  readonly summary: string | null;
  readonly activities: readonly OfflineActivity[];
}

export interface OfflineTrip {
  readonly version: number;
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly summary: string | null;
  readonly currency: string;
  readonly estimatedTotal: number | null;
  readonly durationDays: number;
  readonly destinations: readonly string[];
  readonly days: readonly OfflineDay[];
  readonly savedAt: string;
}

export const OFFLINE_INDEX_KEY = 'wayfare.offline.index';
export const offlineTripKey = (slug: string): string => `wayfare.offline.trip.${slug}`;

export interface OfflineIndexEntry {
  readonly slug: string;
  readonly title: string;
  readonly destinations: readonly string[];
  readonly durationDays: number;
  readonly savedAt: string;
}
