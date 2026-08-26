import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { loadTripById } from '@/lib/itinerary/hydrate';
import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/db/supabase/server';
import { asTripId } from '@/domain/types/ids';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { TripView } from '@/components/trip/trip-view';
import { OwnerTripActions } from '@/components/trip/owner-trip-actions';
import { DangerZone } from '@/components/trip/danger-zone';
import { GenerationProgress } from '@/components/trip/generation-progress';

export const metadata: Metadata = {
  title: 'Your trip',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The owner's view.
 *
 * While a trip is generating this renders the live progress instead — driven by
 * the job row over Realtime, so a refresh or a locked phone does not lose it.
 */
export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect('/signin');

  const itinerary = await loadTripById(asTripId(id));
  if (!itinerary) notFound();

  // Someone else's trip: send them to the public URL, where visibility rules
  // decide what they may see.
  if (itinerary.creator?.id !== user.id) {
    redirect(`/t/${itinerary.slug}`);
  }

  if (itinerary.status === 'generating' || itinerary.status === 'failed') {
    const supabase = await createClient();
    const { data: job } = await supabase
      .from('generation_jobs')
      .select('id, status, stage, progress, error')
      .eq('trip_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return (
      <>
        <SiteHeader />
        <main>
          <GenerationProgress
            tripId={id}
            jobId={job?.id ?? null}
            initialStage={job?.stage ?? null}
            initialProgress={Number(job?.progress ?? 0)}
            initialStatus={job?.status ?? 'queued'}
            initialError={
              job?.error && typeof job.error === 'object' && 'message' in job.error
                ? String((job.error as { message: unknown }).message)
                : null
            }
            destination={itinerary.request.destinationQuery}
          />
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="pt-8">
        <TripView
          itinerary={itinerary}
          editable
          actions={<OwnerTripActions itinerary={itinerary} />}
          footer={
            <DangerZone tripId={itinerary.id} cloneCount={itinerary.counters.clones} />
          }
        />
      </main>
      <SiteFooter />
    </>
  );
}
