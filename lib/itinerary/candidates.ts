import 'server-only';
import type { LatLng } from '@/domain/types/geo';
import { haversineMeters } from '@/domain/types/geo';
import type { ExperienceTag } from '@/domain/types/taxonomy';
import type { DestinationId, PlaceId } from '@/domain/types/ids';
import { asPlaceId } from '@/domain/types/ids';
import type { PlaceHydration } from '@/domain/types/itinerary';
import { createAdminClient } from '@/lib/db/supabase/admin';
import { nearbySearch, textSearch } from '@/lib/google/places/client';
import { EXCLUDED_TYPES, SEARCH_SPEC } from '@/lib/google/places/taxonomy';
import { hydratePlaces, upsertPlaces } from '@/lib/google/places/cache';
import { recordApiUsage } from '@/lib/observability/usage';
import type { GooglePlace } from '@/lib/google/places/types';

/**
 * Stage 2: resolve experience tags to real candidate places.
 *
 * Corpus-first. The place corpus is shared across every trip to a destination,
 * so the tenth Tokyo trip makes roughly zero Places calls while the first pays
 * to build it. This is the single biggest cost lever in the product — see
 * docs/ARCHITECTURE.md §10.1.
 */

export interface Candidate {
  readonly placeId: PlaceId;
  readonly googlePlaceId: string;
  readonly tags: readonly ExperienceTag[];
  readonly hydration: PlaceHydration;
  readonly location: LatLng;
}

export interface CandidateRequest {
  readonly tag: ExperienceTag;
  readonly destinationId: DestinationId;
  readonly destinationName: string;
  readonly centre: LatLng;
  readonly radiusMeters: number;
}

/** How many candidates we want in the corpus per tag before we stop searching. */
const CORPUS_TARGET_PER_TAG = 14;

export async function resolveCandidates(
  requests: readonly CandidateRequest[],
  context: { tripId: string; jobId: string },
): Promise<ReadonlyMap<ExperienceTag, readonly Candidate[]>> {
  const out = new Map<ExperienceTag, readonly Candidate[]>();

  // De-duplicate: several days asking for "dinner" is one search.
  const unique = new Map<string, CandidateRequest>();
  for (const request of requests) {
    unique.set(`${request.destinationId}:${request.tag}`, request);
  }

  for (const request of unique.values()) {
    const fromCorpus = await readCorpus(request);
    if (fromCorpus.length >= CORPUS_TARGET_PER_TAG) {
      out.set(request.tag, fromCorpus);
      continue;
    }
    const fetched = await discover(request, context);
    const merged = dedupeById([...fromCorpus, ...fetched]);
    out.set(request.tag, merged);
  }

  return out;
}

/**
 * Read what we already know about this destination. Only places whose cached
 * content is still live are usable — expired Google content is invisible by
 * policy, so a corpus entry with a cold cache counts as a miss.
 */
async function readCorpus(request: CandidateRequest): Promise<readonly Candidate[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('places')
    .select('id, google_place_id, tags, types')
    .eq('destination_id', request.destinationId)
    .contains('tags', [request.tag])
    .limit(60);

  if (error || !data || data.length === 0) return [];

  const entries = data.map((r) => ({
    placeId: asPlaceId(r.id),
    googlePlaceId: r.google_place_id,
    tags: (r.tags ?? []) as readonly ExperienceTag[],
  }));

  const hydrated = await hydratePlaces(entries);

  return entries.flatMap((entry) => {
    const hydration = hydrated.get(entry.placeId);
    if (!hydration?.location) return [];
    if (hydration.businessStatus === 'CLOSED_PERMANENTLY') return [];
    return [{ ...entry, hydration, location: hydration.location }];
  });
}

/** Cache miss: ask Google, then fold the results into the shared corpus. */
async function discover(
  request: CandidateRequest,
  context: { tripId: string; jobId: string },
): Promise<readonly Candidate[]> {
  const spec = SEARCH_SPEC[request.tag];
  let raw: readonly GooglePlace[] = [];

  // Text Search understands intent ("best street food in Osaka") in a way that
  // Nearby Search cannot; Nearby is the fallback when the query returns little.
  if (spec.textQuery) {
    raw = await textSearch({
      query: spec.textQuery.replace('{place}', request.destinationName),
      bias: { center: request.centre, radiusMeters: request.radiusMeters },
      maxResults: 20,
    });
    await recordApiUsage({
      provider: 'google_places',
      sku: 'places.textsearch.pro',
      units: 1,
      tripId: context.tripId,
      jobId: context.jobId,
    });
  }

  if (raw.length < 8 && spec.includedTypes.length > 0) {
    const nearby = await nearbySearch({
      center: request.centre,
      radiusMeters: request.radiusMeters,
      includedTypes: [...spec.includedTypes],
      maxResults: 20,
    });
    await recordApiUsage({
      provider: 'google_places',
      sku: 'places.nearbysearch.pro',
      units: 1,
      tripId: context.tripId,
      jobId: context.jobId,
    });
    raw = [...raw, ...nearby];
  }

  const usable = raw.filter(isUsable);
  if (usable.length === 0) return [];

  const idMap = await upsertPlaces(usable, request.destinationId);

  const entries = usable.flatMap((p) => {
    const placeId = idMap.get(p.id);
    return placeId ? [{ placeId, googlePlaceId: p.id }] : [];
  });

  const hydrated = await hydratePlaces(entries, context);

  return entries.flatMap((entry) => {
    const hydration = hydrated.get(entry.placeId);
    if (!hydration?.location) return [];
    return [
      {
        placeId: entry.placeId,
        googlePlaceId: entry.googlePlaceId,
        tags: [request.tag],
        hydration,
        location: hydration.location,
      },
    ];
  });
}

function isUsable(place: GooglePlace): boolean {
  if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') return false;
  if (!place.location) return false;
  // `tourist_attraction` is broad enough to return a well-reviewed car park.
  return !(place.types ?? []).some((t) => EXCLUDED_TYPES.has(t));
}

function dedupeById(candidates: readonly Candidate[]): readonly Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const c of candidates) {
    if (seen.has(c.googlePlaceId)) continue;
    seen.add(c.googlePlaceId);
    out.push(c);
  }
  return out;
}

export function distanceFrom(candidate: Candidate, point: LatLng | null): number | null {
  return point ? Math.round(haversineMeters(candidate.location, point)) : null;
}
