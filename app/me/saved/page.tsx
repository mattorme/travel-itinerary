import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/db/supabase/server';
import { getSessionUser } from '@/lib/auth/session';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { TripCard } from '@/components/trip/trip-card';
import { TRIP_CARD_COLUMNS } from '@/lib/db/selects';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Saved trips', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function SavedTripsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin');

  const supabase = await createClient();
  const { data: saves } = await supabase
    .from('trip_saves')
    .select(`created_at, trips!inner(${TRIP_CARD_COLUMNS})`)
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })
    .limit(48);

  const trips = (saves ?? []).map((row) => row.trips);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 py-12">
        <div className="flex items-end justify-between gap-4">
          <h1 className="type-display type-title">Saved</h1>
          <Link href="/me" className="text-sm text-steel underline underline-offset-4 hover:text-ink">
            My trips
          </Link>
        </div>

        {trips.length > 0 ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        ) : (
          <div className="mt-16 rounded-panel border border-rule bg-surface p-10 text-center">
            <p className="type-display text-xl">Nothing saved yet</p>
            <p className="mt-2 text-steel">
              Bookmark trips you like and they will collect here.
            </p>
            <Link href="/explore" className="mt-6 inline-block">
              <Button variant="signal">Browse trips</Button>
            </Link>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
