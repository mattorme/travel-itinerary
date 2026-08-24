import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * The selection primitive for the wizard. A checkbox styled as a chip rather
 * than a real checkbox control: keyboard and screen-reader semantics are
 * preserved by the visually-hidden input, which is why this is not a <button>.
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
        'group relative inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2.5',
        'text-[0.9375rem] transition-colors select-none',
        checked
          ? 'border-ink bg-ink text-paper'
          : 'border-line-strong bg-paper-raised text-ink hover:border-ink/40',
        disabled && 'pointer-events-none opacity-40',
        'focus-within:outline focus-within:outline-2 focus-within:outline-accent focus-within:outline-offset-2',
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
