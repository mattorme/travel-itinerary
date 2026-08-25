'use client';

import { Preferences } from '@capacitor/preferences';
import type { Itinerary } from '@/domain/types/itinerary';
import { formatMinute } from '@/domain/sequencing/schedule';
import { hasPlugin, isNative } from './platform';
import {
  OFFLINE_INDEX_KEY,
  OFFLINE_SNAPSHOT_VERSION,
  offlineTripKey,
  type OfflineIndexEntry,
  type OfflineTrip,
} from './offline-format';

/**
 * Saving a trip to the device.
 *
 * Uses Capacitor Preferences rather than IndexedDB or a service worker, and the
 * reason is specific: the app loads the live site over `server.url`, but the
 * offline fallback page is bundled with the app and served from a different
 * origin. Web storage would not be shared between them. Preferences goes
 * through the native bridge, so both sides see the same data.
 *
 * On the web it falls back to localStorage, so the button is not a dead end in
 * a browser — it just cannot survive a hard offline reload the way the app can.
 */

const storage = {
  async get(key: string): Promise<string | null> {
    if (isNative() && hasPlugin('Preferences')) {
      const { value } = await Preferences.get({ key });
      return value ?? null;
    }
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    if (isNative() && hasPlugin('Preferences')) {
      await Preferences.set({ key, value });
      return;
    }
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Private browsing, or the quota is full. Reported by the caller.
      throw new Error('storage unavailable');
    }
  },

  async remove(key: string): Promise<void> {
    if (isNative() && hasPlugin('Preferences')) {
      await Preferences.remove({ key });
      return;
    }
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export function toOfflineTrip(itinerary: Itinerary): OfflineTrip {
  return {
    version: OFFLINE_SNAPSHOT_VERSION,
    id: itinerary.id,
    slug: itinerary.slug,
    title: itinerary.title,
    subtitle: itinerary.subtitle,
    summary: itinerary.summary,
    currency: itinerary.request.currency,
    estimatedTotal: itinerary.estimatedCost?.total ?? null,
    durationDays: itinerary.request.dates.durationDays,
    destinations: itinerary.destinations.map((d) => d.name),
    savedAt: new Date().toISOString(),
    days: itinerary.days.map((day) => ({
      dayIndex: day.dayIndex,
      date: day.date,
      title: day.title,
      summary: day.summary,
      activities: day.activities.map((activity) => {
        const hydrated = activity.place?.hydrated ?? null;
        return {
          title: activity.title,
          reason: activity.reason,
          description: activity.description,
          start: activity.startMinute !== null ? formatMinute(activity.startMinute) : null,
          durationMinutes: activity.durationMinutes,
          cost: activity.estimatedCost,
          kind: activity.kind,
          travel: activity.inboundTravel
            ? {
                mode: activity.inboundTravel.mode,
                minutes: activity.inboundTravel.minutes,
                meters: activity.inboundTravel.meters,
              }
            : null,
          address: hydrated?.formattedAddress ?? null,
          lat: hydrated?.location?.lat ?? null,
          lng: hydrated?.location?.lng ?? null,
          // A geo: URI needs no network and no Places lookup to open.
          mapsUrl: hydrated?.location
            ? `https://maps.google.com/?q=${hydrated.location.lat},${hydrated.location.lng}`
            : null,
        };
      }),
    })),
  };
}

export async function saveOffline(itinerary: Itinerary): Promise<void> {
  const snapshot = toOfflineTrip(itinerary);
  await storage.set(offlineTripKey(snapshot.slug), JSON.stringify(snapshot));

  const index = await readIndex();
  const next: OfflineIndexEntry[] = [
    {
      slug: snapshot.slug,
      title: snapshot.title,
      destinations: snapshot.destinations,
      durationDays: snapshot.durationDays,
      savedAt: snapshot.savedAt,
    },
    ...index.filter((entry) => entry.slug !== snapshot.slug),
  ];
  await storage.set(OFFLINE_INDEX_KEY, JSON.stringify(next));
}

export async function removeOffline(slug: string): Promise<void> {
  await storage.remove(offlineTripKey(slug));
  const index = await readIndex();
  await storage.set(OFFLINE_INDEX_KEY, JSON.stringify(index.filter((e) => e.slug !== slug)));
}

export async function isSavedOffline(slug: string): Promise<boolean> {
  return (await readIndex()).some((entry) => entry.slug === slug);
}

export async function readIndex(): Promise<OfflineIndexEntry[]> {
  const raw = await storage.get(OFFLINE_INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineIndexEntry[]) : [];
  } catch {
    // A corrupt index should not brick the feature.
    return [];
  }
}
