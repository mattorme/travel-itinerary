import 'server-only';
import { createAdminClient } from '@/lib/db/supabase/admin';
import { actorHash } from '@/lib/utils/request';
import type { TripId } from '@/domain/types/ids';

/**
 * Engagement events.
 *
 * `shared link -> view` and `view -> clone` are the two numbers that decide
 * whether this product works, so they are instrumented before anything else.
 *
 * `actor_hash` is a salted, truncated digest of (ip, user-agent, trip, day). It
 * cannot be reversed to an IP and cannot be correlated across trips or days —
 * enough to dedupe a refresh, not enough to be personal data.
 */
export async function recordTripView(args: {
  tripId: TripId;
  ip: string;
  userAgent: string;
  referrer: string | null;
}): Promise<void> {
  try {
    const hash = await actorHash(args.ip, args.userAgent, args.tripId);
    const admin = createAdminClient();
    await admin.rpc('record_trip_event', {
      p_trip_id: args.tripId,
      p_event_type: 'view',
      p_actor_hash: hash,
      p_referrer_host: args.referrer ? (safeHost(args.referrer) ?? undefined) : undefined,
    });
  } catch (error) {
    // Analytics must never break a page render.
    console.warn('[events] view not recorded', error);
  }
}

export async function recordTripEvent(args: {
  tripId: TripId;
  type: 'share' | 'cta_click' | 'clone_start' | 'og_render';
  channel?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.rpc('record_trip_event', {
      p_trip_id: args.tripId,
      p_event_type: args.type,
      p_channel: args.channel ?? undefined,
    });
  } catch (error) {
    console.warn('[events] event not recorded', error);
  }
}

function safeHost(referrer: string): string | null {
  try {
    return new URL(referrer).host;
  } catch {
    return null;
  }
}
