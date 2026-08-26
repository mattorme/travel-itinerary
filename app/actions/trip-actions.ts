'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/db/supabase/server';
import { getOrCreateSessionUser } from '@/lib/auth/session';
import { guardTripEditor } from '@/lib/auth/guards';
import { checkLimit } from '@/lib/ratelimit';
import { recordTripEvent } from '@/lib/itinerary/events';
import { asTripId, type TripId } from '@/domain/types/ids';

/**
 * Server actions for trip-level operations.
 *
 * Every one derives identity from the session — never from the arguments — and
 * runs through the RLS-bound client so the database is still the backstop if a
 * check here is ever wrong.
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * "Make this trip yours."
 *
 * Works logged out: an anonymous session is created on the spot, so the clone
 * succeeds in one tap and the account prompt comes later, at save-or-share,
 * which is the moment someone actually wants an account.
 */
export async function cloneTrip(sourceTripId: string): Promise<ActionResult<{ slug: string }>> {
  const user = await getOrCreateSessionUser();

  const limit = await checkLimit('clone', user.id);
  if (!limit.allowed) {
    return { ok: false, error: 'You have copied a lot of trips just now. Try again shortly.' };
  }

  await recordTripEvent({ tripId: asTripId(sourceTripId), type: 'clone_start' });

  const supabase = await createClient();
  const { data: newTripId, error } = await supabase.rpc('clone_trip', {
    source_trip_id: sourceTripId,
  });

  if (error || !newTripId) {
    // The RPC raises 42501 for "not yours to copy" and P0002 for "gone".
    const message =
      error?.code === '42501'
        ? 'That trip is not shared publicly.'
        : 'We could not copy that trip. It may have been removed.';
    return { ok: false, error: message };
  }

  const { data: created } = await supabase
    .from('trips')
    .select('slug')
    .eq('id', newTripId)
    .single();

  revalidatePath(`/t/${created?.slug ?? ''}`);
  return { ok: true, data: { slug: created?.slug ?? '' } };
}

export async function setTripVisibility(
  tripId: string,
  visibility: 'private' | 'unlisted' | 'public',
): Promise<ActionResult<{ visibility: string }>> {
  const guard = await guardTripEditor(tripId);
  if (!guard.ok) return guard;

  const supabase = await createClient();
  const { error } = await supabase.from('trips').update({ visibility }).eq('id', tripId);
  if (error) return { ok: false, error: 'We could not update sharing for this trip.' };

  revalidatePath(`/trips/${tripId}`);
  return { ok: true, data: { visibility } };
}

export async function toggleLike(tripId: string): Promise<ActionResult<{ liked: boolean }>> {
  const user = await getOrCreateSessionUser();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('trip_likes')
    .select('trip_id')
    .eq('trip_id', tripId)
    .eq('profile_id', user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from('trip_likes').delete().eq('trip_id', tripId).eq('profile_id', user.id);
    return { ok: true, data: { liked: false } };
  }

  const { error } = await supabase
    .from('trip_likes')
    .insert({ trip_id: tripId, profile_id: user.id });

  if (error) return { ok: false, error: 'We could not save that.' };
  return { ok: true, data: { liked: true } };
}

export async function recordShare(tripId: string, channel: string): Promise<void> {
  await recordTripEvent({ tripId: asTripId(tripId), type: 'share', channel });
}

export async function deleteTrip(tripId: string): Promise<ActionResult | void> {
  const guard = await guardTripEditor(tripId);
  if (!guard.ok) return guard;

  const supabase = await createClient();
  // Soft delete: existing clones keep their attribution, and the row stays
  // available for the lineage graph.
  const { error } = await supabase
    .from('trips')
    .update({ deleted_at: new Date().toISOString(), visibility: 'private' })
    .eq('id', tripId);

  if (error) return { ok: false, error: 'We could not delete that trip.' };
  redirect('/me');
}

