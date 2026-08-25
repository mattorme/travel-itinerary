import { describe, expect, it, vi } from 'vitest';
import { OFFLINE_SNAPSHOT_VERSION } from '@/lib/native/offline-format';
import {
  CLOSED_MONDAYS,
  makeActivity,
  makeDay,
  makeItinerary,
  makePlace,
  resetFixtureIds,
} from '../fixtures/itinerary';

// The offline module pulls in Capacitor, which expects a browser global.
vi.mock('@capacitor/preferences', () => ({ Preferences: {} }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'web', isNativePlatform: () => false, isPluginAvailable: () => false },
}));

const { toOfflineTrip } = await import('@/lib/native/offline');

/**
 * The offline snapshot is written to a device and read back by a build that may
 * be months newer, by a page with no network and no access to the database. If
 * it is missing something, a traveller finds out in a foreign city.
 */
describe('offline snapshot', () => {
  it('carries everything needed to read a trip with no network', () => {
    resetFixtureIds();
    const trip = makeItinerary({
      title: 'Three slow days in Tokyo',
      days: [
        makeDay({
          dayIndex: 1,
          title: 'The old east side',
          activities: [
            makeActivity({
              title: 'Nezu Shrine',
              reason: 'Five minutes from lunch.',
              startMinute: 10 * 60,
              place: makePlace({ lat: 35.7203, lng: 139.7594, openingHours: CLOSED_MONDAYS }),
            }),
          ],
        }),
      ],
    });

    const snapshot = toOfflineTrip(trip);
    const activity = snapshot.days[0]!.activities[0]!;

    expect(snapshot.version).toBe(OFFLINE_SNAPSHOT_VERSION);
    expect(snapshot.title).toBe('Three slow days in Tokyo');
    expect(activity.title).toBe('Nezu Shrine');
    expect(activity.reason).toBe('Five minutes from lunch.');
    // Wall-clock, not minutes: the offline page must not need our formatters.
    expect(activity.start).toBe('10am');
    // A map link that works without a Places lookup.
    expect(activity.mapsUrl).toContain('35.7203');
    expect(activity.lat).toBeCloseTo(35.7203, 4);
  });

  it('survives a trip whose place cache has expired', () => {
    // The cold-cache path: no coordinates, no address. The authored title has
    // to carry it, exactly as on the web.
    resetFixtureIds();
    const trip = makeItinerary({
      days: [makeDay({ activities: [makeActivity({ title: 'Yanaka walk', place: null, customName: 'Yanaka walk' })] })],
    });

    const activity = toOfflineTrip(trip).days[0]!.activities[0]!;
    expect(activity.title).toBe('Yanaka walk');
    expect(activity.mapsUrl).toBeNull();
    expect(activity.lat).toBeNull();
  });

  it('is JSON-serialisable, because that is how it is stored', () => {
    resetFixtureIds();
    const trip = makeItinerary({
      days: [makeDay({ activities: [makeActivity()] })],
    });
    const snapshot = toOfflineTrip(trip);
    expect(() => JSON.parse(JSON.stringify(snapshot))).not.toThrow();
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('keeps travel legs so the day still reads as a sequence', () => {
    resetFixtureIds();
    const trip = makeItinerary({
      days: [
        makeDay({
          activities: [
            makeActivity(),
            makeActivity({
              inboundTravel: { mode: 'walking', minutes: 12, meters: 900, polyline: null, source: 'routes' },
            }),
          ],
        }),
      ],
    });
    expect(toOfflineTrip(trip).days[0]!.activities[1]!.travel).toEqual({
      mode: 'walking',
      minutes: 12,
      meters: 900,
    });
  });
});
