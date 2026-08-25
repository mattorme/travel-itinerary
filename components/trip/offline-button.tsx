'use client';

import { useEffect, useState, useTransition } from 'react';
import { Check, CloudDownload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isSavedOffline, removeOffline, saveOffline } from '@/lib/native/offline';
import { successFeedback, tapFeedback } from '@/lib/native/feedback';
import { useIsNative } from '@/lib/native/use-native';
import type { Itinerary } from '@/domain/types/itinerary';

/**
 * "Save offline".
 *
 * Only shown in the app. On the web the browser already has a back button, a
 * cache and a bookmark bar; in the app this is the difference between having
 * your itinerary in a foreign city with no roaming and not.
 */
export function OfflineButton({ itinerary }: { itinerary: Itinerary }) {
  const available = useIsNative();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Reading device storage is genuinely asynchronous, so this one is an effect.
  // Setting state from the resolved promise is fine; setting it synchronously
  // in the effect body is what causes a cascading render.
  useEffect(() => {
    let live = true;
    void isSavedOffline(itinerary.slug).then((value) => {
      if (live) setSaved(value);
    });
    return () => {
      live = false;
    };
  }, [itinerary.slug]);

  if (!available) return null;

  return (
    <div>
      <Button
        variant="ghost"
        size="lg"
        disabled={pending}
        aria-pressed={saved}
        onClick={() => {
          setError(null);
          void tapFeedback();
          startTransition(async () => {
            try {
              if (saved) {
                await removeOffline(itinerary.slug);
                setSaved(false);
              } else {
                await saveOffline(itinerary);
                setSaved(true);
                void successFeedback();
              }
            } catch {
              setError('We could not save this to your device.');
            }
          });
        }}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : saved ? (
          <Check className="size-4 text-positive" />
        ) : (
          <CloudDownload className="size-4" />
        )}
        {saved ? 'Available offline' : 'Save offline'}
      </Button>
      {error && (
        <p role="alert" className="mt-1 text-sm text-critical">
          {error}
        </p>
      )}
    </div>
  );
}
