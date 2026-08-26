'use server';

import { guardTripEditor } from '@/lib/auth/guards';
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
  // A denial renders as "nothing else nearby", which is the right thing to show
  // whether the cause is no results, no access or too many requests.
  const guard = await guardTripEditor(tripId);
  if (!guard.ok) return [];

  try {
    return await findAlternatives({ tripId: asTripId(tripId), activityId });
  } catch {
    return [];
  }
}

export async function placeSearch(
  tripId: string,
  query: string,
): Promise<readonly Alternative[]> {
  const guard = await guardTripEditor(tripId);
  if (!guard.ok) return [];

  try {
    return await searchTripPlaces({ tripId: asTripId(tripId), query });
  } catch {
    return [];
  }
}
