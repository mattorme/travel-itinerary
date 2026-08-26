'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/db/supabase/server';
import { getOrCreateSessionUser } from '@/lib/auth/session';
import { guardRealAccount } from '@/lib/auth/guards';
import { moderateText } from '@/lib/moderation';
import type { ActionResult } from './trip-actions';

/**
 * Follows and comments.
 *
 * Both are gated on a real account. An anonymous session is the right default
 * for planning and cloning — it removes a sign-up wall from the growth loop —
 * but a social graph and a public comment thread need someone accountable
 * behind them. The database enforces the same rule, so this is the good error
 * message rather than the guarantee.
 */

export async function toggleFollow(username: string): Promise<ActionResult<{ following: boolean }>> {
  const guard = await guardRealAccount('follow people');
  if (!guard.ok) return guard;
  const user = guard.user;

  const supabase = await createClient();
  const { data: target } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (!target) return { ok: false, error: 'We could not find that person.' };
  if (target.id === user.id) return { ok: false, error: 'You cannot follow yourself.' };

  const { data: existing } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', user.id)
    .eq('followee_id', target.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('followee_id', target.id);
    revalidatePath(`/u/${username}`);
    return { ok: true, data: { following: false } };
  }

  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: user.id, followee_id: target.id });

  if (error) {
    return {
      ok: false,
      error: error.code === '42501' ? 'Create an account to follow people.' : 'That did not work.',
    };
  }

  revalidatePath(`/u/${username}`);
  return { ok: true, data: { following: true } };
}

export async function postComment(
  tripId: string,
  tripSlug: string,
  body: string,
): Promise<ActionResult<{ pending: boolean }>> {
  const guard = await guardRealAccount('leave a comment', 'comment');
  if (!guard.ok) return guard;
  const user = guard.user;

  const text = body.trim();
  if (text.length < 2) return { ok: false, error: 'Say a little more than that.' };
  if (text.length > 2000) return { ok: false, error: 'That is a bit long — 2000 characters max.' };


  // Comments land on a page that can be indexed, so nothing is published until
  // it has been through moderation.
  const verdict = await moderateText(text);
  if (verdict.action === 'block') {
    return { ok: false, error: 'That comment could not be posted.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('comments')
    .insert({ trip_id: tripId, author_id: user.id, body: text });

  if (error) {
    return {
      ok: false,
      error: error.code === '42501' ? 'Create an account to leave a comment.' : 'We could not post that.',
    };
  }

  revalidatePath(`/t/${tripSlug}`);
  return { ok: true, data: { pending: verdict.action === 'review' } };
}

export async function deleteComment(
  commentId: string,
  tripSlug: string,
): Promise<ActionResult> {
  const guard = await guardRealAccount('do that');
  if (!guard.ok) return guard;
  const user = guard.user;

  const supabase = await createClient();
  // RLS already restricts updates to the author; this is the readable error.
  const { error } = await supabase
    .from('comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', commentId)
    .eq('author_id', user.id);

  if (error) return { ok: false, error: 'We could not remove that.' };

  revalidatePath(`/t/${tripSlug}`);
  return { ok: true, data: undefined };
}

/** Bookmark a trip. Works anonymously — saving is part of the planning loop. */
export async function toggleSaveTrip(
  tripId: string,
): Promise<ActionResult<{ saved: boolean }>> {
  const user = await getOrCreateSessionUser();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('trip_saves')
    .select('trip_id')
    .eq('trip_id', tripId)
    .eq('profile_id', user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from('trip_saves').delete().eq('trip_id', tripId).eq('profile_id', user.id);
    revalidatePath('/me/saved');
    return { ok: true, data: { saved: false } };
  }

  const { error } = await supabase
    .from('trip_saves')
    .insert({ trip_id: tripId, profile_id: user.id });

  if (error) return { ok: false, error: 'We could not save that.' };

  revalidatePath('/me/saved');
  return { ok: true, data: { saved: true } };
}
