import 'server-only';
import tzlookup from 'tz-lookup';
import { createAdminClient } from '@/lib/db/supabase/admin';
import { geocodeDestination } from '@/lib/google/places/client';
import { countryCodeOf, countryNameOf } from '@/lib/google/places/normalize';
import { recordApiUsage } from '@/lib/observability/usage';
import { asDestinationId, type DestinationId } from '@/domain/types/ids';
import type { BoundingBox, LatLng } from '@/domain/types/geo';
import { ServiceError } from '@/lib/observability/errors';
import { COST_INDEX } from '@/domain/cost/cost-index';

/**
 * Stage 0: turn "kyoto" into a destination row.
 *
 * Destinations are shared and permanent — they are ours, not Google Maps
 * Content — so this resolves once per destination across all users, and the
 * corpus, cost index and timezone hang off it.
 */

export interface ResolvedDestination {
  readonly id: DestinationId;
  readonly name: string;
  readonly countryCode: string;
  readonly countryName: string;
  readonly location: LatLng;
  readonly timezone: string;
  readonly bbox: BoundingBox | null;
  readonly costIndex: number;
  readonly radiusMeters: number;
}

export async function resolveDestination(
  query: string,
  context: { tripId: string; jobId: string },
): Promise<ResolvedDestination> {
  const admin = createAdminClient();

  const existing = await admin
    .from('destinations')
    .select('*')
    .ilike('name', query.trim())
    .limit(1)
    .maybeSingle();

  if (existing.data) return toResolved(existing.data);

  const place = await geocodeDestination(query);
  await recordApiUsage({
    provider: 'google_places',
    sku: 'places.textsearch.essentials',
    units: 1,
    tripId: context.tripId,
    jobId: context.jobId,
  });

  if (!place?.location) {
    throw new ServiceError({
      kind: 'not_found',
      provider: 'google_places',
      message: `Could not resolve destination "${query}"`,
      userMessage: `We could not find "${query}". Try a city or region name.`,
    });
  }

  const byGoogleId = await admin
    .from('destinations')
    .select('*')
    .eq('google_place_id', place.id)
    .maybeSingle();

  if (byGoogleId.data) return toResolved(byGoogleId.data);

  const lat = place.location.latitude;
  const lng = place.location.longitude;
  const countryCode = countryCodeOf(place) ?? 'XX';
  const name = place.displayName?.text ?? query;

  const bbox = place.viewport
    ? {
        north: place.viewport.high.latitude,
        south: place.viewport.low.latitude,
        east: place.viewport.high.longitude,
        west: place.viewport.low.longitude,
      }
    : null;

  const { data, error } = await admin
    .from('destinations')
    .insert({
      slug: await uniqueDestinationSlug(name, countryCode),
      name,
      kind: inferKind(place.types ?? []),
      country_code: countryCode,
      country_name: countryNameOf(place) ?? countryCode,
      lat,
      lng,
      timezone: safeTimezone(lat, lng),
      bbox,
      google_place_id: place.id,
      cost_index: COST_INDEX[countryCode] ?? COST_INDEX.DEFAULT,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new ServiceError({
      kind: 'unknown',
      provider: 'google_places',
      message: `Failed to persist destination: ${error?.message ?? 'no row returned'}`,
    });
  }

  return toResolved(data);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toResolved(row: any): ResolvedDestination {
  const bbox = row.bbox as BoundingBox | null;
  return {
    id: asDestinationId(row.id),
    name: row.name,
    countryCode: row.country_code,
    countryName: row.country_name,
    location: { lat: row.lat, lng: row.lng },
    timezone: row.timezone,
    bbox,
    costIndex: Number(row.cost_index ?? 1),
    radiusMeters: radiusFor(row.kind, bbox),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Search radius. A city is a tight search; a region needs a wide one, but never
 * wider than the Places API's 50km ceiling.
 */
function radiusFor(kind: string, bbox: BoundingBox | null): number {
  if (bbox) {
    const latSpanM = Math.abs(bbox.north - bbox.south) * 111_000;
    return Math.min(50_000, Math.max(6_000, latSpanM / 2));
  }
  return kind === 'city' ? 12_000 : 40_000;
}

function inferKind(types: readonly string[]): 'city' | 'region' | 'country' {
  if (types.includes('country')) return 'country';
  if (types.includes('administrative_area_level_1')) return 'region';
  return 'city';
}

/** tz-lookup covers the globe but returns nothing useful mid-ocean. */
function safeTimezone(lat: number, lng: number): string {
  try {
    return tzlookup(lat, lng);
  } catch {
    return 'UTC';
  }
}

async function uniqueDestinationSlug(name: string, countryCode: string): Promise<string> {
  const base = `${slugify(name)}-${countryCode.toLowerCase()}`;
  const admin = createAdminClient();
  const { data } = await admin.from('destinations').select('id').eq('slug', base).maybeSingle();
  return data ? `${base}-${Math.random().toString(36).slice(2, 7)}` : base;
}

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
