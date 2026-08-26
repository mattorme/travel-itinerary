'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { humanise } from '@/lib/utils/format';
import { INTERESTS, TRAVEL_STYLES } from '@/domain/types/taxonomy';
import { DURATION_BANDS, SORTS, type SortKey } from './filter-options';

export { DURATION_BANDS, SORTS, type SortKey } from './filter-options';

/**
 * Filters as links, not client state.
 *
 * Every combination is a real URL, so a filtered view can be shared, bookmarked
 * and reached by the back button — and the server renders it directly instead
 * of the page flashing unfiltered results first.
 */
export function ExploreFilters({
  query,
  sort,
  days,
  style,
  interest,
}: {
  query: string;
  sort: SortKey;
  days: string | undefined;
  style: string | undefined;
  interest: string | undefined;
}) {
  const base = { ...(query ? { q: query } : {}), sort };

  const href = (patch: Record<string, string | undefined>) => {
    const next: Record<string, string> = { ...base };
    for (const [key, value] of Object.entries({ days, style, interest, ...patch })) {
      if (value) next[key] = value;
      else delete next[key];
    }
    return { pathname: '/explore' as const, query: next };
  };

  const active = [
    days && { label: DURATION_BANDS.find((b) => b.key === days)?.label ?? days, clear: { days: undefined } },
    style && { label: humanise(style), clear: { style: undefined } },
    interest && { label: humanise(interest), clear: { interest: undefined } },
  ].filter(Boolean) as { label: string; clear: Record<string, undefined> }[];

  // "Best match" is meaningless without a query, so it only appears with one.
  const sorts = query ? SORTS : SORTS.filter((s) => s.key !== 'relevance');

  return (
    <div className="space-y-3">
      <div className="hide-scrollbar flex gap-1.5 overflow-x-auto pb-1">
        {sorts.map((option) => (
          <Chip key={option.key} href={href({ sort: option.key })} active={sort === option.key}>
            {option.label}
          </Chip>
        ))}
        <span className="w-px shrink-0 self-stretch bg-rule" aria-hidden />
        {DURATION_BANDS.map((band) => (
          <Chip
            key={band.key}
            href={href({ days: days === band.key ? undefined : band.key })}
            active={days === band.key}
          >
            {band.label}
          </Chip>
        ))}
      </div>

      <details className="group">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm text-steel hover:text-ink">
          More filters
          <span className="transition-transform group-open:rotate-180" aria-hidden>
            ⌄
          </span>
        </summary>

        <div className="mt-3 space-y-3">
          <FilterRow label="Style">
            {TRAVEL_STYLES.map((option) => (
              <Chip
                key={option}
                href={href({ style: style === option ? undefined : option })}
                active={style === option}
              >
                {humanise(option)}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Interest">
            {INTERESTS.map((option) => (
              <Chip
                key={option}
                href={href({ interest: interest === option ? undefined : option })}
                active={interest === option}
              >
                {humanise(option)}
              </Chip>
            ))}
          </FilterRow>
        </div>
      </details>

      {active.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Active filters">
          {active.map((chip) => (
            <li key={chip.label}>
              <Link
                href={href(chip.clear)}
                className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-sm text-white"
              >
                {chip.label}
                <X className="size-3" aria-hidden />
                <span className="sr-only">Remove filter</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium tracking-widest text-steel-2 uppercase">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: React.ComponentProps<typeof Link>['href'];
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'shrink-0 rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors',
        active
          ? 'bg-ink text-white'
          : 'border border-rule-2 text-steel hover:text-ink',
      )}
    >
      {children}
    </Link>
  );
}
