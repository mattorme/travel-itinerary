import 'server-only';
import { createAdminClient } from '@/lib/db/supabase/admin';
import type { TripRequestParsed } from '@/domain/schemas/trip-request';
import { asJobId, asTripId, type JobId, type ProfileId, type TripId } from '@/domain/types/ids';
import { generateItinerary } from './pipeline';
import { STAGE_COPY, type Stage } from './stage-names';
import { persistItinerary } from './persist';
import { toUserMessage } from '@/lib/observability/errors';

/**
 * Generation as a job.
 *
 * A 7-day itinerary is 60-120 seconds of work. Holding an HTTP connection open
 * for that is fragile (a phone locking mid-generation kills it) and
 * unresumable. Instead: a row the client subscribes to over Realtime. Progress
 * becomes observable state rather than an ephemeral stream, and moving the
 * worker off the request path later touches only this file.
 *
 * See docs/ARCHITECTURE.md §7.
 */

export interface StartedJob {
  readonly tripId: TripId;
  readonly jobId: JobId;
}

export async function createGenerationJob(
  request: TripRequestParsed,
  ownerId: ProfileId,
): Promise<StartedJob> {
  const admin = createAdminClient();

  const provisionalTitle = `${request.dates.durationDays} days in ${request.destinationQuery}`;
  const { data: slug } = await admin.rpc('unique_trip_slug', { base: provisionalTitle });

  const { data: trip, error: tripError } = await admin
    .from('trips')
    .insert({
      owner_id: ownerId,
      slug: slug ?? `trip-${Date.now()}`,
      title: provisionalTitle,
      status: 'generating',
      visibility: 'private',
      start_date: request.dates.start,
      end_date: request.dates.end,
      duration_days: request.dates.durationDays,
      date_mode: request.dates.mode,
      party: { adults: request.party.adults, children: request.party.children },
      currency: request.currency,
      budget_total: request.budgetTotal,
      budget_daily: request.budgetDaily,
      travel_style: request.travelStyle,
      pace: request.pace,
      interests: [...request.interests],
      transport_modes: [...request.transportModes],
      food_prefs: [...request.foodPrefs],
      accommodation_pref: request.accommodation,
      user_notes: request.notes,
    })
    .select('id')
    .single();

  if (tripError || !trip) {
    throw new Error(`Could not create trip: ${tripError?.message ?? 'no row'}`);
  }

  const { data: job, error: jobError } = await admin
    .from('generation_jobs')
    .insert({
      trip_id: trip.id,
      requester_id: ownerId,
      status: 'queued',
      input: JSON.parse(JSON.stringify(request)),
    })
    .select('id')
    .single();

  if (jobError || !job) {
    throw new Error(`Could not create generation job: ${jobError?.message ?? 'no row'}`);
  }

  return { tripId: asTripId(trip.id), jobId: asJobId(job.id) };
}

/**
 * Runs the pipeline and writes progress as it goes.
 *
 * Never throws: a failed generation is a job row in `failed` with a message the
 * user can read, not an unhandled rejection in a background task.
 */
export async function runGenerationJob(
  job: StartedJob,
  request: TripRequestParsed,
): Promise<void> {
  const admin = createAdminClient();
  const startedAt = Date.now();

  await admin
    .from('generation_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', job.jobId);

  const history: { stage: Stage; at: number }[] = [];

  try {
    const draft = await generateItinerary({
      tripId: job.tripId,
      jobId: job.jobId,
      request,
      onStage: async (stage, progress) => {
        history.push({ stage, at: Date.now() - startedAt });
        await admin
          .from('generation_jobs')
          .update({
            stage,
            progress,
            stage_history: JSON.parse(JSON.stringify(history)),
          })
          .eq('id', job.jobId);
      },
    });

    await persistItinerary(job.tripId, draft, request);

    await admin
      .from('generation_jobs')
      .update({
        status: 'succeeded',
        progress: 1,
        stage: 'finalising',
        finished_at: new Date().toISOString(),
      })
      .eq('id', job.jobId);
  } catch (error) {
    console.error('[generation] failed', job.jobId, error);

    await admin
      .from('generation_jobs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error: {
          message: toUserMessage(error),
          // Kept for debugging; never rendered.
          detail: error instanceof Error ? error.message : String(error),
        },
      })
      .eq('id', job.jobId);

    await admin.from('trips').update({ status: 'failed' }).eq('id', job.tripId);
  }
}

export function stageCopy(stage: string | null): string {
  if (!stage) return 'Getting started…';
  return STAGE_COPY[stage as Stage] ?? 'Working…';
}
