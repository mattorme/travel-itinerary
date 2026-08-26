import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

/**
 * Buttons.
 *
 * `signal` is the morning amber and it takes INK text, never white: amber is
 * a light colour, and white on it is 2:1. Ink on it is 8.4:1 and — usefully —
 * looks like the thing it is, a bright start to something.
 *
 * One amber button per screen. If two are competing, one of them is `primary`.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-semibold select-none ' +
    'transition-[background-color,border-color,color,box-shadow] duration-150 ' +
    // Disabled state is a real state, not a faded copy of the enabled one:
    // a 40%-opacity amber still reads as a bright button you are allowed to press.
    'disabled:pointer-events-none disabled:border-transparent disabled:bg-sunk disabled:text-steel-2 disabled:shadow-none',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-white hover:bg-ink-2',
        signal: 'bg-signal text-ink shadow-(--shadow-card) hover:bg-signal-deep',
        outline: 'border border-rule-2 bg-surface text-ink hover:border-ink hover:bg-sunk',
        ghost: 'text-steel hover:bg-sunk hover:text-ink',
        quiet:
          'text-steel underline decoration-rule-2 underline-offset-4 hover:text-ink hover:decoration-ink',
      },
      size: {
        // 44px minimum on md and up: this is a phone-first product and these
        // are thumb targets.
        sm: 'h-8 px-3 text-[0.8125rem] rounded-edge',
        md: 'h-11 px-4.5 text-[0.875rem] rounded-edge',
        lg: 'h-13 px-6 text-[0.9375rem] rounded-edge',
        icon: 'h-11 w-11 rounded-edge',
        chip: 'h-8 px-3.5 text-[0.8125rem] rounded-full',
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
