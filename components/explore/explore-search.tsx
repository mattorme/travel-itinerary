'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { inputClass } from '@/components/ui/field';

/**
 * Search box.
 *
 * Submits on enter rather than on every keystroke: each search is a database
 * round trip and a full server render, and a debounce fast enough to feel live
 * would fire one for every partial word.
 *
 * The parent keys this component on the query, so navigating back re-mounts it
 * with the right value. Syncing the URL into state through an effect instead
 * would re-render the whole page twice on every navigation.
 */
export function ExploreSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(next: string) {
    const search = new URLSearchParams(params.toString());
    const trimmed = next.trim();
    if (trimmed) search.set('q', trimmed);
    else search.delete('q');
    // A new query invalidates the old ordering; fall back to relevance.
    search.delete('sort');
    router.push(`/explore?${search.toString()}` as never);
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit(value);
      }}
    >
      <label htmlFor="explore-search" className="sr-only">
        Search trips
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-steel-2"
          aria-hidden
        />
        <input
          id="explore-search"
          ref={inputRef}
          type="search"
          name="q"
          className={cn(inputClass, 'pl-11 pr-11')}
          placeholder="A destination, or something you want to do…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setValue('');
              submit('');
              inputRef.current?.focus();
            }}
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1.5 text-steel-2 hover:bg-sunk hover:text-ink"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </form>
  );
}
