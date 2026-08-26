'use client';

import { Field } from '@/components/ui/field';
import { Stepper } from './controls';
import type { WizardState } from '../state';

type Patch = (patch: Partial<WizardState>) => void;

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
              <label key={index} className="flex items-center gap-2 text-sm text-steel">
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
                  className="w-16 rounded-lg border border-rule-2 bg-surface px-2 py-1.5 text-center text-[16px]"
                />
              </label>
            ))}
          </div>
        )}
      </Field>
    </div>
  );
}
