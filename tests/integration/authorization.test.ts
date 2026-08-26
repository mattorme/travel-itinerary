import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/**
 * Cross-trip authorisation on the editing paths.
 *
 * The editing actions authorise a *trip* id, then write through an admin client
 * that bypasses RLS. If the activity or day id the client also supplied is
 * never checked against that trip, owning any trip is enough to edit a stop on
 * somebody else's — and public trips publish their ids in the DOM.
 *
 * That hole was real. These tests exercise the write helpers directly against a
 * live database, because the bug lives precisely in the gap between "RLS would
 * have stopped this" and "the admin client does not consult RLS".
 */

vi.mock('server-only', () => ({}));

/**
 * Deliberately different variable names from the app's.
 *
 * vitest.config.ts stubs the app's environment with placeholders so unit tests
 * can never reach a real service by accident. This test *wants* a real database,
 * so it asks for one explicitly — and skips, loudly, when it is not there.
 */
const URL_ = process.env.SUPABASE_TEST_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY ?? '';

/* eslint-disable @typescript-eslint/no-explicit-any */
const admin: any = createClient(URL_, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
/* eslint-enable @typescript-eslint/no-explicit-any */

async function databaseReachable(): Promise<boolean> {
  if (!URL_ || !SERVICE_KEY) return false;
  try {
    const { error } = await admin.from('trips').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

// The module under test builds its own client from the app's environment.
if (URL_) process.env.NEXT_PUBLIC_SUPABASE_URL = URL_;
if (SERVICE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;

const reachable = await databaseReachable();

describe.skipIf(!reachable)('cross-trip editing authorisation', () => {
  const ATTACKER = '00000000-0000-0000-0000-00000000ee01';
  const VICTIM = '00000000-0000-0000-0000-00000000ee02';
  const ATTACKER_TRIP = 'eeee0001-0000-0000-0000-000000000001';
  const VICTIM_TRIP = 'eeee0002-0000-0000-0000-000000000002';

  let victimDayId = '';
  let victimActivityId = '';
  let attackerDayId = '';
  let placeId = '';

  beforeAll(async () => {
    for (const user of [
      { id: ATTACKER, email: 'attacker@test.local' },
      { id: VICTIM, email: 'victim@test.local' },
    ]) {
      await admin.auth.admin.createUser({ ...user, email_confirm: true });
    }

    const trips = [
      { id: ATTACKER_TRIP, owner: ATTACKER, slug: 'idor-attacker', visibility: 'private' },
      // The victim's trip is public, which is exactly how an attacker learns its
      // activity ids in the first place — they are in the page.
      { id: VICTIM_TRIP, owner: VICTIM, slug: 'idor-victim', visibility: 'public' },
    ] as const;

    for (const trip of trips) {
      await admin.from('trips').insert({
        id: trip.id,
        owner_id: trip.owner,
        slug: trip.slug,
        title: trip.slug,
        duration_days: 1,
        visibility: trip.visibility,
        status: 'ready',
        moderation_state: 'approved',
      });
    }

    const { data: days } = await admin
      .from('trip_days')
      .insert([
        { trip_id: VICTIM_TRIP, day_index: 1, title: 'Victim day' },
        { trip_id: ATTACKER_TRIP, day_index: 1, title: 'Attacker day' },
      ])
      .select('id, trip_id');

    victimDayId = days.find((d: { trip_id: string }) => d.trip_id === VICTIM_TRIP).id;
    attackerDayId = days.find((d: { trip_id: string }) => d.trip_id === ATTACKER_TRIP).id;

    const { data: activity } = await admin
      .from('activities')
      .insert({
        trip_day_id: victimDayId, order_index: 1, kind: 'activity',
        title: 'Victim stop', custom_name: 'Victim stop', duration_minutes: 60,
      })
      .select('id')
      .single();
    victimActivityId = activity.id;

    const { data: place } = await admin.from('places').select('id').limit(1).single();
    placeId = place.id;
  });

  afterAll(async () => {
    await admin.from('trips').delete().in('id', [ATTACKER_TRIP, VICTIM_TRIP]);
    for (const id of [ATTACKER, VICTIM]) await admin.auth.admin.deleteUser(id);
  });

  it('refuses to swap a stop that belongs to another trip', async () => {
    const { swapActivityPlace } = await import('@/lib/itinerary/edit');

    const result = await swapActivityPlace(ATTACKER_TRIP, victimActivityId, placeId);
    expect(result.ok).toBe(false);

    const { data } = await admin
      .from('activities')
      .select('title, place_id')
      .eq('id', victimActivityId)
      .single();
    expect(data.title).toBe('Victim stop');
    expect(data.place_id).toBeNull();
  });

  it('refuses to add a stop to a day that belongs to another trip', async () => {
    const { appendActivity } = await import('@/lib/itinerary/edit');

    const result = await appendActivity(ATTACKER_TRIP, victimDayId, {
      customName: 'Injected stop',
    });
    expect(result.ok).toBe(false);

    const { count } = await admin
      .from('activities')
      .select('id', { count: 'exact', head: true })
      .eq('trip_day_id', victimDayId);
    expect(count).toBe(1);
  });

  it('refuses to re-time a day that belongs to another trip', async () => {
    const { reflowDay } = await import('@/lib/itinerary/edit');

    // Deliberately a time the reflow would *not* produce: a balanced day starts
    // at 09:00, so asserting on 09:00 could not tell a blocked reflow from a
    // successful one.
    await admin.from('activities').update({ start_time: '17:45:00' }).eq('id', victimActivityId);
    await reflowDay(ATTACKER_TRIP, victimDayId);

    const { data } = await admin
      .from('activities')
      .select('start_time')
      .eq('id', victimActivityId)
      .single();
    expect(data.start_time).toBe('17:45:00');
  });

  it('still allows all three on your own trip', async () => {
    const { appendActivity, reflowDay } = await import('@/lib/itinerary/edit');

    const added = await appendActivity(ATTACKER_TRIP, attackerDayId, { customName: 'Mine' });
    expect(added.ok).toBe(true);

    await reflowDay(ATTACKER_TRIP, attackerDayId);
    const { data } = await admin
      .from('activities')
      .select('title, start_time')
      .eq('trip_day_id', attackerDayId)
      .single();
    expect(data.title).toBe('Mine');
    // The reflow gave it a time, which is what proves it actually ran.
    expect(data.start_time).not.toBeNull();
  });
});

if (!reachable) {
  // A skipped security test that says why beats one that silently passes.
  console.warn(
    '[authorization.test] skipped: set SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_KEY ' +
      '(see `npm run test:auth`) to run the cross-trip authorisation checks.',
  );
}
