'use client';

import { useState, useTransition } from 'react';
import { ChevronDown, ChevronUp, Loader2, Pin, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { lockActivity, moveActivity, removeActivity } from '@/app/actions/edit-actions';
import { cn } from '@/lib/utils/cn';

/**
 * Per-activity edit controls.
 *
 * Up/down rather than drag: on a phone, dragging inside a scrolling page is
 * fiddly and easy to trigger by accident, and every reorder costs a server
 * round-trip to re-time the day. Two obvious buttons are better here than a
 * gesture that fights the scroll.
 */
export function ActivityEditor({
  tripId,
  activityId,
  index,
  count,
  isLocked,
}: {
  tripId: string;
  activityId: string;
  index: number;
  count: number;
  isLocked: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [locked, setLocked] = useState(isLocked);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? 'That did not work.');
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <Button
        variant="ghost"
        size="sm"
        disabled={index === 0 || pending}
        aria-label="Move earlier"
        onClick={() => run(() => moveActivity(tripId, activityId, index - 1))}
      >
        <ChevronUp className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={index === count - 1 || pending}
        aria-label="Move later"
        onClick={() => run(() => moveActivity(tripId, activityId, index + 1))}
      >
        <ChevronDown className="size-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        aria-pressed={locked}
        disabled={pending}
        onClick={() => {
          const next = !locked;
          setLocked(next);
          run(async () => {
            const result = await lockActivity(tripId, activityId, next);
            if (!result.ok) setLocked(!next);
            return result;
          });
        }}
      >
        <Pin className={cn('size-4', locked && 'fill-current text-accent')} />
        {locked ? 'Pinned' : 'Pin'}
      </Button>

      {confirming ? (
        <span className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => run(() => removeActivity(tripId, activityId))}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Remove it
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Keep
          </Button>
        </span>
      ) : (
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(true)}>
          <Trash2 className="size-4" />
          Remove
        </Button>
      )}

      {locked && (
        <span className="text-xs text-ink-faint">
          Pinned — we won&apos;t move this when the day changes.
        </span>
      )}

      {error && (
        <span role="alert" className="text-xs text-critical">
          {error}
        </span>
      )}
    </div>
  );
}
