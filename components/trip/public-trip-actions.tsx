'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Heart, Loader2, Pencil, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cloneTrip, toggleLike } from '@/app/actions/trip-actions';
import { ShareSheet } from './share-sheet';
import { formatCompact } from '@/lib/utils/format';
import type { Itinerary } from '@/domain/types/itinerary';

/**
 * The bar under the hero on a public trip.
 *
 * "Make this trip yours" is the primary action and works logged out — the whole
 * retention loop depends on that tap not hitting a sign-up wall.
 */
export function PublicTripActions({
  itinerary,
  isOwner,
}: {
  itinerary: Itinerary;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(itinerary.counters.likes);
  const [shareOpen, setShareOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onClone() {
    setError(null);
    startTransition(async () => {
      const result = await cloneTrip(itinerary.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/t/${result.data.slug}`);
    });
  }

  function onLike() {
    // Optimistic: a like should feel instant, and the failure case is trivial.
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    startTransition(async () => {
      const result = await toggleLike(itinerary.id);
      if (!result.ok) {
        setLiked(!next);
        setLikes((n) => n + (next ? -1 : 1));
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {isOwner ? (
          <Button variant="primary" size="lg" onClick={() => router.push(`/trips/${itinerary.id}`)}>
            <Pencil className="size-4" />
            Edit this trip
          </Button>
        ) : (
          <Button variant="accent" size="lg" onClick={onClone} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
            Make this trip yours
          </Button>
        )}

        <Button variant="outline" size="lg" onClick={() => setShareOpen(true)}>
          <Share2 className="size-4" />
          Share
        </Button>

        <Button
          variant="ghost"
          size="lg"
          onClick={onLike}
          aria-pressed={liked}
          aria-label={liked ? 'Remove like' : 'Like this trip'}
        >
          <Heart className={`size-4 ${liked ? 'fill-accent text-accent' : ''}`} />
          {likes > 0 && formatCompact(likes)}
        </Button>
      </div>

      {itinerary.counters.clones > 0 && (
        <p className="text-sm text-ink-faint">
          {formatCompact(itinerary.counters.clones)}{' '}
          {itinerary.counters.clones === 1 ? 'person has' : 'people have'} made this trip theirs.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      )}

      {shareOpen && (
        <ShareSheet itinerary={itinerary} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}
