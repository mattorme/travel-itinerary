import Link from 'next/link';
import Image from 'next/image';
import { Copy, Heart } from 'lucide-react';
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
  clone_count: number;
  like_count: number;
  interests: string[] | null;
  travel_style: string | null;
  profiles: any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function TripCard({ trip }: { trip: TripCardData }) {
  const creator = Array.isArray(trip.profiles) ? trip.profiles[0] : trip.profiles;
  const cost = trip.estimated_cost_total !== null ? Number(trip.estimated_cost_total) : null;

  return (
    <Link
      href={`/t/${trip.slug}`}
      className="group block overflow-hidden rounded-card border border-line bg-paper-raised transition-colors hover:border-line-strong"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-paper-sunk">
        {trip.hero_image_url ? (
          <Image
            src={trip.hero_image_url}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="font-display text-5xl text-line-strong">{trip.duration_days}</span>
          </div>
        )}
        <div className="absolute top-3 left-3 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-medium text-paper backdrop-blur-sm">
          {trip.duration_days} {trip.duration_days === 1 ? 'day' : 'days'}
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-display text-lg leading-snug text-balance">{trip.title}</h3>
        {trip.subtitle && (
          <p className="mt-1.5 line-clamp-2 text-sm text-ink-muted">{trip.subtitle}</p>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span className="text-ink-muted">
            {cost !== null ? `~${formatCurrency(cost, trip.currency)}` : 'Budget varies'}
          </span>
          <span className="flex items-center gap-3 text-ink-faint">
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
          <p className="mt-3 border-t border-line pt-3 text-xs text-ink-faint">
            by @{creator.username}
          </p>
        )}
      </div>
    </Link>
  );
}
