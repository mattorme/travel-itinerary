import 'server-only';
import { createAdminClient } from '@/lib/db/supabase/admin';
import { scheduleDay, type ScheduleItem } from '@/domain/sequencing/schedule';
import { estimateTravelSeconds, haversineMeters, inferMode } from '@/domain/types/geo';
import type { Pace, TransportMode } from '@/domain/types/taxonomy';
import type { OpeningHours, TravelLeg } from '@/domain/types/itinerary';
import { minuteToSqlTime, sqlTimeToMinute } from '@/lib/utils/time';

/**
 * Re-time a day after an edit.
 *
 * Every editing command funnels through here so an edited trip obeys the same
 * invariants a generated one does: travel accounted for, no overlaps, pinned
 * activities untouched.
 *
 * Uses cached route legs when they exist and haversine estimates otherwise —
 * an edit must never block on a Routes call, and re-routing on every drag would
 * be expensive for something the traveller may undo a second later.
 */
export async function reflowDay(tripDayId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: day } = await admin
    .from('trip_days')
    .select('id, trip_id, trips!inner(pace, transport_modes)')
    .eq('id', tripDayId)
    .maybeSingle();

  if (!day) return;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const trip = (Array.isArray((day as any).trips) ? (day as any).trips[0] : (day as any).trips) as
    | { pace: Pace; transport_modes: TransportMode[] }
    | undefined;
  /* eslint-enable @typescript-eslint/no-explicit-any */
  if (!trip) return;

  const { data: activities } = await admin
    .from('activities')
    .select('id, order_index, duration_minutes, kind, is_locked, start_time, place_id, places(id, google_place_id)')
    .eq('trip_day_id', tripDayId)
    .order('order_index');

  if (!activities || activities.length === 0) return;

  const placeIds = activities.map((a) => a.place_id).filter((id): id is string => id !== null);
  const { data: cache } = await admin
    .from('place_cache')
    .select('place_id, lat, lng, opening_hours')
    .in('place_id', placeIds)
    .gt('expires_at', new Date().toISOString());

  const geo = new Map(
    (cache ?? []).map((row) => [
      row.place_id,
      {
        location: row.lat !== null && row.lng !== null ? { lat: row.lat, lng: row.lng } : null,
        hours: row.opening_hours as OpeningHours | null,
      },
    ]),
  );

  const legs: (TravelLeg | null)[] = activities.map((activity, index) => {
    if (index === 0) return null;
    const from = geo.get(activities[index - 1]!.place_id ?? '')?.location ?? null;
    const to = geo.get(activity.place_id ?? '')?.location ?? null;
    if (!from || !to) return null;

    const meters = Math.round(haversineMeters(from, to));
    const mode = inferMode(meters, trip.transport_modes) as TransportMode;
    return {
      mode,
      minutes: Math.round(estimateTravelSeconds(from, to, mode) / 60),
      meters,
      polyline: null,
      // Honest: this is a re-estimate, not a fresh measurement.
      source: 'estimated' as const,
    };
  });

  const items: ScheduleItem[] = activities.map((activity, index) => ({
    id: activity.id,
    durationMinutes: activity.duration_minutes ?? 60,
    inboundTravel: legs[index] ?? null,
    openingHours: geo.get(activity.place_id ?? '')?.hours ?? null,
    window: null,
    isLocked: activity.is_locked,
    lockedStart: activity.is_locked && activity.start_time ? sqlTimeToMinute(activity.start_time) : null,
  }));

  const { scheduled } = scheduleDay(items, trip.pace, 2);
  const times = new Map(scheduled.map((s) => [s.id, s]));

  for (const [index, activity] of activities.entries()) {
    const time = times.get(activity.id);
    const leg = legs[index];
    await admin
      .from('activities')
      .update({
        start_time: time ? minuteToSqlTime(time.startMinute) : null,
        end_time: time ? minuteToSqlTime(time.endMinute) : null,
        inbound_travel: leg ? JSON.parse(JSON.stringify(leg)) : null,
      })
      .eq('id', activity.id);
  }
}



/**
 * Point an activity at a different place.
 *
 * Uses the admin client because it writes `place_id`, which RLS lets the owner
 * change but which needs the place row read to derive a title — and the places
 * table is service-role for writes. Authorisation happened in the action.
 */
export async function swapActivityPlace(
  activityId: string,
  placeId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const [{ data: place }, { data: cache }] = await Promise.all([
    admin.from('places').select('id, destination_id').eq('id', placeId).maybeSingle(),
    admin
      .from('place_cache')
      .select('display_name, website_uri')
      .eq('place_id', placeId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle(),
  ]);

  if (!place) return { ok: false, error: 'We could not find that place.' };

  // A place whose cached content has lapsed has no name to show. Refusing is
  // better than writing an activity titled "Unnamed place".
  if (!cache?.display_name) {
    return { ok: false, error: 'We could not load that place right now. Try again in a moment.' };
  }

  const { error } = await admin
    .from('activities')
    .update({
      place_id: placeId,
      title: cache.display_name,
      // The old copy described a different venue.
      description: null,
      reason: null,
      booking_url: cache.website_uri,
      source: 'user_added',
      // Travel and timing are recomputed by the reflow that follows.
      inbound_travel: null,
    })
    .eq('id', activityId);

  if (error) return { ok: false, error: 'We could not swap that stop.' };
  return { ok: true };
}

/** Append a stop to the end of a day. The reflow decides where it lands. */
export async function appendActivity(
  dayId: string,
  input: { placeId: string } | { customName: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data: siblings } = await admin
    .from('activities')
    .select('order_index')
    .eq('trip_day_id', dayId)
    .order('order_index', { ascending: false })
    .limit(1);

  const nextIndex = (siblings?.[0]?.order_index ?? 0) + 1;

  if ('customName' in input) {
    const name = input.customName.trim().slice(0, 200);
    if (name.length < 2) return { ok: false, error: 'Give it a name first.' };

    const { error } = await admin.from('activities').insert({
      trip_day_id: dayId,
      order_index: nextIndex,
      kind: 'activity',
      custom_name: name,
      title: name,
      duration_minutes: 60,
      source: 'user_added',
      cost_basis: 'user',
    });
    if (error) return { ok: false, error: 'We could not add that.' };
    return { ok: true };
  }

  const { data: cache } = await admin
    .from('place_cache')
    .select('display_name, website_uri')
    .eq('place_id', input.placeId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (!cache?.display_name) {
    return { ok: false, error: 'We could not load that place right now. Try again in a moment.' };
  }

  const { error } = await admin.from('activities').insert({
    trip_day_id: dayId,
    order_index: nextIndex,
    kind: 'activity',
    place_id: input.placeId,
    title: cache.display_name,
    booking_url: cache.website_uri,
    duration_minutes: 75,
    source: 'user_added',
  });

  if (error) return { ok: false, error: 'We could not add that.' };
  return { ok: true };
}
