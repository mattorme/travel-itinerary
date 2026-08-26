'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Loader2, MapPin, Search, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { cn } from '@/lib/utils/cn';
import { compactNumber, priceLevelLabel } from '@/lib/utils/format';
import type { Alternative } from '@/lib/itinerary/alternatives';

/**
 * The drawer behind "Swap" and "Add a stop".
 *
 * Two modes, one component, because they are the same interaction: pick a place
 * from a shortlist. Swapping opens with ranked alternatives already loaded;
 * adding opens empty with a search box.
 *
 * Distance from the rest of the day is shown first among the signals, because it
 * is the one that decides whether the day still works — a marginally better
 * restaurant forty minutes away is the wrong swap, and a list sorted only by
 * rating would hide that.
 */
export function PlacePicker({
  title,
  subtitle,
  initial,
  onSearch,
  onPick,
  onClose,
  allowFreeText = false,
}: {
  title: string;
  subtitle: string;
  /** Preloaded options. Absent for search-first mode. */
  initial?: readonly Alternative[] | null;
  onSearch?: (query: string) => Promise<readonly Alternative[]>;
  onPick: (choice: { placeId: string } | { customName: string }) => Promise<void>;
  onClose: () => void;
  allowFreeText?: boolean;
}) {
  const [query, setQuery] = useState('');
  // Search results, once a search has run. Null means "no search yet", which is
  // different from "a search that found nothing".
  const [searched, setSearched] = useState<readonly Alternative[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Derived, not synced. `initial` arrives asynchronously in swap mode, and
  // copying an incoming prop into state through an effect is what causes the
  // cascading render this used to have.
  const results = searched ?? initial ?? [];
  const loading = onSearch ? searching : initial === null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  useEffect(() => {
    if (!onSearch) return;
    const term = query.trim();
    if (term.length < 2) return;
    const timer = setTimeout(() => {
      setSearching(true);
      void onSearch(term)
        .then(setSearched)
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, onSearch]);

  function pick(choice: { placeId: string } | { customName: string }) {
    setChosen('placeId' in choice ? choice.placeId : choice.customName);
    startTransition(async () => {
      await onPick(choice);
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center sm:p-5"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-2xl border border-line bg-paper-raised sm:max-h-[80dvh] sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line p-5">
          <div>
            <h2 className="font-display text-xl">{title}</h2>
            <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        {onSearch && (
          <div className="border-b border-line p-4">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-faint"
                aria-hidden
              />
              <Input
                autoFocus
                className="pl-11"
                placeholder="Search places in this destination…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search places"
              />
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="flex items-center gap-2 px-1 py-6 text-sm text-ink-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Looking…
            </p>
          ) : results.length > 0 ? (
            <ul className="space-y-1.5">
              {results.map((option) => (
                <li key={option.placeId}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => pick({ placeId: option.placeId })}
                    className={cn(
                      'w-full rounded-xl border p-3.5 text-left transition-colors',
                      chosen === option.placeId
                        ? 'border-ink bg-paper-sunk'
                        : 'border-line hover:border-ink/30 hover:bg-paper-sunk/60',
                      pending && chosen !== option.placeId && 'opacity-50',
                    )}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-display text-lg leading-snug">{option.name}</span>
                      {chosen === option.placeId && pending && (
                        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                      )}
                    </span>

                    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-faint">
                      {option.metersFromDay !== null && (
                        <span className="flex items-center gap-1 text-ink-muted">
                          <MapPin className="size-3.5" aria-hidden />
                          {formatDistance(option.metersFromDay)} from the rest of the day
                        </span>
                      )}
                      {option.rating !== null && (
                        <span className="flex items-center gap-1">
                          <Star className="size-3.5 fill-current" aria-hidden />
                          {option.rating.toFixed(1)}
                          {option.reviewCount !== null && ` (${compactNumber(option.reviewCount)})`}
                        </span>
                      )}
                      {option.priceLevel && <span>{priceLevelLabel(option.priceLevel)}</span>}
                    </span>

                    {option.summary && (
                      <span className="mt-2 block text-sm leading-relaxed text-ink-muted">
                        {option.summary}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 py-6 text-sm text-ink-muted">
              {onSearch && query.trim().length < 2
                ? 'Start typing to find somewhere.'
                : 'Nothing else nearby that fits this slot.'}
            </p>
          )}
        </div>

        {allowFreeText && query.trim().length >= 2 && (
          <div className="border-t border-line p-4">
            {/* The corpus only holds places somebody has planned around. When it
                does not have what they want, a free-text stop is better than a
                dead end. */}
            <Button
              variant="outline"
              size="md"
              block
              disabled={pending}
              onClick={() => pick({ customName: query.trim() })}
            >
              Add &ldquo;{query.trim()}&rdquo; as my own stop
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDistance(meters: number): string {
  if (meters < 950) return `${Math.round(meters / 50) * 50} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}


