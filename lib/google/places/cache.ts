import 'server-only';
import { createAdminClient } from '@/lib/db/supabase/admin';
import type { PlaceHydration } from '@/domain/types/itinerary';
import type { ExperienceTag } from '@/domain/types/taxonomy';
import { asPlaceId, type DestinationId, type PlaceId } from '@/domain/types/ids';
import { normalizeHydration } from './normalize';
import { placeDetails } from './client';
import { tagsForGoogleTypes } from './taxonomy';
import { recordApiUsage } from '@/lib/observability/usage';
import type { GooglePlace } from './types';
import { mapWithConcurrency } from '@/lib/utils/async';
import type { Json } from '@/lib/db/database.types';

/**
 * The Google Maps Platform terms allow `place_id` to be stored indefinitely but
 * not the content attached to it, beyond a limited window. So:
 *
 *   places       — permanent. place_id, our tags, which destination it is in.
 *   place_cache  — Google Maps Content. Written with a hard TTL, read only while
 *                  live (the RLS policy and a CHECK constraint both enforce it),
 *                  swept by cron.
 *
 * The practical effect is that rendering a trip is a *hydration*: the plan is
 * ours and permanent, the facts are borrowed and refreshed. A trip page must
 * therefore survive a completely cold cache — which is why `activities.title` is
 * authored text rather than a copy of the Google display name.
 *
 * See docs/ARCHITECTURE.md §3.
 */

/** Conservative: the documented allowance is 30 days. */
const CACHE_TTL_DAYS = 25;

export interface CachedPlace {
  readonly placeId: PlaceId;
  readonly googlePlaceId: string;
  readonly tags: readonly ExperienceTag[];
  readonly hydration: PlaceHydration | null;
}

/**
 * Upsert the permanent half. Idempotent, and safe to call for hundreds of
 * discovery results — it writes no Google content.
 */
export async function upsertPlaces(
  places: readonly GooglePlace[],
  destinationId: DestinationId | null,
): Promise<ReadonlyMap<string, PlaceId>> {
  if (places.length === 0) return new Map();
  const admin = createAdminClient();

  const rows = places.map((p) => ({
    google_place_id: p.id,
    destination_id: destinationId,
    primary_type: p.primaryType ?? null,
    types: p.types ?? [],
    tags: [...tagsForGoogleTypes(p.types ?? [])],
  }));

  const { data, error } = await admin
    .from('places')
    .upsert(rows, { onConflict: 'google_place_id', ignoreDuplicates: false })
    .select('id, google_place_id');

  if (error) throw new Error(`Failed to upsert places: ${error.message}`);

  return new Map((data ?? []).map((r) => [r.google_place_id, asPlaceId(r.id)]));
}

/** Read whatever is still live. Expired rows are invisible by policy. */
export async function readCache(
  placeIds: readonly PlaceId[],
): Promise<ReadonlyMap<PlaceId, PlaceHydration>> {
  if (placeIds.length === 0) return new Map();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('place_cache')
    .select('*')
    .in('place_id', [...placeIds])
    .gt('expires_at', new Date().toISOString());

  if (error) throw new Error(`Failed to read place cache: ${error.message}`);

  const out = new Map<PlaceId, PlaceHydration>();
  for (const row of data ?? []) {
    out.set(asPlaceId(row.place_id), rowToHydration(row));
  }
  return out;
}

/**
 * Hydrate a set of places, fetching only what is missing or stale.
 *
 * This is the single hottest cost path in the product: the tenth trip to Tokyo
 * should make roughly zero Places calls, because the corpus is shared across
 * every user and refresh cost amortises over all of them.
 */
export async function hydratePlaces(
  entries: readonly { placeId: PlaceId; googlePlaceId: string }[],
  context: { tripId?: string; jobId?: string } = {},
): Promise<ReadonlyMap<PlaceId, PlaceHydration>> {
  const cached = await readCache(entries.map((e) => e.placeId));
  const missing = entries.filter((e) => !cached.has(e.placeId));
  if (missing.length === 0) return cached;

  const fetched = new Map(cached);
  const rows: CacheRow[] = [];

  // Bounded concurrency: Places Details is per-place and we may be filling 40 of
  // them. Eight at a time keeps us well inside rate limits without serialising.
  const results = await mapWithConcurrency(missing, 8, async (entry) => {
    try {
      const place = await placeDetails(entry.googlePlaceId);
      return { entry, place };
    } catch {
      // A single unresolvable place must not fail a whole generation. The
      // activity still renders from its authored title.
      return { entry, place: null };
    }
  });

  const now = Date.now();
  for (const { entry, place } of results) {
    if (!place) continue;
    const hydration = normalizeHydration(place);
    fetched.set(entry.placeId, hydration);
    rows.push(toCacheRow(entry.placeId, hydration, place, now));
  }

  if (rows.length > 0) {
    const admin = createAdminClient();
    const { error } = await admin.from('place_cache').upsert(rows, { onConflict: 'place_id' });
    if (error) throw new Error(`Failed to write place cache: ${error.message}`);

    await recordApiUsage({
      provider: 'google_places',
      sku: 'places.details.enterprise',
      units: rows.length,
      tripId: context.tripId ?? null,
      jobId: context.jobId ?? null,
    });
  }

  return fetched;
}

interface CacheRow {
  place_id: string;
  display_name: string | null;
  formatted_address: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  user_rating_count: number | null;
  price_level: string | null;
  price_range: Json;
  opening_hours: Json;
  website_uri: string | null;
  google_maps_uri: string | null;
  editorial_summary: string | null;
  photo_names: string[];
  business_status: string | null;
  payload: Json;
  fetched_at: string;
  expires_at: string;
}

function toCacheRow(
  placeId: PlaceId,
  hydration: PlaceHydration,
  raw: GooglePlace,
  now: number,
): CacheRow {
  return {
    place_id: placeId,
    display_name: hydration.displayName,
    formatted_address: hydration.formattedAddress,
    lat: hydration.location?.lat ?? null,
    lng: hydration.location?.lng ?? null,
    rating: hydration.rating,
    user_rating_count: hydration.userRatingCount,
    price_level: hydration.priceLevel,
    price_range: (raw.priceRange ?? null) as Json,
    opening_hours: hydration.openingHours as unknown as Json,
    website_uri: hydration.websiteUri,
    google_maps_uri: hydration.googleMapsUri,
    editorial_summary: hydration.editorialSummary,
    photo_names: [...hydration.photoNames],
    business_status: hydration.businessStatus,
    payload: raw as unknown as Json,
    fetched_at: new Date(now).toISOString(),
    expires_at: new Date(now + CACHE_TTL_DAYS * 86_400_000).toISOString(),
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToHydration(row: any): PlaceHydration {
  return {
    displayName: row.display_name ?? 'Unnamed place',
    formattedAddress: row.formatted_address ?? null,
    location: row.lat !== null && row.lng !== null ? { lat: row.lat, lng: row.lng } : null,
    rating: row.rating ?? null,
    userRatingCount: row.user_rating_count ?? null,
    priceLevel: row.price_level ?? null,
    openingHours: row.opening_hours ?? null,
    websiteUri: row.website_uri ?? null,
    googleMapsUri: row.google_maps_uri ?? null,
    editorialSummary: row.editorial_summary ?? null,
    photoNames: row.photo_names ?? [],
    businessStatus: row.business_status ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

