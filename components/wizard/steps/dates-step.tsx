'use client';

import { useMemo } from 'react';
import { Field, Input } from '@/components/ui/field';
import { SelectPill } from '@/components/ui/pill';
import { Stepper } from './controls';
import type { WizardState } from '../state';

type Patch = (patch: Partial<WizardState>) => void;

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
