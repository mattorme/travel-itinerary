'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Field, inputClass } from '@/components/ui/field';
import { cn } from '@/lib/utils/cn';
import { suggestDestinations, type DestinationSuggestion } from '@/lib/api/client';
import type { WizardState } from '../state';

type Patch = (patch: Partial<WizardState>) => void;

export function DestinationStep({ state, patch }: { state: WizardState; patch: Patch }) {
  const [suggestions, setSuggestions] = useState<readonly DestinationSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  // One session token per autocomplete session is how Google bills a whole
  // typing session as a single lookup rather than one per keystroke.
  const sessionToken = useRef(crypto.randomUUID());

  // Fetch only. Clearing happens in the change handler, where the state that
  // invalidates the suggestions actually changes — an effect that both reacts to
  // and writes state cascades renders for no benefit.
  useEffect(() => {
    const query = state.destinationQuery.trim();
    if (query.length < 2 || state.destinationPlaceId) return;

    const timer = setTimeout(async () => {
      // Autocomplete is a convenience: a failure is an empty list, and typing a
      // name freehand works perfectly well.
      const found = await suggestDestinations(query, sessionToken.current);
      setSuggestions(found);
      setOpen(found.length > 0);
    }, 280);
    return () => clearTimeout(timer);
  }, [state.destinationQuery, state.destinationPlaceId]);

  return (
    <div className="space-y-5">
      <Field label="Destination" hint="A city, a region, or a country." htmlFor="destination">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input
            id="destination"
            className={cn(inputClass, 'pl-11')}
            placeholder="Tokyo, Portugal, the Amalfi Coast…"
            value={state.destinationQuery}
            autoComplete="off"
            onChange={(e) => {
              patch({ destinationQuery: e.target.value, destinationPlaceId: null });
              setSuggestions([]);
            }}
            onFocus={() => setOpen(true)}
          />
        </div>
      </Field>

      {open && suggestions.length > 0 && (
        <ul className="overflow-hidden rounded-xl border border-line bg-paper-raised">
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                className="w-full px-4 py-3 text-left transition-colors hover:bg-paper-sunk"
                onClick={() => {
                  patch({ destinationQuery: s.primary, destinationPlaceId: s.placeId });
                  setOpen(false);
                }}
              >
                <span className="block text-[0.9375rem]">{s.primary}</span>
                {s.secondary && <span className="block text-sm text-ink-faint">{s.secondary}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
