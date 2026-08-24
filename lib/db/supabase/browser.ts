'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../database.types';
import { publicEnv } from '@/lib/public-env';

/**
 * Browser client. Used for auth transitions and Realtime subscriptions only —
 * data mutations go through server actions so authorisation lives in one place.
 */
let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  cached ??= createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  return cached;
}
