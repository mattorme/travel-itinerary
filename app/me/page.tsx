import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/db/supabase/server';
import { getSessionUser } from '@/lib/auth/session';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'My trips', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function MyTripsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin');

  const supabase = await createClient();
  const { data: trips } = await supabase
    .from('trips')
    .select('id, slug, title, status, visibility, duration_days, currency, estimated_cost_total, updated_at, origin_creator_username')
    .eq('owner_id', user.id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-12">
        <div className="flex items-end justify-between gap-4">
          <h1 className="type-display type-title">My trips</h1>
          <div className="flex items-center gap-3">
            <Link href="/me/saved" className="text-sm text-steel underline underline-offset-4 hover:text-ink">
              Saved
            </Link>
            <Link href="/plan">
              <Button variant="signal">New trip</Button>
            </Link>
          </div>
        </div>

        {user.isAnonymous && (trips?.length ?? 0) > 0 && (
          <div className="mt-8 rounded-panel border border-signal/30 bg-signal-wash p-5">
            <p className="font-medium">Save these to an account</p>
            <p className="mt-1.5 text-sm text-steel">
              You&apos;re browsing without an account. Your trips live on this device only.
              Sign up and they come with you.
            </p>
            <Link href="/signin" className="mt-4 inline-block">
              <Button variant="primary" size="sm">Create an account</Button>
            </Link>
          </div>
        )}

        {trips && trips.length > 0 ? (
          <ul className="mt-8 divide-y divide-rule border-y border-rule">
            {trips.map((trip) => (
              <li key={trip.id}>
                <Link
                  href={`/trips/${trip.id}`}
                  className="flex items-center justify-between gap-4 py-5 transition-colors hover:bg-sunk/50"
                >
                  <div className="min-w-0">
                    <p className="truncate type-display text-lg">{trip.title}</p>
                    <p className="mt-1 text-sm text-steel-2">
                      {trip.duration_days} days
                      {trip.estimated_cost_total !== null &&
                        ` · ~${formatCurrency(Number(trip.estimated_cost_total), trip.currency)}`}
                      {trip.origin_creator_username && ` · from @${trip.origin_creator_username}`}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-sunk px-3 py-1 text-xs text-steel capitalize">
                    {trip.status === 'ready' ? trip.visibility : trip.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-16 rounded-panel border border-rule bg-surface p-10 text-center">
            <p className="type-display text-xl">No trips yet</p>
            <p className="mt-2 text-steel">Plan one and it will show up here.</p>
            <Link href="/plan" className="mt-6 inline-block">
              <Button variant="signal">Plan a trip</Button>
            </Link>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
