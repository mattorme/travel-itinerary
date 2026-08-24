import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase/admin';
import { isAuthorisedCron } from '@/lib/auth/cron';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Scheduled maintenance.
 *
 *  - sweep expired Google content, enforcing the Places TTL at the storage layer
 *    rather than relying on read-time filtering alone
 *  - roll up view and share counters from the append-only event log
 *  - keep the trip_events partition for next month ahead of the calendar
 *  - promote trips that have earned indexability
 *
 * Runs hourly. Everything here is idempotent.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorisedCron(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const admin = createAdminClient();
  const results: Record<string, unknown> = {};

  const { data: swept, error: sweepError } = await admin.rpc('sweep_expired_cache');
  results.cacheRowsRemoved = sweepError ? `error: ${sweepError.message}` : swept;

  const { data: rolled, error: rollupError } = await admin.rpc('rollup_trip_counters', {
    since: '02:00:00',
  });
  results.tripsCounterUpdated = rollupError ? `error: ${rollupError.message}` : rolled;

  const nextMonth = new Date();
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 2);
  const { error: partitionError } = await admin.rpc('ensure_trip_events_partition', {
    target: nextMonth.toISOString().slice(0, 10),
  });
  results.partitionAhead = partitionError ? `error: ${partitionError.message}` : 'ok';

  const { data: promoted, error: promoteError } = await admin.rpc('refresh_trip_indexability');
  results.tripsPromoted = promoteError ? `error: ${promoteError.message}` : promoted;

  return NextResponse.json({ ok: true, results });
}
