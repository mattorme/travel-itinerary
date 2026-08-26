import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * The selection token for the wizard.
 *
 * A checkbox styled as a tag, not a button: the visually-hidden input
 * keeps real keyboard and screen-reader semantics, and the label is the hit
 * target — which is what a person and an assistive technology both expect.
 */
export function SelectPill({
  checked,
  onChange,
  children,
  name,
  value,
  disabled,
  type = 'checkbox',
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
  name?: string;
  value?: string;
  disabled?: boolean;
  type?: 'checkbox' | 'radio';
}) {
  return (
    <label
      className={cn(
        'group relative inline-flex cursor-pointer items-center gap-2 rounded-edge border px-3.5 py-2',
        'text-[0.875rem] font-medium transition-colors select-none',
        checked
          ? 'border-ink bg-ink text-white shadow-(--shadow-card)'
          : 'border-rule-2 bg-surface text-ink hover:border-ink',
        disabled && 'pointer-events-none opacity-35',
        'focus-within:outline focus-within:outline-2 focus-within:outline-ink focus-within:outline-offset-2',
      )}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      {children}
    </label>
  );
}
