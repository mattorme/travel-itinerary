import 'server-only';
import { createClient } from '@/lib/db/supabase/server';
import type { TripId } from '@/domain/types/ids';
import type { SessionUser } from './session';

/**
 * RLS is the correctness backstop. These checks exist on top of it because RLS
 * returns "0 rows" where a user needs to be told "this is private" or "you don't
 * own this" — and because a mutation that silently affects nothing is a bug
 * that is very hard to see.
 */
export class ForbiddenError extends Error {
  override name = 'ForbiddenError';
}
export class NotFoundError extends Error {
  override name = 'NotFoundError';
}

export async function assertCanEditTrip(tripId: TripId, user: SessionUser): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('trips')
    .select('owner_id, deleted_at')
    .eq('id', tripId)
    .maybeSingle();

  if (error) throw new NotFoundError('Trip not found.');
  if (!data || data.deleted_at !== null) throw new NotFoundError('Trip not found.');
  if (data.owner_id !== user.id) throw new ForbiddenError('You do not have access to this trip.');
}
