import 'server-only';
import { createAdminClient } from '@/lib/db/supabase/admin';
import { scheduleDay, type ScheduleItem } from '@/domain/sequencing/schedule';
import { estimateTravelSeconds, haversineMeters, inferMode } from '@/domain/types/geo';
import type { Pace, TransportMode } from '@/domain/types/taxonomy';
import type { OpeningHours, TravelLeg } from '@/domain/types/itinerary';

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
    lockedStart: activity.is_locked && activity.start_time ? toMinute(activity.start_time) : null,
  }));

  const { scheduled } = scheduleDay(items, trip.pace, 2);
  const times = new Map(scheduled.map((s) => [s.id, s]));

  for (const [index, activity] of activities.entries()) {
    const time = times.get(activity.id);
    const leg = legs[index];
    await admin
      .from('activities')
      .update({
        start_time: time ? toTime(time.startMinute) : null,
        end_time: time ? toTime(time.endMinute) : null,
        inbound_travel: leg ? JSON.parse(JSON.stringify(leg)) : null,
      })
      .eq('id', activity.id);
  }
}

function toMinute(time: string): number {
  const [h = '0', m = '0'] = time.split(':');
  return Number(h) * 60 + Number(m);
}

function toTime(minute: number): string {
  const wrapped = ((minute % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}:00`;
}
