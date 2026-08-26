import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * A labelled form control.
 *
 * The label is set in the signage style shared by every eyebrow in the product,
 * which is most of what makes forms and content read as one system rather than
 * two.
 */
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
      <label htmlFor={htmlFor} className="type-label block text-steel">
        {label}
      </label>
      {hint && !error && <p className="text-[0.875rem] text-steel">{hint}</p>}
      {children}
      {error && (
        <p role="alert" className="text-[0.875rem] font-medium text-critical">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  'w-full rounded-edge border border-rule-2 bg-surface px-3.5 py-3 ' +
  'text-ink placeholder:text-steel-2 transition-colors ' +
  'focus:border-ink focus:outline-2 focus:outline-offset-0 focus:outline-ink ' +
  // 16px minimum stops iOS Safari zooming the viewport on focus.
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
  return (
    <textarea ref={ref} className={cn(inputClass, 'min-h-28 resize-y leading-relaxed', className)} {...props} />
  );
});
