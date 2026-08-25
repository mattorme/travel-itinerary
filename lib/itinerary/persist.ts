import 'server-only';
import { createAdminClient } from '@/lib/db/supabase/admin';
import type { TripRequestParsed } from '@/domain/schemas/trip-request';
import { estimateTripCost } from '@/domain/cost/estimate';
import type { TripDay } from '@/domain/types/itinerary';
import { asActivityId, asTripDayId, type TripId } from '@/domain/types/ids';
import type { DraftItinerary } from './draft';
import { usdRateFor } from './fx';

/**
 * Draft -> database.
 *
 * One transaction-shaped write per trip: days and activities are inserted in
 * bulk, then the trip row is finalised with the totals. Generation-time context
 * (slot ids, opening hours, USD figures) is deliberately dropped here — it has
 * no business in the persisted trip.
 */
export async function persistItinerary(
  tripId: TripId,
  draft: DraftItinerary,
  request: TripRequestParsed,
): Promise<void> {
  const admin = createAdminClient();
  const fx = await usdRateFor(request.currency);

  // Clear any partial output from a previous attempt so a retry is idempotent.
  await admin.from('trip_days').delete().eq('trip_id', tripId);

  const dayRows = draft.days.map((day) => ({
    trip_id: tripId,
    day_index: day.dayIndex,
    date: day.date,
    title: day.title,
    summary: day.summary,
    destination_id: day.destinationId,
    notes: day.unfilledSlots.length > 0 ? formatUnfilled(day.unfilledSlots) : null,
  }));

  const { data: insertedDays, error: dayError } = await admin
    .from('trip_days')
    .insert(dayRows)
    .select('id, day_index');

  if (dayError || !insertedDays) {
    throw new Error(`Failed to persist trip days: ${dayError?.message ?? 'no rows'}`);
  }

  const dayIdByIndex = new Map(insertedDays.map((d) => [d.day_index, d.id]));

  const activityRows = draft.days.flatMap((day) => {
    const dayId = dayIdByIndex.get(day.dayIndex);
    if (!dayId) return [];
    return day.activities.map((activity) => ({
      trip_day_id: dayId,
      order_index: activity.orderIndex,
      kind: activity.kind,
      place_id: activity.placeId,
      custom_name: null,
      title: activity.title,
      description: activity.description,
      reason: activity.reason,
      start_time: activity.startMinute !== null ? toTime(activity.startMinute) : null,
      end_time: activity.endMinute !== null ? toTime(activity.endMinute) : null,
      duration_minutes: activity.durationMinutes,
      estimated_cost: round2(activity.estimatedCostUsd * fx),
      cost_basis: 'modelled' as const,
      inbound_travel: activity.inboundTravel
        ? JSON.parse(JSON.stringify(activity.inboundTravel))
        : null,
      booking_url: activity.bookingUrl ?? activity.websiteUri,
      source: 'generated' as const,
    }));
  });

  if (activityRows.length > 0) {
    const { error } = await admin.from('activities').insert(activityRows);
    if (error) throw new Error(`Failed to persist activities: ${error.message}`);
  }

  // Cost is computed from the persisted shape, not the draft, so the number the
  // user sees always matches the itinerary that was actually stored.
  const daysForCost: TripDay[] = draft.days.map((day) => ({
    id: asTripDayId(dayIdByIndex.get(day.dayIndex) ?? day.dayIndex.toString()),
    dayIndex: day.dayIndex,
    date: day.date,
    title: day.title,
    summary: day.summary,
    destinationId: day.destinationId,
    estimatedCost: null,
    notes: null,
    activities: day.activities.map((a) => ({
      id: asActivityId(a.slotId),
      orderIndex: a.orderIndex,
      kind: a.kind,
      place: null,
      customName: null,
      title: a.title,
      description: a.description,
      reason: a.reason,
      startMinute: a.startMinute,
      endMinute: a.endMinute,
      durationMinutes: a.durationMinutes,
      estimatedCost: round2(a.estimatedCostUsd * fx),
      costBasis: 'modelled',
      inboundTravel: a.inboundTravel,
      bookingUrl: null,
      isLocked: false,
      source: 'generated',
    })),
  }));

  const { breakdown, perDay } = estimateTripCost(daysForCost, draft.costInputs, fx);

  for (const day of perDay) {
    const dayId = dayIdByIndex.get(day.dayIndex);
    if (dayId) {
      await admin.from('trip_days').update({ estimated_cost: day.total }).eq('id', dayId);
    }
  }

  const { error: tripError } = await admin
    .from('trips')
    .update({
      title: draft.title,
      subtitle: draft.subtitle,
      summary: draft.summary,
      highlights: [...draft.highlights],
      hero_image_url: draft.cover?.url ?? null,
      hero_credit: draft.cover
        ? JSON.parse(JSON.stringify({ ...draft.cover.credit, colour: draft.cover.colour, altText: draft.cover.altText }))
        : null,
      estimated_cost_total: breakdown.total,
      estimated_cost_breakdown: JSON.parse(JSON.stringify(breakdown)),
      status: 'ready',
      moderation_state: 'approved',
    })
    .eq('id', tripId);

  if (tripError) throw new Error(`Failed to finalise trip: ${tripError.message}`);

  await admin.from('trip_destinations').upsert(
    {
      trip_id: tripId,
      destination_id: draft.destination.id,
      order_index: 0,
      first_day_index: 1,
      nights: Math.max(1, request.dates.durationDays - 1),
    },
    { onConflict: 'trip_id,order_index' },
  );

  await admin.rpc('bump_destination_trip_count', { d: draft.destination.id }).then(
    () => undefined,
    () => undefined, // best-effort counter; never fails a generation
  );
}

function formatUnfilled(slots: readonly { slotId: string; why: string }[]): string {
  return slots.map((s) => s.why).join(' ');
}

function toTime(minute: number): string {
  const wrapped = ((minute % 1440) + 1440) % 1440;
  const h = String(Math.floor(wrapped / 60)).padStart(2, '0');
  const m = String(wrapped % 60).padStart(2, '0');
  return `${h}:${m}:00`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
