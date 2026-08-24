import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/db/supabase/server';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { TripCard } from '@/components/trip/trip-card';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}`, description: `Trips shared by @${username}.` };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio')
    .eq('username', username)
    .maybeSingle();

  if (!profile) notFound();

  const { data: trips } = await supabase
    .from('trips')
    .select('id, slug, title, subtitle, duration_days, currency, estimated_cost_total, hero_image_url, clone_count, like_count, interests, travel_style, profiles:owner_id(username, display_name, avatar_url)')
    .eq('owner_id', profile.id)
    .eq('visibility', 'public')
    .eq('moderation_state', 'approved')
    .is('deleted_at', null)
    .order('published_at', { ascending: false })
    .limit(24);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 py-12">
        <h1 className="font-display text-display-sm">
          {profile.display_name ?? `@${profile.username}`}
        </h1>
        <p className="mt-2 text-ink-faint">@{profile.username}</p>
        {profile.bio && <p className="mt-4 max-w-xl text-ink-muted">{profile.bio}</p>}

        {trips && trips.length > 0 ? (
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        ) : (
          <p className="mt-12 text-ink-muted">No public trips yet.</p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
