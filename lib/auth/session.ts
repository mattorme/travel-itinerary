import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/db/supabase/server';
import type { ProfileId } from '@/domain/types/ids';
import { asProfileId } from '@/domain/types/ids';

export interface SessionUser {
  readonly id: ProfileId;
  readonly isAnonymous: boolean;
  readonly email: string | null;
  readonly username: string;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
  readonly tier: 'free' | 'pro';
}

/**
 * The authenticated caller, or null.
 *
 * `cache()` dedupes this across a single render pass — a page, its layout and
 * three components asking "who is this" costs one round trip, not four.
 *
 * Always uses getUser() rather than getSession(): getSession reads the cookie
 * without verifying it, so it must never be trusted on the server.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url, subscription_tier, is_anonymous')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  return {
    id: asProfileId(user.id),
    isAnonymous: profile.is_anonymous,
    email: user.email ?? null,
    username: profile.username,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    tier: profile.subscription_tier,
  };
});

/**
 * The caller, creating an anonymous identity if there isn't one.
 *
 * This is what makes "generate before signing up" and "clone before signing up"
 * work: an anonymous user is a real auth.users row with a real auth.uid(), so
 * RLS is uniform and signing up later upgrades the account in place — no orphan
 * rows, no claim tokens.
 */
export async function getOrCreateSessionUser(): Promise<SessionUser> {
  const existing = await getSessionUser();
  if (existing) return existing;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    throw new AuthError('Could not start a session.', { cause: error });
  }

  // The profile row is created by an auth trigger; re-read through the same path.
  const created = await getSessionUserUncached();
  if (!created) {
    throw new AuthError('Session was created but no profile could be read.');
  }
  return created;
}

/** Bypasses the per-render cache — needed immediately after a sign-in. */
async function getSessionUserUncached(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url, subscription_tier, is_anonymous')
    .eq('id', user.id)
    .single();
  if (!profile) return null;

  return {
    id: asProfileId(user.id),
    isAnonymous: profile.is_anonymous,
    email: user.email ?? null,
    username: profile.username,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    tier: profile.subscription_tier,
  };
}

export class AuthError extends Error {
  override name = 'AuthError';
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError('Authentication required.');
  return user;
}
