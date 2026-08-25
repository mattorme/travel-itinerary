import 'server-only';
import { createAdminClient } from '@/lib/db/supabase/admin';
import { recordApiUsage } from '@/lib/observability/usage';
import { createUnsplashProvider } from './unsplash';
import type { CoverImage, ImageProvider, ImageQuery } from './types';

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

export function imagesAvailable(): boolean {
  return imageProvider() !== null;
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

/* eslint-disable @typescript-eslint/no-explicit-any */
function fromStored(url: string, credit: any): CoverImage {
  return {
    url,
    thumbUrl: credit?.thumbUrl ?? null,
    width: credit?.width ?? 1600,
    height: credit?.height ?? 900,
    colour: credit?.colour ?? null,
    altText: credit?.altText ?? null,
    credit: {
      author: credit?.credit?.author ?? credit?.author ?? 'Unknown',
      authorUrl: credit?.credit?.authorUrl ?? credit?.authorUrl ?? null,
      source: credit?.credit?.source ?? credit?.source ?? 'Unsplash',
      sourceUrl: credit?.credit?.sourceUrl ?? credit?.sourceUrl ?? null,
    },
    provider: credit?.provider ?? 'unsplash',
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Drops provider-internal fields before the image is persisted. */
function stripInternals(image: CoverImage): CoverImage {
  const { ...rest } = image as CoverImage & { downloadLocation?: string };
  delete (rest as { downloadLocation?: string }).downloadLocation;
  return rest;
}
