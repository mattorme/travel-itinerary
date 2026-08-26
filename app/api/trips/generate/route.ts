import { after, NextResponse, type NextRequest } from 'next/server';
import { tripRequestSchema } from '@/domain/schemas/trip-request';
import { admitGeneration } from '@/lib/itinerary/admission';
import { createGenerationJob, runGenerationJob } from '@/lib/itinerary/jobs';
import { clientIp } from '@/lib/utils/request';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Starts a generation and returns immediately.
 *
 * The handler does three things and nothing else: validate the body, ask
 * `admitGeneration` whether this request may spend our money, and start the
 * job. The admission policy itself is six ordered checks and lives in
 * lib/itinerary/admission.ts, where it can be read as a sequence and tested
 * without an HTTP request.
 *
 * The work continues in `after()` while the client watches the job row over
 * Realtime — nothing here waits for the pipeline. See docs/ARCHITECTURE.md §7.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const payload = body as { trip?: unknown; turnstileToken?: unknown };
  const parsed = tripRequestSchema.safeParse(payload.trip);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Some of those details did not look right.',
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const admission = await admitGeneration({
    request: parsed.data,
    ip: clientIp(request),
    turnstileToken:
      typeof payload.turnstileToken === 'string' ? payload.turnstileToken : null,
    isDevelopment: process.env.NODE_ENV === 'development',
  });

  if (!admission.ok) {
    return NextResponse.json(
      { error: admission.message, ...admission.detail },
      {
        status: admission.status,
        ...(admission.retryAfterSeconds !== undefined
          ? { headers: { 'Retry-After': String(admission.retryAfterSeconds) } }
          : {}),
      },
    );
  }

  const job = await createGenerationJob(parsed.data, admission.user.id);

  // Keep working after the response is sent. If this outgrows the platform's
  // execution window, the job row means the worker can move without the client
  // changing at all.
  after(async () => {
    await runGenerationJob(job, parsed.data);
  });

  return NextResponse.json({ tripId: job.tripId, jobId: job.jobId }, { status: 202 });
}
