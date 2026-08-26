import { cn } from '@/lib/utils/cn';

/**
 * The mark and the wordmark.
 *
 * The mark is the day arc compressed to three bars in a gradient tile — the
 * product's one graphic idea, small enough to sit in a nav bar and in an app
 * icon without redrawing it. Kept in one component so the header, the footer
 * and the offline shell can never drift apart.
 */
export function Logo({
  className,
  tone = 'ink',
}: {
  className?: string;
  /** `invert` is for dark grounds — the tile keeps its gradient either way. */
  tone?: 'ink' | 'invert';
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span
        aria-hidden
        className="grad-brand flex size-8 shrink-0 items-center justify-center gap-[2.5px] rounded-[0.5rem] shadow-(--shadow-cta)"
      >
        <span className="h-3.5 w-[3px] rounded-full bg-white/95" />
        <span className="h-2.5 w-[3px] rounded-full bg-white/70" />
        <span className="h-[1.125rem] w-[3px] rounded-full bg-white/95" />
      </span>
      <span
        className={cn(
          'type-display text-[1.3125rem] tracking-[-0.04em]',
          tone === 'invert' ? 'text-white' : 'text-ink',
        )}
      >
        Wayfare
      </span>
    </span>
  );
}
