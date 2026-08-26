import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

/**
 * Buttons.
 *
 * Square-edged, because the visual language is signage and signage does not
 * have pill buttons. The only exception is `chip`, which is a filter token
 * rather than an action and reads correctly as a rounded tag.
 *
 * `primary` is ink, `signal` is the blue — and blue is reserved for the single
 * most important action on a screen. Two blue buttons next to each other means
 * one of them is not actually primary.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-semibold select-none ' +
    'transition-[background-color,border-color,color] duration-100 ' +
    'disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-paper hover:bg-ink-2',
        signal: 'bg-signal text-white hover:bg-signal-deep',
        outline: 'border border-rule-2 bg-surface text-ink hover:border-ink hover:bg-sunk',
        ghost: 'text-steel hover:bg-sunk hover:text-ink',
        quiet: 'text-steel underline decoration-rule-2 underline-offset-4 hover:text-ink hover:decoration-ink',
      },
      size: {
        // 44px minimum on md and up: this is a phone-first product and these
        // are thumb targets.
        sm: 'h-8 px-2.5 text-[0.8125rem] rounded-edge',
        md: 'h-11 px-4 text-[0.875rem] rounded-edge',
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
