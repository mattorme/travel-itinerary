import 'server-only';
import { createAdminClient } from '@/lib/db/supabase/admin';
import { serverEnv } from '@/lib/env';
import { isUnderSpendCeiling } from '@/lib/observability/usage';
import type { SessionUser } from '@/lib/auth/session';

/**
 * Whether this caller may spend our money right now.
 *
 * Every generation goes through here, so introducing paid tiers later is a
 * config change rather than a retrofit — which is the whole reason this exists
 * before there is any billing.
 */

export type Denial =
  | { reason: 'quota'; used: number; limit: number; resetsAt: string }
  | { reason: 'capacity' }
  | { reason: 'rate_limited'; retryAfterSeconds: number };

export interface Entitlement {
  readonly allowed: boolean;
  readonly denial?: Denial;
  readonly remaining: number;
}

export function dailyQuotaFor(user: SessionUser): number {
  const env = serverEnv();
  if (user.tier === 'pro') return env.GENERATION_QUOTA_PRO;
  if (user.isAnonymous) return env.GENERATION_QUOTA_ANON;
  return env.GENERATION_QUOTA_FREE;
}

export async function canGenerate(user: SessionUser): Promise<Entitlement> {
  // Global kill switch first: it is the cheapest check and the one that protects
  // the account rather than the individual user.
  const spend = await isUnderSpendCeiling();
  if (!spend.ok) {
    return { allowed: false, denial: { reason: 'capacity' }, remaining: 0 };
  }

  const limit = dailyQuotaFor(user);
  const since = startOfUtcDay();

  const admin = createAdminClient();
  const { count, error } = await admin
    .from('generation_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('requester_id', user.id)
    .gte('created_at', since.toISOString());

  if (error) {
    // Fail closed on quota: an accounting outage should not become free
    // unmetered generation. (Contrast with the spend check, which fails open
    // because it protects against a different failure mode.)
    //
    // Logged loudly because "at capacity" is otherwise indistinguishable from a
    // genuine ceiling, and this branch has already once hidden a missing
    // service_role grant.
    console.error('[entitlements] quota check failed, denying', error.message);
    return { allowed: false, denial: { reason: 'capacity' }, remaining: 0 };
  }

  const used = count ?? 0;
  if (used >= limit) {
    const resetsAt = new Date(since.getTime() + 86_400_000).toISOString();
    return { allowed: false, denial: { reason: 'quota', used, limit, resetsAt }, remaining: 0 };
  }

  return { allowed: true, remaining: limit - used };
}

function startOfUtcDay(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
