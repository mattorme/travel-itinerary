import 'server-only';
import { centroid, haversineMeters, type LatLng } from '@/domain/types/geo';
import { rankCandidates } from '@/domain/ranking/rank';
import type { ExperienceTag, TravelStyle } from '@/domain/types/taxonomy';
import { asPlaceId, type PlaceId, type TripId } from '@/domain/types/ids';
import type { PriceLevel } from '@/domain/types/itinerary';
import { createAdminClient } from '@/lib/db/supabase/admin';
import { hydratePlaces } from '@/lib/google/places/cache';
import { SEARCH_SPEC, tagsForGoogleTypes } from '@/lib/google/places/taxonomy';

/**
 * Alternatives for a stop the traveller does not want.
 *
 * Reads the shared destination corpus rather than calling Google, so swapping a
 * restaurant costs nothing for any destination somebody has already planned. It
 * is the same ranking the generator used, with the day's actual centre of
 * gravity — so the suggestions keep the day tight instead of scattering it,
 * which is exactly what a naive "show me other restaurants" list would do.
 */

export interface Alternative {
  readonly placeId: PlaceId;
  readonly name: string;
  readonly rating: number | null;
  readonly reviewCount: number | null;
  readonly priceLevel: PriceLevel | null;
  readonly summary: string | null;
  readonly address: string | null;
  readonly hasPhoto: boolean;
  /** Metres from the rest of the day. The reason to pick one over another. */
  readonly metersFromDay: number | null;
  readonly mapsUrl: string | null;
}

const SHORTLIST = 8;

export async function findAlternatives(args: {
  tripId: TripId;
  activityId: string;
}): Promise<readonly Alternative[]> {
  const admin = createAdminClient();

  const { data: activity } = await admin
    .from('activities')
    .select('id, trip_day_id, place_id, places(id, tags, destination_id)')
    .eq('id', args.activityId)
    .maybeSingle();

  if (!activity) return [];

  const place = activity.places;
  if (!place?.destination_id) return [];

  const tag = (place.tags?.[0] ?? 'landmark') as ExperienceTag;

  const [{ data: trip }, { data: dayActivities }, { data: pool }] = await Promise.all([
    admin.from('trips').select('travel_style').eq('id', args.tripId).maybeSingle(),
    admin
      .from('activities')
      .select('id, place_id')
      .eq('trip_day_id', activity.trip_day_id),
    admin
      .from('places')
      .select('id, google_place_id, tags')
      .eq('destination_id', place.destination_id)
      .contains('tags', [tag])
      .limit(80),
  ]);

  if (!pool || pool.length === 0) return [];

  // Everything already in the trip is excluded, not just this day: the whole
  // point of the generator's duplicate rule is that a trip does not repeat
  // itself, and a swap must not quietly break that.
  const { data: usedRows } = await admin
    .from('activities')
    .select('place_id, trip_days!inner(trip_id)')
    .eq('trip_days.trip_id', args.tripId)
    .not('place_id', 'is', null);

  const used = new Set(
    (usedRows ?? []).map((r) => r.place_id).filter((id): id is string => id !== null),
  );

  const hydrated = await hydratePlaces(
    pool.map((p) => ({ placeId: asPlaceId(p.id), googlePlaceId: p.google_place_id })),
  );

  // The day's centre of gravity, computed from the stops that are staying.
  const dayPlaceIds = (dayActivities ?? [])
    .filter((a) => a.id !== args.activityId && a.place_id !== null)
    .map((a) => asPlaceId(a.place_id as string));

  const dayHydrated = await hydratePlaces(
    dayPlaceIds.map((id) => ({ placeId: id, googlePlaceId: '' })),
  ).catch(() => new Map());

  const dayPoints = dayPlaceIds
    .map((id) => dayHydrated.get(id)?.location ?? hydrated.get(id)?.location ?? null)
    .filter((p): p is LatLng => p !== null);

  const dayCentre = centroid(dayPoints);

  const rankable = pool.flatMap((p) => {
    const placeId = asPlaceId(p.id);
    const h = hydrated.get(placeId);
    if (!h?.location) return [];
    if (h.businessStatus === 'CLOSED_PERMANENTLY') return [];
    return [
      {
        id: p.id,
        location: h.location,
        rating: h.rating,
        userRatingCount: h.userRatingCount,
        priceLevel: h.priceLevel,
        tags: (p.tags ?? []) as readonly ExperienceTag[],
        hasEditorialSummary: h.editorialSummary !== null,
        ourSignal: 0,
      },
    ];
  });

  const ranked = rankCandidates(
    rankable,
    {
      tag,
      dayCentre,
      style: (trip?.travel_style ?? 'balanced') as TravelStyle,
      minReviews: SEARCH_SPEC[tag]?.minReviews ?? 100,
      excludedIds: used,
    },
    SHORTLIST,
  );

  return ranked.flatMap((scored) => {
    const h = hydrated.get(asPlaceId(scored.id));
    if (!h) return [];
    return [
      {
        placeId: asPlaceId(scored.id),
        name: h.displayName,
        rating: h.rating,
        reviewCount: h.userRatingCount,
        priceLevel: h.priceLevel,
        summary: h.editorialSummary,
        address: h.formattedAddress,
        hasPhoto: h.photoNames.length > 0,
        metersFromDay:
          dayCentre && h.location ? Math.round(haversineMeters(h.location, dayCentre)) : null,
        mapsUrl: h.googleMapsUri,
      },
    ];
  });
}

/**
 * Places matching a free-text query inside the trip's destination, for adding a
 * stop the generator never considered.
 *
 * Corpus-only by design. A traveller adding "that ramen place my friend
 * mentioned" is not worth a billed Places search on every keystroke, and the
 * corpus already holds everything the destination has been asked for. When it
 * genuinely is not there, they can add it as a free-text stop instead.
 */
export async function searchTripPlaces(args: {
  tripId: TripId;
  query: string;
  limit?: number;
}): Promise<readonly Alternative[]> {
  const query = args.query.trim();
  if (query.length < 2) return [];

  const admin = createAdminClient();

  const { data: destinations } = await admin
    .from('trip_destinations')
    .select('destination_id')
    .eq('trip_id', args.tripId);

  const destinationIds = (destinations ?? []).map((d) => d.destination_id);
  if (destinationIds.length === 0) return [];

  const { data: pool } = await admin
    .from('places')
    .select('id, google_place_id, tags')
    .in('destination_id', destinationIds)
    .limit(400);

  if (!pool || pool.length === 0) return [];

  const hydrated = await hydratePlaces(
    pool.map((p) => ({ placeId: asPlaceId(p.id), googlePlaceId: p.google_place_id })),
  );

  const needle = query.toLowerCase();
  const matches = pool
    .flatMap((p) => {
      const h = hydrated.get(asPlaceId(p.id));
      if (!h?.location) return [];
      const haystack = `${h.displayName} ${h.editorialSummary ?? ''}`.toLowerCase();
      const index = haystack.indexOf(needle);
      if (index === -1) return [];
      return [{ place: p, hydration: h, index }];
    })
    // A match at the start of the name beats one buried in a description.
    .sort((a, b) => a.index - b.index || (b.hydration.rating ?? 0) - (a.hydration.rating ?? 0))
    .slice(0, args.limit ?? 12);

  return matches.map(({ place, hydration }) => ({
    placeId: asPlaceId(place.id),
    name: hydration.displayName,
    rating: hydration.rating,
    reviewCount: hydration.userRatingCount,
    priceLevel: hydration.priceLevel,
    summary: hydration.editorialSummary,
    address: hydration.formattedAddress,
    hasPhoto: hydration.photoNames.length > 0,
    metersFromDay: null,
    mapsUrl: hydration.googleMapsUri,
  }));
}

