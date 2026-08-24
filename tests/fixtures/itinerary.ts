import type {
  Activity,
  Itinerary,
  OpeningHours,
  PlaceRef,
  TripDay,
} from '@/domain/types/itinerary';
import type { ExperienceTag } from '@/domain/types/taxonomy';
import {
  asActivityId,
  asPlaceId,
  asProfileId,
  asTripDayId,
  asTripId,
} from '@/domain/types/ids';

/**
 * Fixture builders. Deliberately verbose defaults so a test only has to state
 * the thing it is testing — a test that says `{ startMinute: 600 }` reads as
 * "at 10am" rather than as a wall of unrelated setup.
 */

let counter = 0;
const nextId = (): string => `id-${(counter += 1)}`;

export function resetFixtureIds(): void {
  counter = 0;
}

export function makePlace(
  overrides: {
    lat?: number;
    lng?: number;
    tags?: readonly ExperienceTag[];
    openingHours?: OpeningHours | null;
    priceLevel?: PlaceRef['hydrated'] extends null ? never : string;
    id?: string;
  } = {},
): PlaceRef {
  const id = overrides.id ?? nextId();
  return {
    placeId: asPlaceId(id),
    googlePlaceId: `g-${id}`,
    tags: overrides.tags ?? ['landmark'],
    hydrated: {
      displayName: `Place ${id}`,
      formattedAddress: null,
      location: { lat: overrides.lat ?? 35.68, lng: overrides.lng ?? 139.76 },
      rating: 4.4,
      userRatingCount: 1200,
      priceLevel: null,
      openingHours: overrides.openingHours ?? null,
      websiteUri: null,
      googleMapsUri: null,
      editorialSummary: null,
      photoNames: [],
      businessStatus: 'OPERATIONAL',
    },
  };
}

export function makeActivity(overrides: Partial<Activity> = {}): Activity {
  const id = asActivityId(nextId());
  return {
    id,
    orderIndex: 1,
    kind: 'activity',
    place: makePlace(),
    customName: null,
    title: 'An activity',
    description: null,
    reason: null,
    startMinute: 10 * 60,
    endMinute: 11 * 60,
    durationMinutes: 60,
    estimatedCost: 20,
    costBasis: 'modelled',
    inboundTravel: null,
    bookingUrl: null,
    isLocked: false,
    source: 'generated',
    ...overrides,
  };
}

export function makeDay(overrides: Partial<TripDay> = {}): TripDay {
  return {
    id: asTripDayId(nextId()),
    dayIndex: 1,
    date: '2026-09-01',
    title: 'A day',
    summary: null,
    destinationId: null,
    estimatedCost: null,
    notes: null,
    activities: [],
    ...overrides,
  };
}

export function makeItinerary(overrides: Partial<Itinerary> = {}): Itinerary {
  return {
    id: asTripId(nextId()),
    slug: 'test-trip',
    title: 'Test Trip',
    subtitle: null,
    status: 'ready',
    visibility: 'private',
    request: {
      destinationQuery: 'Tokyo',
      destinationId: null,
      dates: { mode: 'exact', start: '2026-09-01', end: '2026-09-01', durationDays: 1 },
      party: { adults: 2, children: [] },
      currency: 'AUD',
      budgetTotal: null,
      budgetDaily: null,
      travelStyle: 'balanced',
      pace: 'balanced',
      interests: ['food'],
      transportModes: ['mixed'],
      foodPrefs: [],
      accommodation: null,
      notes: null,
    },
    summary: null,
    highlights: [],
    destinations: [],
    days: [],
    estimatedCost: null,
    heroImageUrl: null,
    heroCredit: null,
    lineage: {
      forkedFromTripId: null,
      forkedFromVersion: null,
      rootTripId: null,
      originCreatorUsername: null,
      originTitle: null,
    },
    counters: { likes: 0, saves: 0, views: 0, clones: 0, shares: 0 },
    isIndexable: false,
    creator: { id: asProfileId('u1'), username: 'tester', displayName: null, avatarUrl: null },
    version: 1,
    publishedAt: null,
    updatedAt: '2026-08-24T00:00:00Z',
    ...overrides,
  };
}

/** Open 9am-5pm every day. */
export const NINE_TO_FIVE: OpeningHours = {
  alwaysOpen: false,
  periods: Array.from({ length: 7 }, (_, day) => ({ day, open: 9 * 60, close: 17 * 60 })),
};

/** Closed on Mondays (day 1), 9-5 otherwise. */
export const CLOSED_MONDAYS: OpeningHours = {
  alwaysOpen: false,
  periods: Array.from({ length: 7 }, (_, day) => ({ day, open: 9 * 60, close: 17 * 60 })).filter(
    (p) => p.day !== 1,
  ),
};
