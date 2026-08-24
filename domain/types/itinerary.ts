import type {
  ActivityId,
  DestinationId,
  PlaceId,
  ProfileId,
  TripDayId,
  TripId,
} from './ids';
import type {
  AccommodationKind,
  ActivityKind,
  ExperienceTag,
  FoodPref,
  Interest,
  Pace,
  TransportMode,
  TravelStyle,
} from './taxonomy';
import type { LatLng } from './geo';

/** Minutes since local midnight. The itinerary never stores wall-clock strings. */
export type MinuteOfDay = number;

export interface Party {
  readonly adults: number;
  /** Ages, not just a count — a 3-year-old and a 15-year-old plan differently. */
  readonly children: readonly number[];
}

export interface TripDates {
  readonly mode: 'exact' | 'flexible';
  /** ISO yyyy-mm-dd. Null when the traveller only gave a duration. */
  readonly start: string | null;
  readonly end: string | null;
  readonly durationDays: number;
}

/** The validated wizard output. Everything downstream is derived from this. */
export interface TripRequest {
  readonly destinationQuery: string;
  readonly destinationId: DestinationId | null;
  readonly dates: TripDates;
  readonly party: Party;
  readonly currency: string;
  readonly budgetTotal: number | null;
  readonly budgetDaily: number | null;
  readonly travelStyle: TravelStyle;
  readonly pace: Pace;
  readonly interests: readonly Interest[];
  readonly transportModes: readonly TransportMode[];
  readonly foodPrefs: readonly FoodPref[];
  readonly accommodation: AccommodationKind | null;
  readonly notes: string | null;
}

/**
 * A place as the itinerary knows it. `placeId` is ours and permanent;
 * everything else is hydrated from place_cache at render time and may be null
 * when the cache is cold or expired. Nothing in the UI may assume these exist.
 */
export interface PlaceRef {
  readonly placeId: PlaceId;
  readonly googlePlaceId: string;
  readonly tags: readonly ExperienceTag[];
  readonly hydrated: PlaceHydration | null;
}

export interface PlaceHydration {
  readonly displayName: string;
  readonly formattedAddress: string | null;
  readonly location: LatLng | null;
  readonly rating: number | null;
  readonly userRatingCount: number | null;
  readonly priceLevel: PriceLevel | null;
  readonly openingHours: OpeningHours | null;
  readonly websiteUri: string | null;
  readonly googleMapsUri: string | null;
  readonly editorialSummary: string | null;
  readonly photoNames: readonly string[];
  readonly businessStatus: string | null;
}

export const PRICE_LEVELS = [
  'PRICE_LEVEL_FREE',
  'PRICE_LEVEL_INEXPENSIVE',
  'PRICE_LEVEL_MODERATE',
  'PRICE_LEVEL_EXPENSIVE',
  'PRICE_LEVEL_VERY_EXPENSIVE',
] as const;
export type PriceLevel = (typeof PRICE_LEVELS)[number];

/** Normalised opening hours. `periods` are in the destination's local timezone. */
export interface OpeningHours {
  /** 0 = Sunday, matching Google's `openNow`/`periods` day numbering. */
  readonly periods: readonly OpeningPeriod[];
  readonly alwaysOpen: boolean;
}

export interface OpeningPeriod {
  readonly day: number;
  readonly open: MinuteOfDay;
  /** May exceed 1440 for venues that close after midnight. */
  readonly close: MinuteOfDay;
}

export interface TravelLeg {
  readonly mode: TransportMode;
  readonly minutes: number;
  readonly meters: number;
  readonly polyline: string | null;
  /** 'routes' = measured by Google; 'estimated' = haversine model. Shown in the UI. */
  readonly source: 'routes' | 'estimated';
}

export interface Activity {
  readonly id: ActivityId;
  readonly orderIndex: number;
  readonly kind: ActivityKind;
  readonly place: PlaceRef | null;
  readonly customName: string | null;
  /** Authored by us. Renders even when place_cache is cold. */
  readonly title: string;
  readonly description: string | null;
  readonly reason: string | null;
  readonly startMinute: MinuteOfDay | null;
  readonly endMinute: MinuteOfDay | null;
  readonly durationMinutes: number | null;
  readonly estimatedCost: number | null;
  readonly costBasis: 'modelled' | 'user' | 'source';
  readonly inboundTravel: TravelLeg | null;
  readonly bookingUrl: string | null;
  readonly isLocked: boolean;
  readonly source: 'generated' | 'user_added' | 'cloned';
}

export interface TripDay {
  readonly id: TripDayId;
  readonly dayIndex: number;
  readonly date: string | null;
  readonly title: string;
  readonly summary: string | null;
  readonly destinationId: DestinationId | null;
  readonly estimatedCost: number | null;
  readonly notes: string | null;
  readonly activities: readonly Activity[];
}

export interface TripLineage {
  readonly forkedFromTripId: TripId | null;
  readonly forkedFromVersion: number | null;
  readonly rootTripId: TripId | null;
  /** Denormalised so attribution survives deletion of the source. */
  readonly originCreatorUsername: string | null;
  readonly originTitle: string | null;
}

export interface TripCounters {
  readonly likes: number;
  readonly saves: number;
  readonly views: number;
  readonly clones: number;
  readonly shares: number;
}

export interface CostBreakdown {
  readonly accommodation: number;
  readonly food: number;
  readonly activities: number;
  readonly localTransport: number;
  readonly buffer: number;
  readonly total: number;
  /** Always true today. Surfaced in the UI as "excl. flights". */
  readonly excludesFlights: true;
}

export interface TripCreator {
  readonly id: ProfileId;
  readonly username: string;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
}

export interface Itinerary {
  readonly id: TripId;
  readonly slug: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly status: 'draft' | 'generating' | 'ready' | 'failed';
  readonly visibility: 'private' | 'unlisted' | 'public';
  readonly request: TripRequest;
  readonly summary: string | null;
  readonly highlights: readonly string[];
  readonly destinations: readonly TripDestination[];
  readonly days: readonly TripDay[];
  readonly estimatedCost: CostBreakdown | null;
  readonly heroImageUrl: string | null;
  readonly heroCredit: ImageCredit | null;
  readonly lineage: TripLineage;
  readonly counters: TripCounters;
  /** Earned, not automatic — see docs/ARCHITECTURE.md §12. */
  readonly isIndexable: boolean;
  readonly creator: TripCreator | null;
  readonly version: number;
  readonly publishedAt: string | null;
  readonly updatedAt: string;
}

export interface ImageCredit {
  readonly author: string;
  readonly authorUrl: string | null;
  readonly source: string;
  readonly sourceUrl: string | null;
}

export interface TripDestination {
  readonly destinationId: DestinationId;
  readonly name: string;
  readonly countryCode: string;
  readonly timezone: string;
  readonly location: LatLng;
  readonly orderIndex: number;
  readonly firstDayIndex: number;
  readonly nights: number;
  readonly anchorPlaceId: PlaceId | null;
  readonly anchorLabel: string | null;
}
