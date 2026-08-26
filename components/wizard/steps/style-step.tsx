'use client';

import { Field } from '@/components/ui/field';
import { SelectPill } from '@/components/ui/pill';
import { PACES, TRANSPORT_MODES, TRAVEL_STYLES } from '@/domain/types/taxonomy';
import { humanise } from '@/lib/utils/format';
import { OptionCard } from './controls';
import type { WizardState } from '../state';

type Patch = (patch: Partial<WizardState>) => void;

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
