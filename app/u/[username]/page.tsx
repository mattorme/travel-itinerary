import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/db/supabase/server';
import { getSessionUser } from '@/lib/auth/session';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { TripCard } from '@/components/trip/trip-card';
import { TRIP_CARD_COLUMNS } from '@/lib/db/selects';
import { FollowButton } from '@/components/profile/follow-button';
import { CoverArt } from '@/components/ui/cover-art';
import { formatCompact } from '@/lib/utils/format';
import { publicEnv } from '@/lib/public-env';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `@${username}`,
    description: `Trips shared by @${username}.`,
    alternates: { canonical: `${publicEnv.siteUrl}/u/${username}` },
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();
  const viewer = await getSessionUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, follower_count, following_count, trip_count')
    .eq('username', username)
    .maybeSingle();

  if (!profile) notFound();

  const [{ data: trips }, { data: follow }] = await Promise.all([
    supabase
      .from('trips')
      .select(TRIP_CARD_COLUMNS)
      .eq('owner_id', profile.id)
      .eq('visibility', 'public')
      .eq('moderation_state', 'approved')
      .is('deleted_at', null)
      .order('published_at', { ascending: false })
      .limit(24),
    viewer
      ? supabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', viewer.id)
          .eq('followee_id', profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 py-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="relative size-16 shrink-0 overflow-hidden rounded-full bg-sunk">
              {/* Generated rather than a grey circle with an initial in it. */}
              <CoverArt seed={profile.username} label={profile.username} />
            </span>
            <div className="min-w-0">
              <h1 className="type-display type-title">
                {profile.display_name ?? `@${profile.username}`}
              </h1>
              <p className="mt-1 text-steel-2">@{profile.username}</p>
              {profile.bio && <p className="mt-3 max-w-xl text-steel">{profile.bio}</p>}

              {/* A div inside a dl may contain only dt and dd, so the unit is
                  the term itself rather than a third element. Reversed so it
                  still reads "12 followers". */}
              <dl className="mt-4 flex gap-6 text-sm">
                {[
                  { term: 'trips', value: profile.trip_count },
                  {
                    term: profile.follower_count === 1 ? 'follower' : 'followers',
                    value: profile.follower_count,
                  },
                  { term: 'following', value: profile.following_count },
                ].map((stat) => (
                  <div key={stat.term} className="flex flex-row-reverse gap-1.5">
                    <dt className="text-steel-2">{stat.term}</dt>
                    <dd className="font-medium">{formatCompact(stat.value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <FollowButton
            username={profile.username}
            initiallyFollowing={follow !== null}
            isSelf={viewer?.id === profile.id}
          />
        </div>

        {trips && trips.length > 0 ? (
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        ) : (
          <p className="mt-12 text-steel">No public trips yet.</p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
