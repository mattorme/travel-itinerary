import Link from 'next/link';
import { Copy, Heart } from 'lucide-react';
import { Cover } from '@/components/ui/cover';
import { formatCurrency } from '@/lib/utils/format';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface TripCardData {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  duration_days: number;
  currency: string;
  estimated_cost_total: number | string | null;
  hero_image_url: string | null;
  hero_credit?: unknown;
  clone_count: number;
  like_count: number;
  interests: string[] | null;
  travel_style: string | null;
  profiles: any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * A trip in a listing.
 *
 * Square-edged and hard-ruled rather than a floating rounded card — the grid
 * should read as a departures board, and rounded cards with drop shadows are
 * the single most templated thing a listing can do.
 */
export function TripCard({ trip }: { trip: TripCardData }) {
  const creator = Array.isArray(trip.profiles) ? trip.profiles[0] : trip.profiles;
  const cost = trip.estimated_cost_total !== null ? Number(trip.estimated_cost_total) : null;

  return (
    <Link
      href={`/t/${trip.slug}`}
      // Exposed as data so filtering can be asserted without reading text that
      // CSS has upper-cased.
      data-duration={trip.duration_days}
      className="group flex flex-col border border-rule bg-surface transition-colors hover:border-ink"
    >
      <div className="relative aspect-[3/2] overflow-hidden bg-sunk">
        <Cover
          imageUrl={trip.hero_image_url}
          credit={trip.hero_credit as never}
          seed={trip.slug}
          label={trip.title}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <span className="type-label absolute top-0 left-0 bg-ink px-2 py-1.5 text-paper">
          {trip.duration_days} {trip.duration_days === 1 ? 'day' : 'days'}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="type-display text-[1.25rem] leading-[1.1]">{trip.title}</h3>
        {trip.subtitle && (
          <p className="mt-2 line-clamp-2 text-[0.875rem] leading-relaxed text-steel">
            {trip.subtitle}
          </p>
        )}

        <div className="mt-auto flex items-baseline justify-between gap-3 pt-4">
          <span className="type-data text-[0.875rem]">
            {cost !== null ? formatCurrency(cost, trip.currency) : '—'}
          </span>
          <span className="type-data flex items-center gap-3 text-[0.75rem] text-steel-2">
            {trip.clone_count > 0 && (
              <span className="flex items-center gap-1">
                <Copy className="size-3.5" aria-hidden />
                {trip.clone_count}
              </span>
            )}
            {trip.like_count > 0 && (
              <span className="flex items-center gap-1">
                <Heart className="size-3.5" aria-hidden />
                {trip.like_count}
              </span>
            )}
          </span>
        </div>

        {creator?.username && (
          <p className="mt-3 border-t border-rule pt-3 text-[0.75rem] text-steel-2">
            @{creator.username}
          </p>
        )}
      </div>
    </Link>
  );
}
