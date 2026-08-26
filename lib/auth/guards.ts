import 'server-only';
import { getSessionUser, requireUser, type SessionUser } from './session';
import { assertCanEditTrip, ForbiddenError, NotFoundError } from './authorization';
import { checkLimit, type LimiterName } from '@/lib/ratelimit';
import { asTripId } from '@/domain/types/ids';

/**
 * The admission checks every server action shares.
 *
 * Each action previously repeated some arrangement of "get the session, check
 * ownership, check the rate limit, translate the failure into a sentence". Four
 * copies drifted into three different messages for the same situation, which is
 * how a user ends up being told to "sign in" when they are already signed in.
 *
 * Guards return a `Denied` on failure rather than throwing, so a caller decides
 * whether that becomes an error message or an empty list. They never surface an
 * internal error: every message here is written for the person reading it.
 */

export interface Denied {
  readonly ok: false;
  readonly error: string;
}

export type Guarded<T> = { readonly ok: true; readonly user: T } | Denied;

/**
 * The caller may edit this trip, and is not hammering us.
 *
 * `ForbiddenError` and `NotFoundError` are deliberately given different
 * sentences: "this is not your trip" and "we could not find it" are different
 * facts, and collapsing them makes a real mistake impossible to diagnose.
 */
export async function guardTripEditor(
  tripId: string,
  limiter: LimiterName = 'mutation',
): Promise<Guarded<SessionUser>> {
  let user: SessionUser;
  try {
    user = await requireUser();
    await assertCanEditTrip(asTripId(tripId), user);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: 'This is not your trip.' };
    if (error instanceof NotFoundError) return { ok: false, error: 'We could not find that trip.' };
    return { ok: false, error: 'You need to be signed in to edit this.' };
  }

  const limit = await checkLimit(limiter, user.id);
  if (!limit.allowed) return { ok: false, error: 'Slow down a moment, then try again.' };

  return { ok: true, user };
}

/**
 * The caller has a real account, not an anonymous session.
 *
 * Anonymous sessions are right for planning and cloning — they keep a sign-up
 * wall out of the growth loop — but a social graph and a public comment thread
 * need somebody accountable. No session and an anonymous session are the same
 * situation from the traveller's side, so they get the same sentence.
 */
export async function guardRealAccount(
  action: string,
  limiter: LimiterName = 'mutation',
): Promise<Guarded<SessionUser>> {
  const user = await getSessionUser();
  if (!user || user.isAnonymous) {
    return { ok: false, error: `Create an account to ${action}.` };
  }

  const limit = await checkLimit(limiter, user.id);
  if (!limit.allowed) return { ok: false, error: 'Slow down a moment, then try again.' };

  return { ok: true, user };
}
