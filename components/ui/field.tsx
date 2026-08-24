import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {hint && !error && <p className="text-sm text-ink-faint">{hint}</p>}
      {children}
      {error && (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  'w-full rounded-xl border border-line-strong bg-paper-raised px-4 py-3 text-base ' +
  'text-ink placeholder:text-ink-faint transition-colors ' +
  'focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10 ' +
  // 16px minimum on mobile prevents iOS Safari from zooming the viewport on focus.
  'text-[16px]';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(inputClass, className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(inputClass, 'min-h-28 resize-y', className)} {...props} />;
});
