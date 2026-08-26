'use client';

import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

/**
 * Controls shared by more than one wizard step.
 *
 * They live together because they are the wizard's own vocabulary — a stepper
 * and a card-shaped radio — not general UI primitives. Anything genuinely
 * reusable belongs in components/ui.
 */

export function Stepper({
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
        {value} <span className="text-steel">{suffix}</span>
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

export function OptionCard({
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
          : 'border-rule-2 bg-surface hover:border-ink/40',
      )}
    >
      <span className="block font-medium capitalize">{title}</span>
      <span className={cn('mt-1 block text-sm', selected ? 'text-paper/70' : 'text-steel')}>
        {blurb}
      </span>
    </button>
  );
}
