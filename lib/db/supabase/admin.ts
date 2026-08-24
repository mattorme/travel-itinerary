import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import { serverEnv } from '@/lib/env';
import { publicEnv } from '@/lib/public-env';

/**
 * Service-role client. Bypasses RLS entirely.
 *
 * Only three things may use this:
 *   1. the generation worker (writes places, cache, jobs, ledger)
 *   2. scheduled maintenance (cache sweep, counter rollup)
 *   3. webhook handlers
 *
 * If you are reaching for this to make a user-facing query work, the RLS policy
 * is wrong — fix that instead.
 */
let cached: ReturnType<typeof createClient<Database>> | null = null;

export function createAdminClient() {
  cached ??= createClient<Database>(publicEnv.supabaseUrl, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
