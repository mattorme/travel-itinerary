import 'server-only';
import { googlePost } from '../client';
import { AUTOCOMPLETE_MASK, DETAILS_MASK, GEOCODE_MASK, SEARCH_MASK } from './field-masks';
import {
  autocompleteResponseSchema,
  googlePlaceSchema,
  searchResponseSchema,
  type GooglePlace,
} from './types';
import { serverEnv } from '@/lib/env';
import { ServiceError } from '@/lib/observability/errors';
import type { BoundingBox, LatLng } from '@/domain/types/geo';

const BASE = 'https://places.googleapis.com/v1';

export interface TextSearchArgs {
  readonly query: string;
  readonly bias?: { center: LatLng; radiusMeters: number };
  readonly restriction?: BoundingBox;
  readonly includedType?: string;
  readonly minRating?: number;
  readonly openNow?: boolean;
  readonly maxResults?: number;
  readonly languageCode?: string;
}

export async function textSearch(args: TextSearchArgs): Promise<readonly GooglePlace[]> {
  const body: Record<string, unknown> = {
    textQuery: args.query,
    maxResultCount: Math.min(args.maxResults ?? 20, 20),
    languageCode: args.languageCode ?? 'en',
  };
  if (args.includedType) body.includedType = args.includedType;
  if (args.minRating !== undefined) body.minRating = args.minRating;
  if (args.openNow !== undefined) body.openNow = args.openNow;
  if (args.restriction) {
    body.locationRestriction = { rectangle: toRectangle(args.restriction) };
  } else if (args.bias) {
    body.locationBias = {
      circle: {
        center: { latitude: args.bias.center.lat, longitude: args.bias.center.lng },
        radius: Math.min(args.bias.radiusMeters, 50_000),
      },
    };
  }

  const raw = await googlePost<unknown>({
    url: `${BASE}/places:searchText`,
    body,
    fieldMask: SEARCH_MASK,
    provider: 'google_places',
  });

  return searchResponseSchema.parse(raw).places ?? [];
}

export interface NearbySearchArgs {
  readonly center: LatLng;
  readonly radiusMeters: number;
  readonly includedTypes: readonly string[];
  readonly maxResults?: number;
  readonly languageCode?: string;
}

export async function nearbySearch(args: NearbySearchArgs): Promise<readonly GooglePlace[]> {
  const raw = await googlePost<unknown>({
    url: `${BASE}/places:searchNearby`,
    body: {
      includedTypes: args.includedTypes,
      maxResultCount: Math.min(args.maxResults ?? 20, 20),
      languageCode: args.languageCode ?? 'en',
      rankPreference: 'POPULARITY',
      locationRestriction: {
        circle: {
          center: { latitude: args.center.lat, longitude: args.center.lng },
          radius: Math.min(args.radiusMeters, 50_000),
        },
      },
    },
    fieldMask: SEARCH_MASK,
    provider: 'google_places',
  });

  return searchResponseSchema.parse(raw).places ?? [];
}

/**
 * Place Details. This is the expensive tier (opening hours, photos, editorial
 * summary), so it is only ever called for shortlisted places — see
 * docs/ARCHITECTURE.md §10.2.
 */
export async function placeDetails(googlePlaceId: string): Promise<GooglePlace> {
  const url = `${BASE}/places/${encodeURIComponent(googlePlaceId)}?languageCode=en`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': serverEnv().GOOGLE_MAPS_SERVER_KEY,
      'X-Goog-FieldMask': DETAILS_MASK,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new ServiceError({
      kind: response.status === 404 ? 'not_found' : 'upstream_unavailable',
      provider: 'google_places',
      status: response.status,
      message: `Place Details ${response.status} for ${googlePlaceId}`,
    });
  }

  return googlePlaceSchema.parse(await response.json());
}

/** Resolve a free-text destination ("kyoto", "the amalfi coast") to one place. */
export async function geocodeDestination(query: string): Promise<GooglePlace | null> {
  const raw = await googlePost<unknown>({
    url: `${BASE}/places:searchText`,
    body: { textQuery: query, maxResultCount: 1, languageCode: 'en' },
    fieldMask: GEOCODE_MASK,
    provider: 'google_places',
  });
  return searchResponseSchema.parse(raw).places?.[0] ?? null;
}

export interface AutocompleteSuggestion {
  readonly placeId: string;
  readonly primary: string;
  readonly secondary: string | null;
}

export async function autocompleteDestination(
  input: string,
  sessionToken: string,
): Promise<readonly AutocompleteSuggestion[]> {
  if (input.trim().length < 2) return [];

  const raw = await googlePost<unknown>({
    url: `${BASE}/places:autocomplete`,
    body: {
      input,
      sessionToken,
      // Only geographic entities — a traveller typing "tokyo" wants the city,
      // not a restaurant called Tokyo.
      includedPrimaryTypes: ['(cities)', 'administrative_area_level_1', 'country'],
      languageCode: 'en',
    },
    fieldMask: AUTOCOMPLETE_MASK,
    provider: 'google_places',
  });

  const parsed = autocompleteResponseSchema.parse(raw);
  return (parsed.suggestions ?? []).flatMap((s) => {
    const p = s.placePrediction;
    if (!p) return [];
    return [
      {
        placeId: p.placeId,
        primary: p.structuredFormat?.mainText?.text ?? p.text.text,
        secondary: p.structuredFormat?.secondaryText?.text ?? null,
      },
    ];
  });
}

function toRectangle(box: BoundingBox) {
  return {
    low: { latitude: box.south, longitude: box.west },
    high: { latitude: box.north, longitude: box.east },
  };
}
