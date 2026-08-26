import 'server-only';
import { createAdminClient } from '@/lib/db/supabase/admin';
import { jsonAs, type Json } from '@/lib/db/rows';
import { recordApiUsage } from '@/lib/observability/usage';
import { createUnsplashProvider } from './unsplash';
import type { CoverImage, ImageCredit, ImageProvider, ImageQuery } from './types';

export type { CoverImage, ImageCredit, ImageQuery } from './types';

/**
 * Cover image resolution.
 *
 * Destination-first and cached on the `destinations` row: the tenth trip to
 * Tokyo reuses the ninth's hero rather than paying for another search. That is
 * the same amortisation argument as the place corpus, and it also means a
 * destination's imagery can be curated by hand once and stays curated.
 */

let provider: ImageProvider | null | undefined;

function imageProvider(): ImageProvider | null {
  if (provider === undefined) provider = createUnsplashProvider();
  return provider;
}


/**
 * The hero for a destination, resolving once and reusing it thereafter.
 * A manually curated image on the destination row always wins.
 */
export async function destinationCover(args: {
  destinationId: string;
  name: string;
  countryName: string;
}): Promise<CoverImage | null> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from('destinations')
    .select('hero_image_url, hero_credit')
    .eq('id', args.destinationId)
    .maybeSingle();

  if (existing?.hero_image_url && existing.hero_credit) {
    return fromStored(existing.hero_image_url, existing.hero_credit);
  }

  const found = await search({
    subject: `${args.name} ${args.countryName}`,
    hints: ['cityscape', 'travel'],
  });
  if (!found) return null;

  await admin
    .from('destinations')
    .update({
      hero_image_url: found.url,
      hero_credit: JSON.parse(JSON.stringify(stripInternals(found))),
    })
    .eq('id', args.destinationId);

  return found;
}

/**
 * The hero for one trip.
 *
 * Biased by the traveller's interests so two trips to the same city do not look
 * identical — a food trip and a hiking trip should not share a picture.
 */
export async function tripCover(args: {
  destinationName: string;
  countryName: string;
  interests: readonly string[];
}): Promise<CoverImage | null> {
  const hints = args.interests.slice(0, 2).map((i) => i.replace(/_/g, ' '));
  return search({
    subject: `${args.destinationName} ${args.countryName}`,
    hints: hints.length > 0 ? hints : ['travel'],
  });
}

async function search(query: ImageQuery): Promise<CoverImage | null> {
  const active = imageProvider();
  if (!active) return null;

  const found = await active.search(query);
  if (!found) return null;

  await recordApiUsage({ provider: 'images', sku: `${active.name}.search`, units: 1 });
  // Required by Unsplash: signal that the photo was actually used so the
  // photographer's view count is right. Deliberately not awaited.
  void active.markUsed?.(found);

  return found;
}

/**
 * `destinations.hero_credit`, as it has actually been written.
 *
 * Every field is optional because the column holds rows from two eras: the
 * current one stores the whole cover minus its URL, an earlier one stored just
 * the four credit fields at the top level. Both still render, which is why the
 * reader below checks the nested shape first and then the flat one — and why
 * this is a shape with optional fields rather than a `CoverImage`.
 */
interface StoredCover {
  thumbUrl?: string | null;
  width?: number;
  height?: number;
  colour?: string | null;
  altText?: string | null;
  provider?: string;
  credit?: Partial<ImageCredit>;
  author?: string;
  authorUrl?: string | null;
  source?: string;
  sourceUrl?: string | null;
}

function fromStored(url: string, stored: Json | null): CoverImage {
  const cover = jsonAs<StoredCover>(stored) ?? {};
  return {
    url,
    thumbUrl: cover.thumbUrl ?? null,
    width: cover.width ?? 1600,
    height: cover.height ?? 900,
    colour: cover.colour ?? null,
    altText: cover.altText ?? null,
    credit: {
      author: cover.credit?.author ?? cover.author ?? 'Unknown',
      authorUrl: cover.credit?.authorUrl ?? cover.authorUrl ?? null,
      source: cover.credit?.source ?? cover.source ?? 'Unsplash',
      sourceUrl: cover.credit?.sourceUrl ?? cover.sourceUrl ?? null,
    },
    provider: cover.provider ?? 'unsplash',
  };
}

/** Drops provider-internal fields before the image is persisted. */
function stripInternals(image: CoverImage): CoverImage {
  const { ...rest } = image as CoverImage & { downloadLocation?: string };
  delete (rest as { downloadLocation?: string }).downloadLocation;
  return rest;
}
