'use server';

import { requireUser } from '@/lib/auth/session';
import { assertCanEditTrip } from '@/lib/auth/authorization';
import { checkLimit } from '@/lib/ratelimit';
import { asTripId } from '@/domain/types/ids';
import { findAlternatives, searchTripPlaces, type Alternative } from '@/lib/itinerary/alternatives';

/**
 * Read-only lookups behind the editing UI.
 *
 * Kept out of edit-actions.ts because these mutate nothing — and because both
 * are called while the user types, so they need their own rate limit rather
 * than sharing the mutation budget.
 */

export async function alternativesFor(
  tripId: string,
  activityId: string,
): Promise<readonly Alternative[]> {
  try {
    const user = await requireUser();
    await assertCanEditTrip(asTripId(tripId), user);
    const limit = await checkLimit('mutation', user.id);
    if (!limit.allowed) return [];
    return await findAlternatives({ tripId: asTripId(tripId), activityId });
  } catch {
    // An empty list renders as "nothing else nearby", which is the right thing
    // to show whether the cause is no results or no access.
    return [];
  }
}

export async function placeSearch(
  tripId: string,
  query: string,
): Promise<readonly Alternative[]> {
  try {
    const user = await requireUser();
    await assertCanEditTrip(asTripId(tripId), user);
    const limit = await checkLimit('mutation', user.id);
    if (!limit.allowed) return [];
    return await searchTripPlaces({ tripId: asTripId(tripId), query });
  } catch {
    return [];
  }
}
