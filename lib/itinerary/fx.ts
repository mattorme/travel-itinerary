import 'server-only';
import { createAdminClient } from '@/lib/db/supabase/admin';

/**
 * USD -> display currency.
 *
 * The cost model is calibrated in USD; the traveller thinks in their own
 * currency. Rates are snapshotted daily into `fx_rates` by a cron job — never
 * fetched per render, which would put a third-party API on the critical path of
 * every trip page.
 *
 * The static fallback exists so that an FX outage degrades to a slightly stale
 * number rather than a blank budget. Approximate by design; the UI says
 * "estimated".
 */
const FALLBACK_USD_RATES: Readonly<Record<string, number>> = {
  USD: 1, AUD: 1.52, NZD: 1.66, EUR: 0.92, GBP: 0.78, CAD: 1.37,
  JPY: 152, CNY: 7.2, HKD: 7.8, SGD: 1.34, KRW: 1340, INR: 84,
  THB: 34, VND: 25000, IDR: 15800, MYR: 4.5, PHP: 57,
  CHF: 0.87, SEK: 10.6, NOK: 10.9, DKK: 6.9, PLN: 3.95,
  CZK: 23, HUF: 360, TRY: 34, ZAR: 18, BRL: 5.6, MXN: 19.5,
  ARS: 980, CLP: 950, COP: 4300, AED: 3.67, ILS: 3.7,
};

const cache = new Map<string, { rate: number; at: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

export async function usdRateFor(currency: string): Promise<number> {
  const code = currency.toUpperCase();
  if (code === 'USD') return 1;

  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.rate;

  const admin = createAdminClient();
  const { data } = await admin
    .from('fx_rates')
    .select('rate')
    .eq('base', 'USD')
    .eq('quote', code)
    .order('as_of', { ascending: false })
    .limit(1)
    .maybeSingle();

  const rate = data?.rate ? Number(data.rate) : (FALLBACK_USD_RATES[code] ?? 1);
  cache.set(code, { rate, at: Date.now() });
  return rate;
}

export function supportedCurrencies(): readonly string[] {
  return Object.keys(FALLBACK_USD_RATES);
}
