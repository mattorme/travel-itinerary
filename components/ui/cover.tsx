import Image from 'next/image';
import { CoverArt } from './cover-art';
import { cn } from '@/lib/utils/cn';

export interface CoverCredit {
  readonly author?: string | null;
  readonly authorUrl?: string | null;
  readonly source?: string | null;
  readonly sourceUrl?: string | null;
  readonly colour?: string | null;
  readonly altText?: string | null;
}

/**
 * A photograph if we have one, generated art if we do not.
 *
 * The credit line is not optional decoration: Unsplash's API guidelines require
 * attributing the photographer and Unsplash with links back, so it renders here
 * where it cannot be forgotten by a caller.
 */
export function Cover({
  imageUrl,
  credit,
  seed,
  label,
  priority = false,
  sizes,
  showLabel = false,
  className,
}: {
  imageUrl: string | null;
  credit?: CoverCredit | null;
  seed: string;
  label: string;
  priority?: boolean;
  sizes?: string;
  showLabel?: boolean;
  className?: string;
}) {
  if (!imageUrl) {
    return (
      <div className={cn('absolute inset-0', className)}>
        <CoverArt seed={seed} label={label} showLabel={showLabel} />
      </div>
    );
  }

  return (
    <>
      <Image
        src={imageUrl}
        alt={credit?.altText ?? ''}
        fill
        priority={priority}
        sizes={sizes ?? '100vw'}
        // The average colour from the provider stands in while the image loads,
        // so a hero does not flash white on a slow connection.
        style={credit?.colour ? { backgroundColor: credit.colour } : undefined}
        className={cn('object-cover', className)}
      />
      {credit?.author && (
        <span className="pointer-events-auto absolute right-2 bottom-2 rounded-full bg-ink/60 px-2.5 py-1 text-[0.6875rem] text-white/90 backdrop-blur-sm">
          {credit.authorUrl ? (
            <a href={credit.authorUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {credit.author}
            </a>
          ) : (
            credit.author
          )}
          {credit.source && (
            <>
              {' / '}
              {credit.sourceUrl ? (
                <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {credit.source}
                </a>
              ) : (
                credit.source
              )}
            </>
          )}
        </span>
      )}
    </>
  );
}
