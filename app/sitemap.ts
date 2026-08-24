import type { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/db/supabase/admin';
import { publicEnv } from '@/lib/public-env';

export const revalidate = 3600;

/**
 * Only destination hubs and trips that have earned indexability.
 *
 * Listing every generated trip would be the same mistake as indexing them: a
 * sitemap full of near-duplicate pages tells a crawler exactly the wrong thing
 * about the site.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl;

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/explore`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/destinations`, changeFrequency: 'weekly', priority: 0.8 },
  ];

  try {
    const admin = createAdminClient();

    const [{ data: destinations }, { data: trips }] = await Promise.all([
      admin
        .from('destinations')
        .select('slug, updated_at')
        .gt('trip_count', 0)
        .order('trip_count', { ascending: false })
        .limit(500),
      admin
        .from('trips')
        .select('slug, updated_at')
        .eq('is_indexable', true)
        .is('deleted_at', null)
        .order('quality_score', { ascending: false })
        .limit(5000),
    ]);

    return [
      ...staticRoutes,
      ...(destinations ?? []).map((d) => ({
        url: `${base}/destinations/${d.slug}`,
        lastModified: d.updated_at ? new Date(d.updated_at) : undefined,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
      ...(trips ?? []).map((t) => ({
        url: `${base}/t/${t.slug}`,
        lastModified: t.updated_at ? new Date(t.updated_at) : undefined,
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      })),
    ];
  } catch (error) {
    console.error('[sitemap] failed to enumerate, serving static routes only', error);
    return staticRoutes;
  }
}
