import 'server-only';
import { serverEnv } from '@/lib/env';
import type { NextRequest } from 'next/server';

/**
 * Cron endpoints are publicly routable, so they must authenticate.
 *
 * Refuses outright when no secret is configured — an unprotected endpoint that
 * mutates the database is worse than one that does not run.
 */
export function isAuthorisedCron(request: NextRequest): boolean {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) {
    console.error('[cron] CRON_SECRET is not set; refusing to run');
    return false;
  }
  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}
