'use client';

import { Field } from '@/components/ui/field';
import { SelectPill } from '@/components/ui/pill';
import { FOOD_PREFS, INTERESTS } from '@/domain/types/taxonomy';
import { humanise } from '@/lib/utils/format';
import type { WizardState } from '../state';

type Patch = (patch: Partial<WizardState>) => void;

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
