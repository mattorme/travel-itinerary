import { after, NextResponse, type NextRequest } from 'next/server';
import { tripRequestSchema } from '@/domain/schemas/trip-request';
import { getOrCreateSessionUser } from '@/lib/auth/session';
import { canGenerate } from '@/lib/entitlements';
import { checkLimit } from '@/lib/ratelimit';
import { createGenerationJob, runGenerationJob } from '@/lib/itinerary/jobs';
import { clientIp } from '@/lib/utils/request';
import { verifyTurnstile } from '@/lib/auth/turnstile';
import { generationProvidersReady } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Starts a generation and returns immediately.
 *
 * The work continues in `after()` while the client watches the job row over
 * Realtime. Nothing here waits for the pipeline — see docs/ARCHITECTURE.md §7.
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

  // Fail before creating a job: a placeholder key should read as "not
  // configured", not as a trip that mysteriously failed to build.
  const providers = generationProvidersReady();
  if (!providers.ready) {
    console.error('[generate] providers not configured:', providers.missing.join(', '));
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === 'development'
            ? `Generation is not configured. Set ${providers.missing.join(' and ')} in .env.local.`
            : 'Trip generation is temporarily unavailable.',
        missing: process.env.NODE_ENV === 'development' ? providers.missing : undefined,
      },
      { status: 503 },
    );
  }

  const ip = clientIp(request);

  const byIp = await checkLimit('generateByIp', ip);
  if (!byIp.allowed) {
    return NextResponse.json(
      { error: 'You have started a lot of trips recently. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(byIp.retryAfterSeconds) } },
    );
  }

  // An anonymous session is created here if there isn't one, which is what makes
  // "generate before you sign up" work while keeping RLS uniform. If the auth
  // provider refuses, the traveller gets a sentence they can act on rather than
  // a 500 — the whole point of typed failures is that they never leak.
  let user;
  try {
    user = await getOrCreateSessionUser();
  } catch (error) {
    console.error('[generate] could not establish a session', error);
    return NextResponse.json(
      { error: 'We could not start a session for you. Try signing in.' },
      { status: 503 },
    );
  }

  // Anonymous callers are the ones worth challenging: a registered account is
  // already rate-limited by identity and costs something to create.
  if (user.isAnonymous) {
    const ok = await verifyTurnstile(
      typeof payload.turnstileToken === 'string' ? payload.turnstileToken : null,
      ip,
    );
    if (!ok) {
      return NextResponse.json({ error: 'We could not verify that request.' }, { status: 403 });
    }
  }

  const byUser = await checkLimit('generateByUser', user.id);
  if (!byUser.allowed) {
    return NextResponse.json(
      { error: 'You have hit the limit for now. Try again in a little while.' },
      { status: 429, headers: { 'Retry-After': String(byUser.retryAfterSeconds) } },
    );
  }

  const entitlement = await canGenerate(user);
  if (!entitlement.allowed) {
    return NextResponse.json(
      { error: denialMessage(entitlement.denial), denial: entitlement.denial },
      { status: 402 },
    );
  }

  const job = await createGenerationJob(parsed.data, user.id);

  // Keep working after the response is sent. If this outgrows the platform's
  // execution window, the job row means the worker can move without the client
  // changing at all.
  after(async () => {
    await runGenerationJob(job, parsed.data);
  });

  return NextResponse.json({ tripId: job.tripId, jobId: job.jobId }, { status: 202 });
}

function denialMessage(denial: { reason: string } | undefined): string {
  switch (denial?.reason) {
    case 'quota':
      return 'You have used your trips for today. Sign up for more, or come back tomorrow.';
    case 'capacity':
      return 'We are at capacity right now. Please try again a bit later.';
    default:
      return 'We cannot start another trip right now.';
  }
}
