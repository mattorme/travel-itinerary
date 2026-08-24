import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/db/supabase/admin';
import { isAuthorisedCron } from '@/lib/auth/cron';
import { supportedCurrencies } from '@/lib/itinerary/fx';

export const runtime = 'nodejs';

const responseSchema = z.object({
  base: z.string(),
  rates: z.record(z.string(), z.number()),
});

/**
 * Daily FX snapshot.
 *
 * Rates are stored, never fetched per render — a third-party API on the critical
 * path of every trip page is an outage waiting to happen. A failure here leaves
 * yesterday's rates in place, which is a fine answer for an estimate.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorisedCron(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' });
    if (!response.ok) throw new Error(`FX provider returned ${response.status}`);

    const parsed = responseSchema.parse(await response.json());
    const today = new Date().toISOString().slice(0, 10);

    const rows = supportedCurrencies()
      .filter((code) => parsed.rates[code] !== undefined)
      .map((code) => ({
        base: 'USD',
        quote: code,
        as_of: today,
        rate: parsed.rates[code] as number,
      }));

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: 'No usable rates returned' }, { status: 502 });
    }

    const admin = createAdminClient();
    const { error } = await admin.from('fx_rates').upsert(rows, { onConflict: 'base,quote,as_of' });
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, updated: rows.length });
  } catch (error) {
    console.error('[cron/fx] failed', error);
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
