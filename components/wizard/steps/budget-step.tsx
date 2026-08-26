'use client';

import { Field, Input, inputClass } from '@/components/ui/field';
import { SelectPill } from '@/components/ui/pill';
import { ACCOMMODATION_KINDS } from '@/domain/types/taxonomy';
import { humanise } from '@/lib/utils/format';
import type { WizardState } from '../state';

type Patch = (patch: Partial<WizardState>) => void;

const CURRENCIES = ['AUD', 'USD', 'EUR', 'GBP', 'NZD', 'CAD', 'JPY', 'SGD'];

export function BudgetStep({ state, patch }: { state: WizardState; patch: Patch }) {
  return (
    <div className="space-y-7">
      <p className="text-[0.9375rem] text-steel">
        Optional, but it changes what we suggest. Excludes flights.
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
