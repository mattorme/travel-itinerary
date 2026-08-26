import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

/**
 * Buttons.
 *
 * `signal` is the brand gradient with a coloured shadow under it — the one
 * action per screen you actually want taken. The shadow deepens rather than
 * spreads on hover: a shadow that blooms outwards is a glow, and a glow is the
 * cheapest-looking thing a button can do.
 *
 * `outline` is white on white with a hairline, which is how the secondary
 * action reads next to a gradient without competing with it.
 */
const buttonVariants = cva(
  'group/btn relative inline-flex items-center justify-center gap-2 font-semibold select-none ' +
    'transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-(--ease-out-quint) ' +
    'active:translate-y-px ' +
    // Disabled is a real state, not a faded copy of the enabled one.
    'disabled:pointer-events-none disabled:border-transparent disabled:bg-sunk ' +
    'disabled:text-steel-2 disabled:shadow-none disabled:bg-none disabled:translate-y-0',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-white shadow-(--shadow-card) hover:bg-ink-2',
        signal:
          'grad-brand text-white shadow-(--shadow-cta) hover:shadow-(--shadow-lift) hover:-translate-y-0.5',
        outline:
          'border border-rule-2 bg-surface text-ink shadow-xs hover:border-signal/40 hover:text-signal',
        ghost: 'text-steel hover:bg-signal-wash hover:text-signal',
        quiet:
          'text-steel underline decoration-rule-2 underline-offset-4 hover:text-signal hover:decoration-signal',
      },
      size: {
        // 44px minimum on md and up: this is a phone-first product and these
        // are thumb targets.
        sm: 'h-9 px-3.5 text-[0.8125rem] rounded-edge',
        md: 'h-11 px-5 text-[0.875rem] rounded-edge',
        lg: 'h-13 px-7 text-[0.9375rem] rounded-edge',
        icon: 'h-11 w-11 rounded-edge',
        chip: 'h-9 px-4 text-[0.8125rem] rounded-full',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
});

export { buttonVariants };
