'use client';

import { useState, useTransition } from 'react';
import { Globe, Link2, Lock, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setTripVisibility } from '@/app/actions/trip-actions';
import { ShareSheet } from './share-sheet';
import { TakeWithYou } from './take-with-you';
import { cn } from '@/lib/utils/cn';
import type { Itinerary } from '@/domain/types/itinerary';

const OPTIONS = [
  { value: 'private', label: 'Private', icon: Lock, blurb: 'Only you can see this.' },
  { value: 'unlisted', label: 'Anyone with the link', icon: Link2, blurb: 'Shareable, but never listed or indexed.' },
  { value: 'public', label: 'Public', icon: Globe, blurb: 'Can appear in Explore.' },
] as const;

/**
 * Owner controls.
 *
 * A trip is born private; sharing promotes it to unlisted in one tap. Nobody
 * should be able to publish a trip they thought was private by accident, so
 * "public" is a separate, deliberate choice rather than a side effect of
 * pressing Share.
 */
export function OwnerTripActions({ itinerary }: { itinerary: Itinerary }) {
  const [visibility, setVisibility] = useState(itinerary.visibility);
  const [shareOpen, setShareOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(next: (typeof OPTIONS)[number]['value']) {
    const previous = visibility;
    setVisibility(next);
    setError(null);
    startTransition(async () => {
      const result = await setTripVisibility(itinerary.id, next);
      if (!result.ok) {
        setVisibility(previous);
        setError(result.error);
      }
    });
  }

  function share() {
    // Sharing a private trip would hand someone a dead link, so promote first.
    if (visibility === 'private') change('unlisted');
    setShareOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="accent" size="lg" onClick={share} disabled={pending}>
          <Share2 className="size-4" />
          Share
        </Button>


      </div>

      <TakeWithYou itinerary={itinerary} />

      <fieldset className="rounded-card border border-line bg-paper-raised p-4" data-print-hide>
        <legend className="px-1 text-sm font-medium">Who can see this</legend>
        <div className="mt-2 space-y-1">
          {OPTIONS.map((option) => (
            <label
              key={option.value}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors',
                visibility === option.value ? 'bg-paper-sunk' : 'hover:bg-paper-sunk/60',
              )}
            >
              <input
                type="radio"
                name="visibility"
                value={option.value}
                checked={visibility === option.value}
                onChange={() => change(option.value)}
                className="mt-1 accent-[var(--color-ink)]"
              />
              <span>
                <span className="flex items-center gap-2 text-[0.9375rem]">
                  <option.icon className="size-3.5" aria-hidden />
                  {option.label}
                </span>
                <span className="mt-0.5 block text-sm text-ink-faint">{option.blurb}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      )}

      {shareOpen && <ShareSheet itinerary={itinerary} onClose={() => setShareOpen(false)} />}
    </div>
  );
}
