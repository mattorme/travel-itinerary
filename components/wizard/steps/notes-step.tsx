'use client';

import { Field, Textarea } from '@/components/ui/field';
import type { WizardState } from '../state';

type Patch = (patch: Partial<WizardState>) => void;

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
      <p className="text-right text-xs text-steel-2">{state.notes.length} / 2000</p>
    </div>
  );
}
