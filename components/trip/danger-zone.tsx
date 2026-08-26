'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteTrip } from '@/app/actions/trip-actions';

/**
 * Deleting a trip.
 *
 * The privacy page tells people they can delete a trip, so there has to be a
 * way to. Two-step rather than a modal: the confirmation states plainly what
 * survives, because a deleted trip does not take other people's copies with it
 * and finding that out afterwards would feel like a broken promise.
 */
export function DangerZone({ tripId, cloneCount }: { tripId: string; cloneCount: number }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="mt-12 border-t border-rule pt-6" data-print-hide>
      {!confirming ? (
        <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
          <Trash2 className="size-4" />
          Delete this trip
        </Button>
      ) : (
        <div className="rounded-panel border border-critical/30 bg-critical/5 p-5">
          <p className="font-medium">Delete this trip?</p>
          <p className="mt-1.5 text-sm text-steel">
            It disappears from the site straight away and any shared link stops working.
            {cloneCount > 0 && (
              <>
                {' '}
                {cloneCount === 1 ? 'One person has' : `${cloneCount} people have`} already made
                their own copy — those stay with them, and keep crediting you.
              </>
            )}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const result = await deleteTrip(tripId);
                  // deleteTrip redirects on success, so reaching here is a failure.
                  if (result && !result.ok) setError(result.error);
                });
              }}
              className="text-critical hover:bg-critical/10"
            >
              {pending ? 'Deleting…' : 'Yes, delete it'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </div>

          {error && (
            <p role="alert" className="mt-3 text-sm text-critical">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
