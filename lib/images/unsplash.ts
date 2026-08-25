import 'server-only';
import { z } from 'zod';
import { serverEnv } from '@/lib/env';
import type { CoverImage, ImageProvider, ImageQuery } from './types';

/**
 * Unsplash.
 *
 * Three of their API guidelines shape this file and are not optional:
 *
 *  1. Hotlink. The URLs returned under `photo.urls` must be embedded directly —
 *     we may not proxy or re-host the image. That is why `CoverImage.url` is
 *     stored verbatim and `next.config.ts` allowlists images.unsplash.com.
 *  2. Attribute the photographer and Unsplash, linking back with utm params.
 *     `creditParams()` builds those links; the UI must render them.
 *  3. Trigger the download endpoint when a photo is actually used, so the
 *     photographer's stats are right. That is `markUsed`.
 */

const photoSchema = z.object({
  id: z.string(),
  width: z.number(),
  height: z.number(),
  color: z.string().nullable().optional(),
  alt_description: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  urls: z.object({
    raw: z.string(),
    full: z.string(),
    regular: z.string(),
    small: z.string(),
  }),
  links: z.object({ download_location: z.string() }),
  user: z.object({
    name: z.string(),
    username: z.string(),
    links: z.object({ html: z.string() }),
  }),
});

const searchSchema = z.object({ results: z.array(photoSchema) });

const APP_NAME = 'wayfare';
const UTM = `utm_source=${APP_NAME}&utm_medium=referral`;

export function createUnsplashProvider(): ImageProvider | null {
  const key = serverEnv().UNSPLASH_ACCESS_KEY;
  if (!key) return null;

  const headers = {
    Authorization: `Client-ID ${key}`,
    'Accept-Version': 'v1',
  };

  return {
    name: 'unsplash',

    async search(query: ImageQuery): Promise<CoverImage | null> {
      const terms = [query.subject, ...(query.hints ?? [])].filter(Boolean).join(' ');
      const url = new URL('https://api.unsplash.com/search/photos');
      url.searchParams.set('query', terms);
      url.searchParams.set('per_page', '10');
      url.searchParams.set('orientation', query.orientation ?? 'landscape');
      url.searchParams.set('content_filter', 'high');

      try {
        const response = await fetch(url, { headers, cache: 'no-store' });
        if (!response.ok) {
          console.warn('[unsplash] search failed', response.status);
          return null;
        }

        const { results } = searchSchema.parse(await response.json());
        // Prefer a genuinely wide frame: hero crops are 21:9 on desktop and a
        // near-square photo loses its subject entirely at that ratio.
        const best =
          results.find((p) => p.width / p.height >= 1.5) ?? results[0] ?? null;
        if (!best) return null;

        return {
          // Hotlinked, per the API guidelines. Never re-hosted.
          url: sized(best.urls.raw, 1600),
          thumbUrl: sized(best.urls.raw, 480),
          width: best.width,
          height: best.height,
          colour: best.color ?? null,
          altText: best.alt_description ?? best.description ?? null,
          credit: {
            author: best.user.name,
            authorUrl: `${best.user.links.html}?${UTM}`,
            source: 'Unsplash',
            sourceUrl: `https://unsplash.com/?${UTM}`,
          },
          provider: 'unsplash',
          // Carried so markUsed can fire later without another lookup.
          ...({ downloadLocation: best.links.download_location } as object),
        } as CoverImage;
      } catch (error) {
        console.warn('[unsplash] search error', error);
        return null;
      }
    },

    async markUsed(image: CoverImage): Promise<void> {
      const location = (image as { downloadLocation?: string }).downloadLocation;
      if (!location) return;
      try {
        await fetch(location, { headers, cache: 'no-store' });
      } catch {
        // Best effort. A missed stat is not worth failing a generation over.
      }
    },
  };
}

/** Unsplash serves resized derivatives from the raw URL via query params. */
function sized(raw: string, width: number): string {
  const url = new URL(raw);
  url.searchParams.set('w', String(width));
  url.searchParams.set('q', '80');
  url.searchParams.set('fm', 'jpg');
  url.searchParams.set('fit', 'crop');
  return url.toString();
}
