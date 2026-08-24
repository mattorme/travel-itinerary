import 'server-only';
import { createAdminClient } from '@/lib/db/supabase/admin';
import { serverEnv } from '@/lib/env';

/**
 * The unit-economics ledger.
 *
 * Every external call writes a row. Without this you cannot answer "what does a
 * trip cost us", and every cost decision downstream is a guess.
 *
 * Prices are the published list rates at time of writing; they exist to make
 * relative cost visible and to drive the spend ceiling, not to reconcile a bill.
 */

const PLACES_SKU_USD: Record<string, number> = {
  'places.autocomplete': 0.00283,
  'places.textsearch.essentials': 0.005,
  'places.textsearch.pro': 0.032,
  'places.nearbysearch.pro': 0.032,
  'places.details.essentials': 0.005,
  'places.details.pro': 0.017,
  'places.details.enterprise': 0.025,
  'places.photo': 0.007,
};

const ROUTES_SKU_USD: Record<string, number> = {
  'routes.computeroutes.basic': 0.005,
  'routes.routematrix.element': 0.005,
};

export interface UsageRecord {
  readonly provider: 'google_places' | 'google_routes' | 'google_photos' | 'openai' | 'images';
  readonly sku: string;
  readonly units: number;
  readonly tripId?: string | null;
  readonly jobId?: string | null;
  /** Override the tariff table when the caller knows the real cost (OpenAI). */
  readonly costUsd?: number;
}

export async function recordApiUsage(record: UsageRecord): Promise<void> {
  const unitCost = PLACES_SKU_USD[record.sku] ?? ROUTES_SKU_USD[record.sku] ?? 0;
  const cost = record.costUsd ?? unitCost * record.units;

  const admin = createAdminClient();
  const { error } = await admin.from('api_usage').insert({
    provider: record.provider,
    sku: record.sku,
    units: record.units,
    cost_usd: cost,
    trip_id: record.tripId ?? null,
    job_id: record.jobId ?? null,
  });

  // Accounting must never break a generation. Log and continue.
  if (error) console.error('[usage] failed to record', record.sku, error.message);
}

/**
 * The kill switch. Checked before a generation is admitted, so that a runaway
 * loop or a scraper degrades to "we're at capacity" rather than quietly emptying
 * the account.
 */
export async function isUnderSpendCeiling(): Promise<{ ok: boolean; spentUsd: number; ceilingUsd: number }> {
  const ceiling = serverEnv().DAILY_SPEND_CEILING_USD;
  const admin = createAdminClient();

  const { data, error } = await admin.rpc('spend_today_usd');
  if (error) {
    // Fail open on an accounting outage: refusing every user because the ledger
    // is unavailable is worse than one day of unmetered spend.
    console.error('[usage] spend check failed', error.message);
    return { ok: true, spentUsd: 0, ceilingUsd: ceiling };
  }

  const spent = Number(data ?? 0);
  return { ok: spent < ceiling, spentUsd: spent, ceilingUsd: ceiling };
}
