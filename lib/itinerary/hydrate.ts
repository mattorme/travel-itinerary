import 'server-only';
import type { QueryData } from '@supabase/supabase-js';
import { createClient } from '@/lib/db/supabase/server';
import { createAdminClient } from '@/lib/db/supabase/admin';
import { hydratePlaces } from '@/lib/google/places/cache';
import {
  asActivityId,
  asDestinationId,
  asPlaceId,
  asProfileId,
  asTripDayId,
  asTripId,
  type PlaceId,
  type TripId,
} from '@/domain/types/ids';
import type {
  Activity,
  CostBreakdown,
  ImageCredit,
  Itinerary,
  Party,
  PlaceHydration,
  PlaceRef,
  TravelLeg,
  TripDay,
  TripDestination,
} from '@/domain/types/itinerary';
import {
  FOOD_PREFS,
  INTERESTS,
  membersOf,
  type ExperienceTag,
} from '@/domain/types/taxonomy';
import { jsonAs } from '@/lib/db/rows';
import { sqlTimeToMinute } from '@/lib/utils/time';

/**
 * Database -> domain model.
 *
 * Reading a trip is a *hydration*: the plan is ours and permanent, the place
 * facts are borrowed from Google under a TTL and refreshed on demand. Anything
 * whose cache has lapsed comes back with `hydrated: null` and the UI renders
 * from the authored title — a trip page never goes blank because a cache
 * expired. See docs/ARCHITECTURE.md §3.
 */

const TRIP_SELECT = `
  id, slug, title, subtitle, status, visibility, summary, highlights,
  start_date, end_date, duration_days, date_mode, party, currency,
  budget_total, budget_daily, travel_style, pace, interests, transport_modes,
  food_prefs, accommodation_pref, user_notes,
  estimated_cost_total, estimated_cost_breakdown, hero_image_url, hero_credit,
  forked_from_trip_id, forked_from_version, root_trip_id,
  origin_creator_username, origin_title, version,
  like_count, save_count, view_count, clone_count, share_count, is_indexable,
  published_at, updated_at, owner_id,
  profiles:owner_id ( id, username, display_name, avatar_url ),
  trip_destinations ( order_index, first_day_index, nights, anchor_place_id, anchor_label,
                      destinations ( id, name, country_code, timezone, lat, lng ) ),
  trip_days (
    id, day_index, date, title, summary, destination_id, estimated_cost, notes,
    activities (
      id, order_index, kind, place_id, custom_name, title, description, reason,
      start_time, end_time, duration_minutes, estimated_cost, cost_basis,
      inbound_travel, booking_url, is_locked, source,
      places ( id, google_place_id, tags )
    )
  )
`;

/**
 * The shape TRIP_SELECT returns, derived from the select string rather than
 * restated. supabase-js parses the literal, so the nested days, activities,
 * places and profile all come back fully typed — and changing a column in
 * TRIP_SELECT changes this with it, which a hand-written interface could not do.
 */
type TripRow = QueryData<ReturnType<typeof tripQuery>>;

function tripQuery(db: Awaited<ReturnType<typeof createClient>>) {
  return db.from('trips').select(TRIP_SELECT).is('deleted_at', null).maybeSingle();
}

export async function loadTripBySlug(slug: string): Promise<Itinerary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('trips')
    .select(TRIP_SELECT)
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) return null;
  return assemble(data);
}

export async function loadTripById(tripId: TripId): Promise<Itinerary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('trips')
    .select(TRIP_SELECT)
    .eq('id', tripId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) return null;
  return assemble(data);
}

type TripDayRow = NonNullable<TripRow>['trip_days'][number];
type ActivityRow = TripDayRow['activities'][number];

async function assemble(row: NonNullable<TripRow>): Promise<Itinerary> {
  const rawDays = [...(row.trip_days ?? [])].sort((a, b) => a.day_index - b.day_index);

  // One hydration pass for the whole trip rather than per activity.
  const placeEntries: { placeId: PlaceId; googlePlaceId: string }[] = [];
  for (const day of rawDays) {
    for (const activity of day.activities ?? []) {
      if (activity.places?.id) {
        placeEntries.push({
          placeId: asPlaceId(activity.places.id),
          googlePlaceId: activity.places.google_place_id,
        });
      }
    }
  }

  const hydrated = await hydrateForRead(placeEntries);

  const days: TripDay[] = rawDays.map((day) => ({
    id: asTripDayId(day.id),
    dayIndex: day.day_index,
    date: day.date,
    title: day.title,
    summary: day.summary,
    destinationId: day.destination_id ? asDestinationId(day.destination_id) : null,
    estimatedCost: day.estimated_cost !== null ? Number(day.estimated_cost) : null,
    notes: day.notes,
    activities: [...(day.activities ?? [])]
      .sort((a, b) => a.order_index - b.order_index)
      .map((a): Activity => toActivity(a, hydrated)),
  }));

  const destinations: TripDestination[] = [...(row.trip_destinations ?? [])]
    .filter((td) => td.destinations !== null)
    .sort((a, b) => a.order_index - b.order_index)
    .map((td) => ({
      destinationId: asDestinationId(td.destinations!.id),
      name: td.destinations!.name,
      countryCode: td.destinations!.country_code,
      timezone: td.destinations!.timezone,
      location: { lat: td.destinations!.lat, lng: td.destinations!.lng },
      orderIndex: td.order_index,
      firstDayIndex: td.first_day_index,
      nights: td.nights,
      anchorPlaceId: td.anchor_place_id ? asPlaceId(td.anchor_place_id) : null,
      anchorLabel: td.anchor_label,
    }));

  return {
    id: asTripId(row.id),
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    status: row.status,
    visibility: row.visibility,
    request: {
      destinationQuery: destinations[0]?.name ?? row.title,
      destinationId: destinations[0]?.destinationId ?? null,
      dates: {
        mode: row.date_mode,
        start: row.start_date,
        end: row.end_date,
        durationDays: row.duration_days,
      },
      party: jsonAs<Party>(row.party) ?? { adults: 2, children: [] },
      currency: row.currency,
      budgetTotal: row.budget_total !== null ? Number(row.budget_total) : null,
      budgetDaily: row.budget_daily !== null ? Number(row.budget_daily) : null,
      travelStyle: row.travel_style,
      pace: row.pace,
      interests: membersOf(INTERESTS, row.interests),
      transportModes: row.transport_modes ?? ['mixed'],
      foodPrefs: membersOf(FOOD_PREFS, row.food_prefs),
      accommodation: row.accommodation_pref,
      notes: row.user_notes,
    },
    summary: row.summary,
    highlights: row.highlights ?? [],
    destinations,
    days,
    estimatedCost: jsonAs<CostBreakdown>(row.estimated_cost_breakdown),
    heroImageUrl: row.hero_image_url,
    heroCredit: jsonAs<ImageCredit>(row.hero_credit),
    lineage: {
      forkedFromTripId: row.forked_from_trip_id ? asTripId(row.forked_from_trip_id) : null,
      forkedFromVersion: row.forked_from_version,
      rootTripId: row.root_trip_id ? asTripId(row.root_trip_id) : null,
      originCreatorUsername: row.origin_creator_username,
      originTitle: row.origin_title,
    },
    counters: {
      likes: row.like_count,
      saves: row.save_count,
      views: row.view_count,
      clones: row.clone_count,
      shares: row.share_count,
    },
    isIndexable: row.is_indexable === true,
    creator: row.profiles
      ? {
          id: asProfileId(row.profiles.id),
          username: row.profiles.username,
          displayName: row.profiles.display_name,
          avatarUrl: row.profiles.avatar_url,
        }
      : null,
    version: row.version,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

function toActivity(a: ActivityRow, hydrated: ReadonlyMap<PlaceId, PlaceHydration>): Activity {
  const placeRow = a.places;
  const place: PlaceRef | null = placeRow
    ? {
        placeId: asPlaceId(placeRow.id),
        googlePlaceId: placeRow.google_place_id,
        tags: (placeRow.tags ?? []) as readonly ExperienceTag[],
        hydrated: hydrated.get(asPlaceId(placeRow.id)) ?? null,
      }
    : null;

  return {
    id: asActivityId(a.id),
    orderIndex: a.order_index,
    kind: a.kind,
    place,
    customName: a.custom_name,
    title: a.title,
    description: a.description,
    reason: a.reason,
    startMinute: a.start_time ? sqlTimeToMinute(a.start_time) : null,
    endMinute: a.end_time ? sqlTimeToMinute(a.end_time) : null,
    durationMinutes: a.duration_minutes,
    estimatedCost: a.estimated_cost !== null ? Number(a.estimated_cost) : null,
    costBasis: a.cost_basis,
    inboundTravel: jsonAs<TravelLeg>(a.inbound_travel),
    bookingUrl: a.booking_url,
    isLocked: a.is_locked,
    source: a.source,
  };
}

/**
 * Read-path hydration.
 *
 * Serves whatever is still live immediately. Refetching stale entries would put
 * a Google round-trip on the critical path of a public page that might be going
 * viral, so a miss renders from authored content and is refreshed in the
 * background instead.
 */
async function hydrateForRead(
  entries: readonly { placeId: PlaceId; googlePlaceId: string }[],
): Promise<ReadonlyMap<PlaceId, PlaceHydration>> {
  if (entries.length === 0) return new Map();

  const admin = createAdminClient();
  const { data } = await admin
    .from('place_cache')
    .select('place_id, display_name, formatted_address, lat, lng, rating, user_rating_count, price_level, opening_hours, website_uri, google_maps_uri, editorial_summary, photo_names, business_status')
    .in('place_id', entries.map((e) => e.placeId))
    .gt('expires_at', new Date().toISOString());

  const live = new Map<PlaceId, PlaceHydration>();
  for (const row of data ?? []) {
    live.set(asPlaceId(row.place_id), {
      displayName: row.display_name ?? 'Unnamed place',
      formattedAddress: row.formatted_address,
      location: row.lat !== null && row.lng !== null ? { lat: row.lat, lng: row.lng } : null,
      rating: row.rating,
      userRatingCount: row.user_rating_count,
      priceLevel: row.price_level as PlaceHydration['priceLevel'],
      openingHours: row.opening_hours as PlaceHydration['openingHours'],
      websiteUri: row.website_uri,
      googleMapsUri: row.google_maps_uri,
      editorialSummary: row.editorial_summary,
      photoNames: row.photo_names ?? [],
      businessStatus: row.business_status,
    });
  }

  const stale = entries.filter((e) => !live.has(e.placeId));
  if (stale.length > 0) {
    // Fire and forget. The next reader gets the fresh data.
    void hydratePlaces(stale).catch((error) => {
      console.warn('[hydrate] background refresh failed', error);
    });
  }

  return live;
}

