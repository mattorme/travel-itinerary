import 'server-only';
import type { TripRequestParsed } from '@/domain/schemas/trip-request';
import type { SessionUser } from '@/lib/auth/session';
import { getOrCreateSessionUser } from '@/lib/auth/session';
import { verifyTurnstile } from '@/lib/auth/turnstile';
import { canGenerate } from '@/lib/entitlements';
import { generationProvidersReady } from '@/lib/env';
import { checkLimit } from '@/lib/ratelimit';

/**
 * Whether this request is allowed to start a generation.
 *
 * Generation is the only thing in the product that spends real money on every
 * call, so admission is a policy — six ordered checks, each of which can refuse
 * for a different reason and with a different status code. It lives here rather
 * than in the route handler because it is business logic, it needs to be
 * readable as a single sequence, and it should be testable without an HTTP
 * request.
 *
 * The order is deliberate and cheapest-first: a misconfigured server should not
 * consume anyone's quota, and an IP being hammered should be turned away before
 * we create a session for it.
 */

export interface Admitted {
  readonly ok: true;
  readonly user: SessionUser;
}

export interface Refused {
  readonly ok: false;
  readonly status: 400 | 402 | 403 | 429 | 503;
  /** Written for the person reading it. Never an internal error. */
  readonly message: string;
  /** Extra context the client can act on, e.g. a quota reset time. */
  readonly detail?: Record<string, unknown>;
  readonly retryAfterSeconds?: number;
}

export type Admission = Admitted | Refused;

export async function admitGeneration(args: {
  request: TripRequestParsed;
  ip: string;
  turnstileToken: string | null;
  isDevelopment: boolean;
}): Promise<Admission> {
  // 1. Are we even configured? A placeholder key should read as "not
  //    configured", not as a trip that mysteriously failed to build.
  const providers = generationProvidersReady();
  if (!providers.ready) {
    console.error('[generate] providers not configured:', providers.missing.join(', '));
    return {
      ok: false,
      status: 503,
      message: args.isDevelopment
        ? `Generation is not configured. Set ${providers.missing.join(' and ')} in .env.local.`
        : 'Trip generation is temporarily unavailable.',
      ...(args.isDevelopment ? { detail: { missing: providers.missing } } : {}),
    };
  }

  // 2. Per-IP, before we create anything. An attacker controls how many
  //    anonymous identities they make, but not how many addresses they have.
  const byIp = await checkLimit('generateByIp', args.ip);
  if (!byIp.allowed) {
    return {
      ok: false,
      status: 429,
      message: 'You have started a lot of trips recently. Try again shortly.',
      retryAfterSeconds: byIp.retryAfterSeconds,
    };
  }

  // 3. An anonymous session is created here if there is not one, which is what
  //    makes "generate before you sign up" work while keeping RLS uniform.
  let user: SessionUser;
  try {
    user = await getOrCreateSessionUser();
  } catch (error) {
    console.error('[generate] could not establish a session', error);
    return {
      ok: false,
      status: 503,
      message: 'We could not start a session for you. Try signing in.',
    };
  }

  // 4. Anonymous callers are the ones worth challenging: a registered account
  //    is already limited by identity and cost something to create.
  if (user.isAnonymous) {
    const verified = await verifyTurnstile(args.turnstileToken, args.ip);
    if (!verified) {
      return { ok: false, status: 403, message: 'We could not verify that request.' };
    }
  }

  // 5. Per-identity.
  const byUser = await checkLimit('generateByUser', user.id);
  if (!byUser.allowed) {
    return {
      ok: false,
      status: 429,
      message: 'You have hit the limit for now. Try again in a little while.',
      retryAfterSeconds: byUser.retryAfterSeconds,
    };
  }

  // 6. Quota and the global spend ceiling.
  const entitlement = await canGenerate(user);
  if (!entitlement.allowed) {
    return {
      ok: false,
      status: 402,
      message: denialMessage(entitlement.denial?.reason),
      ...(entitlement.denial ? { detail: { denial: entitlement.denial } } : {}),
    };
  }

  return { ok: true, user };
}

function denialMessage(reason: string | undefined): string {
  switch (reason) {
    case 'quota':
      return 'You have used your trips for today. Sign up for more, or come back tomorrow.';
    case 'capacity':
      return 'We are at capacity right now. Please try again a bit later.';
    default:
      return 'We cannot start another trip right now.';
  }
}
