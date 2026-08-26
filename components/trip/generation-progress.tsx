'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/db/supabase/browser';
import { Button } from '@/components/ui/button';
import { stageCopyClient } from '@/lib/itinerary/stage-copy';

/**
 * Live generation progress.
 *
 * Subscribes to the job row rather than holding a stream open, so this survives
 * a refresh, a lost connection, or a phone locking mid-generation. The copy is
 * driven by real stage transitions — a progress message that says "optimising
 * your route" while nothing is happening is the thing users notice and resent.
 */
export function GenerationProgress({
  tripId,
  jobId,
  initialStage,
  initialProgress,
  initialStatus,
  initialError,
  destination,
}: {
  tripId: string;
  jobId: string | null;
  initialStage: string | null;
  initialProgress: number;
  initialStatus: string;
  initialError: string | null;
  destination: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState(initialStage);
  const [progress, setProgress] = useState(initialProgress);
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState(initialError);

  useEffect(() => {
    if (!jobId || status === 'succeeded' || status === 'failed') return;

    const supabase = createClient();
    const channel = supabase
      .channel(`job:${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'generation_jobs', filter: `id=eq.${jobId}` },
        (payload) => {
          const row = payload.new as {
            stage: string | null;
            progress: number;
            status: string;
            error: { message?: string } | null;
          };
          setStage(row.stage);
          setProgress(Number(row.progress));
          setStatus(row.status);
          if (row.error?.message) setError(row.error.message);
          if (row.status === 'succeeded') router.refresh();
        },
      )
      .subscribe();

    // Realtime can drop a message; poll slowly as a floor so a finished trip is
    // never left sitting on a spinner.
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from('generation_jobs')
        .select('stage, progress, status, error')
        .eq('id', jobId)
        .maybeSingle();
      if (!data) return;
      setStage(data.stage);
      setProgress(Number(data.progress));
      setStatus(data.status);
      if (data.status === 'succeeded') router.refresh();
    }, 6000);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [jobId, status, router]);

  if (status === 'failed') {
    return (
      <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-center px-5 text-center">
        <AlertCircle className="mx-auto size-8 text-caution" />
        <h1 className="mt-5 type-display type-title">That didn&apos;t work</h1>
        <p className="mt-4 text-steel">
          {error ?? 'Something went wrong while building your trip.'}
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Button variant="signal" size="lg" block onClick={() => router.push('/plan')}>
            Try again
          </Button>
          <Button variant="ghost" size="lg" block onClick={() => router.push('/')}>
            Back home
          </Button>
        </div>
      </div>
    );
  }

  const percent = Math.round(Math.max(0.04, progress) * 100);

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-center px-5">
      <p className="text-xs font-medium tracking-widest text-steel-2 uppercase">
        Building your trip
      </p>
      <h1 className="mt-3 type-display type-title text-balance">{destination}</h1>

      <div className="mt-10">
        <div className="h-1 overflow-hidden rounded-full bg-rule">
          <div
            className="h-1 rounded-full bg-signal transition-[width] duration-700 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-4 flex items-center gap-2 text-[0.9375rem] text-steel">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {stageCopyClient(stage)}
        </p>
      </div>

      <p className="mt-10 text-sm leading-relaxed text-steel-2">
        This usually takes under a minute. We&apos;re checking real places, their opening
        hours, and how long it actually takes to get between them — you can leave this page
        and come back.
      </p>

      <p className="sr-only" role="status" aria-live="polite">
        {stageCopyClient(stage)} — {percent} percent complete
      </p>
    </div>
  );
}
