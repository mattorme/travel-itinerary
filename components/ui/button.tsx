import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium transition-colors ' +
    'disabled:pointer-events-none disabled:opacity-50 select-none ' +
    'active:scale-[0.99] transition-transform',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-paper hover:bg-ink/90',
        accent: 'bg-accent text-white hover:bg-accent-hover',
        outline: 'border border-line-strong bg-paper-raised text-ink hover:bg-paper-sunk',
        ghost: 'text-ink-muted hover:bg-paper-sunk hover:text-ink',
        quiet: 'text-ink-muted underline underline-offset-4 hover:text-ink',
      },
      size: {
        // 44px minimum: this is a phone-first product and these are thumb targets.
        sm: 'h-9 px-3 text-sm rounded-full',
        md: 'h-11 px-5 text-[0.9375rem] rounded-full',
        lg: 'h-13 px-7 text-base rounded-full',
        icon: 'h-11 w-11 rounded-full',
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
