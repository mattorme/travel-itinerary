'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, Search } from 'lucide-react';
import { Field, Input, Textarea, inputClass } from '@/components/ui/field';
import { SelectPill } from '@/components/ui/pill';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { humanise } from '@/lib/utils/format';
import {
  ACCOMMODATION_KINDS,
  FOOD_PREFS,
  INTERESTS,
  PACES,
  TRANSPORT_MODES,
  TRAVEL_STYLES,
} from '@/domain/types/taxonomy';
import type { WizardState } from './state';

type Patch = (patch: Partial<WizardState>) => void;

/* ------------------------------------------------------------------ */

export function DestinationStep({ state, patch }: { state: WizardState; patch: Patch }) {
  const [suggestions, setSuggestions] = useState<{ placeId: string; primary: string; secondary: string | null }[]>([]);
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
      try {
        const response = await fetch(
          `/api/places/autocomplete?q=${encodeURIComponent(query)}&session=${sessionToken.current}`,
        );
        if (!response.ok) return;
        const data = (await response.json()) as { suggestions?: typeof suggestions };
        setSuggestions(data.suggestions ?? []);
        setOpen(true);
      } catch {
        // Autocomplete is a convenience. Typing a name freehand works fine.
      }
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

/* ------------------------------------------------------------------ */

export function DatesStep({ state, patch }: { state: WizardState; patch: Patch }) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <div className="space-y-7">
      <div className="flex gap-2">
        <SelectPill
          type="radio"
          checked={state.dateMode === 'flexible'}
          onChange={() => patch({ dateMode: 'flexible' })}
        >
          I know how long
        </SelectPill>
        <SelectPill
          type="radio"
          checked={state.dateMode === 'exact'}
          onChange={() => patch({ dateMode: 'exact' })}
        >
          I have dates
        </SelectPill>
      </div>

      {state.dateMode === 'flexible' ? (
        <Field label="How many days?">
          <Stepper
            value={state.durationDays}
            min={1}
            max={60}
            onChange={(durationDays) => patch({ durationDays })}
            suffix={state.durationDays === 1 ? 'day' : 'days'}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {[3, 5, 7, 10, 14].map((n) => (
              <SelectPill
                key={n}
                type="radio"
                checked={state.durationDays === n}
                onChange={() => patch({ durationDays: n })}
              >
                {n} days
              </SelectPill>
            ))}
          </div>
        </Field>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Leaving" htmlFor="start">
            <Input
              id="start"
              type="date"
              min={today}
              value={state.startDate}
              onChange={(e) => patch({ startDate: e.target.value })}
            />
          </Field>
          <Field label="Coming back" htmlFor="end">
            <Input
              id="end"
              type="date"
              min={state.startDate || today}
              value={state.endDate}
              onChange={(e) => patch({ endDate: e.target.value })}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function TravellersStep({ state, patch }: { state: WizardState; patch: Patch }) {
  return (
    <div className="space-y-7">
      <Field label="Adults">
        <Stepper
          value={state.adults}
          min={1}
          max={12}
          onChange={(adults) => patch({ adults })}
          suffix={state.adults === 1 ? 'adult' : 'adults'}
        />
      </Field>

      <Field label="Children" hint="Ages help — a 4-year-old and a 15-year-old want different days.">
        <Stepper
          value={state.children.length}
          min={0}
          max={8}
          suffix={state.children.length === 1 ? 'child' : 'children'}
          onChange={(count) => {
            const next = [...state.children];
            while (next.length < count) next.push(8);
            next.length = count;
            patch({ children: next });
          }}
        />
        {state.children.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {state.children.map((age, index) => (
              <label key={index} className="flex items-center gap-2 text-sm text-ink-muted">
                Child {index + 1}
                <input
                  type="number"
                  min={0}
                  max={17}
                  value={age}
                  onChange={(e) => {
                    const next = [...state.children];
                    next[index] = Math.max(0, Math.min(17, Number(e.target.value)));
                    patch({ children: next });
                  }}
                  className="w-16 rounded-lg border border-line-strong bg-paper-raised px-2 py-1.5 text-center text-[16px]"
                />
              </label>
            ))}
          </div>
        )}
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const CURRENCIES = ['AUD', 'USD', 'EUR', 'GBP', 'NZD', 'CAD', 'JPY', 'SGD'];

export function BudgetStep({ state, patch }: { state: WizardState; patch: Patch }) {
  return (
    <div className="space-y-7">
      <p className="text-[0.9375rem] text-ink-muted">
        Optional — but it changes what we suggest. Excludes flights.
      </p>

      <div className="flex gap-2">
        <SelectPill type="radio" checked={state.budgetMode === 'total'} onChange={() => patch({ budgetMode: 'total' })}>
          Total for the trip
        </SelectPill>
        <SelectPill type="radio" checked={state.budgetMode === 'daily'} onChange={() => patch({ budgetMode: 'daily' })}>
          Per day
        </SelectPill>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <Field label={state.budgetMode === 'total' ? 'Total budget' : 'Daily budget'} htmlFor="budget">
          <Input
            id="budget"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Leave blank if you're not sure"
            value={state.budgetAmount ?? ''}
            onChange={(e) =>
              patch({ budgetAmount: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
        </Field>
        <Field label="Currency" htmlFor="currency">
          <select
            id="currency"
            className={inputClass}
            value={state.currency}
            onChange={(e) => patch({ currency: e.target.value })}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Where you'd stay" hint="Used for the budget, not for booking.">
        <div className="flex flex-wrap gap-2">
          {ACCOMMODATION_KINDS.map((kind) => (
            <SelectPill
              key={kind}
              type="radio"
              checked={state.accommodation === kind}
              onChange={() => patch({ accommodation: state.accommodation === kind ? null : kind })}
            >
              {humanise(kind)}
            </SelectPill>
          ))}
        </div>
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const PACE_BLURB: Record<string, string> = {
  relaxed: 'Three or four things a day, with time to sit down.',
  balanced: 'A full day without running.',
  packed: 'See as much as possible.',
};

const STYLE_BLURB: Record<string, string> = {
  backpacker: 'Hostels, street food, public transport.',
  budget: 'Careful with money, still eating well.',
  mid_range: 'Comfortable hotels, a few nice meals.',
  balanced: 'A bit of everything.',
  luxury: 'The best of everything.',
};

export function StyleStep({ state, patch }: { state: WizardState; patch: Patch }) {
  return (
    <div className="space-y-8">
      <Field label="Travel style">
        <div className="grid gap-2 sm:grid-cols-2">
          {TRAVEL_STYLES.map((style) => (
            <OptionCard
              key={style}
              selected={state.travelStyle === style}
              title={humanise(style)}
              blurb={STYLE_BLURB[style] ?? ''}
              onSelect={() => patch({ travelStyle: style })}
            />
          ))}
        </div>
      </Field>

      <Field label="Pace">
        <div className="grid gap-2 sm:grid-cols-3">
          {PACES.map((pace) => (
            <OptionCard
              key={pace}
              selected={state.pace === pace}
              title={humanise(pace)}
              blurb={PACE_BLURB[pace] ?? ''}
              onSelect={() => patch({ pace })}
            />
          ))}
        </div>
      </Field>

      <Field label="Getting around">
        <div className="flex flex-wrap gap-2">
          {TRANSPORT_MODES.map((mode) => (
            <SelectPill
              key={mode}
              checked={state.transportModes.includes(mode)}
              onChange={(checked) =>
                patch({
                  transportModes: checked
                    ? [...state.transportModes, mode]
                    : state.transportModes.filter((m) => m !== mode) as WizardState['transportModes'],
                })
              }
            >
              {humanise(mode)}
            </SelectPill>
          ))}
        </div>
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function InterestsStep({ state, patch }: { state: WizardState; patch: Patch }) {
  const atLimit = state.interests.length >= 8;

  return (
    <div className="space-y-8">
      <Field
        label="Interests"
        hint={`Pick up to 8. ${state.interests.length} selected.`}
      >
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((interest) => {
            const checked = state.interests.includes(interest);
            return (
              <SelectPill
                key={interest}
                checked={checked}
                disabled={!checked && atLimit}
                onChange={(next) =>
                  patch({
                    interests: next
                      ? [...state.interests, interest]
                      : state.interests.filter((i) => i !== interest),
                  })
                }
              >
                {humanise(interest)}
              </SelectPill>
            );
          })}
        </div>
      </Field>

      <Field label="Food" hint="Dietary needs and what you actually like eating.">
        <div className="flex flex-wrap gap-2">
          {FOOD_PREFS.map((pref) => (
            <SelectPill
              key={pref}
              checked={state.foodPrefs.includes(pref)}
              onChange={(next) =>
                patch({
                  foodPrefs: next
                    ? [...state.foodPrefs, pref]
                    : state.foodPrefs.filter((p) => p !== pref),
                })
              }
            >
              {humanise(pref)}
            </SelectPill>
          ))}
        </div>
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function NotesStep({ state, patch }: { state: WizardState; patch: Patch }) {
  return (
    <div className="space-y-5">
      <Field
        label="In your own words"
        hint="What you want, what you'd rather avoid, anything you're already booked into."
        htmlFor="notes"
      >
        <Textarea
          id="notes"
          rows={6}
          maxLength={2000}
          placeholder="I want the main sights but not the tourist traps. I love history and local food, and I'd rather not do nightlife. We have dinner booked on the second night."
          value={state.notes}
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </Field>
      <p className="text-right text-xs text-ink-faint">{state.notes.length} / 2000</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Stepper({
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  suffix: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <Button
        variant="outline"
        size="icon"
        aria-label="Decrease"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus className="size-4" />
      </Button>
      <span className="min-w-28 text-center text-lg tabular-nums">
        {value} <span className="text-ink-muted">{suffix}</span>
      </span>
      <Button
        variant="outline"
        size="icon"
        aria-label="Increase"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}

function OptionCard({
  selected,
  title,
  blurb,
  onSelect,
}: {
  selected: boolean;
  title: string;
  blurb: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'rounded-xl border p-4 text-left transition-colors',
        selected
          ? 'border-ink bg-ink text-paper'
          : 'border-line-strong bg-paper-raised hover:border-ink/40',
      )}
    >
      <span className="block font-medium capitalize">{title}</span>
      <span className={cn('mt-1 block text-sm', selected ? 'text-paper/70' : 'text-ink-muted')}>
        {blurb}
      </span>
    </button>
  );
}
