import 'server-only';
import { createAdminClient } from '@/lib/db/supabase/admin';
import type { TripRequestParsed } from '@/domain/schemas/trip-request';
import { estimateTripCost, roundMoney } from '@/domain/cost/estimate';
import { minuteToSqlTime } from '@/lib/utils/time';
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

  // Costs are derived from the draft, not from the inserted rows, so they can
  // be computed before the insert and written with it. Doing it afterwards
  // meant one UPDATE per day — twelve extra round trips on a twelve-day trip,
  // for a value that was already known.
  const daysForCost = toDomainDays(draft, fx);
  const { breakdown, perDay } = estimateTripCost(daysForCost, draft.costInputs, fx);
  const costByDayIndex = new Map(perDay.map((day) => [day.dayIndex, day.total]));

  const dayRows = draft.days.map((day) => ({
    trip_id: tripId,
    day_index: day.dayIndex,
    date: day.date,
    title: day.title,
    summary: day.summary,
    destination_id: day.destinationId,
    estimated_cost: costByDayIndex.get(day.dayIndex) ?? null,
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
      start_time: activity.startMinute !== null ? minuteToSqlTime(activity.startMinute) : null,
      end_time: activity.endMinute !== null ? minuteToSqlTime(activity.endMinute) : null,
      duration_minutes: activity.durationMinutes,
      estimated_cost: roundMoney(activity.estimatedCostUsd * fx),
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

/**
 * The draft as the pure cost model expects it.
 *
 * Ids are placeholders: `estimateTripCost` only reads durations, kinds, costs
 * and travel legs, none of which depend on what the database assigned.
 */
function toDomainDays(draft: DraftItinerary, fx: number): TripDay[] {
  return draft.days.map((day) => ({
    id: asTripDayId(`draft-${day.dayIndex}`),
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
      estimatedCost: roundMoney(a.estimatedCostUsd * fx),
      costBasis: 'modelled' as const,
      inboundTravel: a.inboundTravel,
      bookingUrl: null,
      isLocked: false,
      source: 'generated' as const,
    })),
  }));
}

function formatUnfilled(slots: readonly { slotId: string; why: string }[]): string {
  return slots.map((s) => s.why).join(' ');
}


