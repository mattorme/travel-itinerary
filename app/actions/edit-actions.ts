'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/db/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { assertCanEditTrip, ForbiddenError, NotFoundError } from '@/lib/auth/authorization';
import { checkLimit } from '@/lib/ratelimit';
import { asPlaceId, asTripId } from '@/domain/types/ids';
import { appendActivity, reflowDay, swapActivityPlace } from '@/lib/itinerary/edit';
import type { ActionResult } from './trip-actions';

/**
 * Itinerary editing, as a fixed set of commands.
 *
 * Deliberately NOT a generic PATCH. A free-form update endpoint means every
 * invariant the pipeline established — no overlaps, travel time accounted for,
 * costs summed, order contiguous — can be violated by a client, and there is
 * nowhere sensible to re-establish them. Each command below re-runs the same
 * scheduling pass the generator used, so an edited trip is as valid as a
 * generated one. See docs/ARCHITECTURE.md §2.
 */

async function authorise(tripId: string): Promise<ActionResult<void> | null> {
  try {
    const user = await requireUser();
    await assertCanEditTrip(asTripId(tripId), user);
    const limit = await checkLimit('mutation', user.id);
    if (!limit.allowed) {
      return { ok: false, error: 'Slow down a moment, then try again.' };
    }
    return null;
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: 'This is not your trip.' };
    if (error instanceof NotFoundError) return { ok: false, error: 'We could not find that trip.' };
    return { ok: false, error: 'You need to be signed in to edit this.' };
  }
}

/** Move an activity within its day. Everything after it re-times. */
export async function moveActivity(
  tripId: string,
  activityId: string,
  toIndex: number,
): Promise<ActionResult> {
  const denied = await authorise(tripId);
  if (denied) return denied;

  const supabase = await createClient();
  const { data: activity } = await supabase
    .from('activities')
    .select('id, trip_day_id')
    .eq('id', activityId)
    .maybeSingle();

  if (!activity) return { ok: false, error: 'We could not find that activity.' };

  const { data: siblings } = await supabase
    .from('activities')
    .select('id, order_index')
    .eq('trip_day_id', activity.trip_day_id)
    .order('order_index');

  if (!siblings) return { ok: false, error: 'We could not reorder that day.' };

  const ids = siblings.map((s) => s.id);
  const from = ids.indexOf(activityId);
  if (from === -1) return { ok: false, error: 'We could not find that activity.' };

  const target = Math.max(0, Math.min(ids.length - 1, toIndex));
  ids.splice(target, 0, ...ids.splice(from, 1));

  // One RPC, not a loop of updates: the unique (trip_day_id, order_index)
  // constraint is deferrable, but PostgREST puts each REST update in its own
  // transaction, so a per-row loop collides on the very first swap.
  const { error } = await supabase.rpc('reorder_activities', {
    p_day_id: activity.trip_day_id,
    p_ordered_ids: ids,
  });
  if (error) return { ok: false, error: 'We could not reorder that day.' };

  await reflowDay(activity.trip_day_id);
  revalidatePath(`/trips/${tripId}`);
  return { ok: true, data: undefined };
}

export async function removeActivity(
  tripId: string,
  activityId: string,
): Promise<ActionResult> {
  const denied = await authorise(tripId);
  if (denied) return denied;

  const supabase = await createClient();
  const { data: activity } = await supabase
    .from('activities')
    .select('trip_day_id')
    .eq('id', activityId)
    .maybeSingle();

  const { error } = await supabase.from('activities').delete().eq('id', activityId);
  if (error) return { ok: false, error: 'We could not remove that.' };

  if (activity) await reflowDay(activity.trip_day_id);
  revalidatePath(`/trips/${tripId}`);
  return { ok: true, data: undefined };
}

/**
 * Swap a stop for a different place.
 *
 * Alternatives come from the shared destination corpus, so this costs nothing
 * for anywhere somebody has already planned. The authored title and description
 * belonged to the old venue and would be wrong for the new one, so they are
 * cleared rather than carried across — a confident description of the wrong
 * restaurant is worse than none at all.
 */
export async function replaceActivity(
  tripId: string,
  activityId: string,
  placeId: string,
): Promise<ActionResult> {
  const denied = await authorise(tripId);
  if (denied) return denied;

  const supabase = await createClient();
  const { data: activity } = await supabase
    .from('activities')
    .select('id, trip_day_id')
    .eq('id', activityId)
    .maybeSingle();

  if (!activity) return { ok: false, error: 'We could not find that activity.' };

  const swapped = await swapActivityPlace(activityId, asPlaceId(placeId));
  if (!swapped.ok) return { ok: false, error: swapped.error };

  await reflowDay(activity.trip_day_id);
  revalidatePath(`/trips/${tripId}`);
  return { ok: true, data: undefined };
}

/**
 * Add a stop to a day.
 *
 * Appended, then re-timed — the scheduler decides whether it actually fits, so
 * a day cannot be quietly pushed past its pace by adding things one at a time.
 */
export async function addActivity(
  tripId: string,
  dayId: string,
  input: { placeId: string } | { customName: string },
): Promise<ActionResult> {
  const denied = await authorise(tripId);
  if (denied) return denied;

  const added = await appendActivity(dayId, input);
  if (!added.ok) return { ok: false, error: added.error };

  await reflowDay(dayId);
  revalidatePath(`/trips/${tripId}`);
  return { ok: true, data: undefined };
}

/**
 * Pin an activity so repair and reflow will not move it.
 * This is how "we already have a table booked at 7" survives every later edit.
 */
export async function lockActivity(
  tripId: string,
  activityId: string,
  locked: boolean,
): Promise<ActionResult> {
  const denied = await authorise(tripId);
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase
    .from('activities')
    .update({ is_locked: locked })
    .eq('id', activityId);

  if (error) return { ok: false, error: 'We could not pin that.' };
  revalidatePath(`/trips/${tripId}`);
  return { ok: true, data: undefined };
}

/** Edit the authored fields. Never touches the place reference. */
export async function editActivityText(
  tripId: string,
  activityId: string,
  fields: { title?: string; description?: string },
): Promise<ActionResult> {
  const denied = await authorise(tripId);
  if (denied) return denied;

  // Typed literal rather than Record<string, string>: the generated row types
  // reject an index signature, and that rejection is doing real work — it is
  // what stops a column name being passed through from a caller.
  const patch: { title?: string; description?: string } = {};
  if (fields.title !== undefined) patch.title = fields.title.trim().slice(0, 200);
  if (fields.description !== undefined) patch.description = fields.description.trim().slice(0, 1200);
  if (Object.keys(patch).length === 0) return { ok: true, data: undefined };

  const supabase = await createClient();
  const { error } = await supabase.from('activities').update(patch).eq('id', activityId);
  if (error) return { ok: false, error: 'We could not save that change.' };

  revalidatePath(`/trips/${tripId}`);
  return { ok: true, data: undefined };
}

/** Set a cost the traveller actually knows, replacing our estimate. */
export async function setActivityCost(
  tripId: string,
  activityId: string,
  cost: number | null,
): Promise<ActionResult> {
  const denied = await authorise(tripId);
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase
    .from('activities')
    .update({
      estimated_cost: cost,
      // 'user' survives re-estimation: a figure the traveller supplied must not
      // be overwritten by the model next time costs are recomputed.
      cost_basis: cost === null ? 'modelled' : 'user',
    })
    .eq('id', activityId);

  if (error) return { ok: false, error: 'We could not save that cost.' };
  revalidatePath(`/trips/${tripId}`);
  return { ok: true, data: undefined };
}

export async function editDay(
  tripId: string,
  dayId: string,
  fields: { title?: string; notes?: string },
): Promise<ActionResult> {
  const denied = await authorise(tripId);
  if (denied) return denied;

  const patch: { title?: string; notes?: string } = {};
  if (fields.title !== undefined) patch.title = fields.title.trim().slice(0, 120);
  if (fields.notes !== undefined) patch.notes = fields.notes.trim().slice(0, 1200);
  if (Object.keys(patch).length === 0) return { ok: true, data: undefined };

  const supabase = await createClient();
  const { error } = await supabase.from('trip_days').update(patch).eq('id', dayId);
  if (error) return { ok: false, error: 'We could not save that change.' };

  revalidatePath(`/trips/${tripId}`);
  return { ok: true, data: undefined };
}
