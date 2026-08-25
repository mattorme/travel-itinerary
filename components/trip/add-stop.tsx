'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { addActivity } from '@/app/actions/edit-actions';
import { placeSearch } from '@/app/actions/place-actions';
import { PlacePicker } from './place-picker';

/**
 * "Add a stop", per day.
 *
 * Search-first rather than a suggestion list: someone adding a stop usually has
 * something specific in mind — a recommendation from a friend, a place they
 * walked past. Free text is offered as a fallback, because the corpus only
 * knows about places somebody has planned around, and a dead end here would
 * make the whole itinerary feel closed.
 */
export function AddStop({ tripId, dayId }: { tripId: string; dayId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <div className="mt-2 flex items-center gap-3 pl-6">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          Add a stop
        </Button>
        {error && (
          <span role="alert" className="text-xs text-critical">
            {error}
          </span>
        )}
      </div>

      {open && (
        <PlacePicker
          title="Add a stop"
          subtitle="We'll fit it into the day and redo the timings."
          initial={null}
          allowFreeText
          onSearch={(query) => placeSearch(tripId, query)}
          onClose={() => setOpen(false)}
          onPick={async (choice) => {
            setError(null);
            const result = await addActivity(tripId, dayId, choice);
            if (!result.ok) setError(result.error);
          }}
        />
      )}
    </>
  );
}
