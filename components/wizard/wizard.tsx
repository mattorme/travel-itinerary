'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import {
  BudgetStep,
  DatesStep,
  DestinationStep,
  InterestsStep,
  NotesStep,
  StyleStep,
  TravellersStep,
} from './steps';
import {
  canAdvance,
  INITIAL_STATE,
  STEPS,
  STEP_TITLES,
  toTripRequest,
  type Step,
  type WizardState,
} from './state';
import { Turnstile } from '@/components/turnstile';
import { startGeneration } from '@/lib/api/client';

export function Wizard({ initialQuery }: { initialQuery: string | null }) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<WizardState>(() => ({
    ...INITIAL_STATE,
    destinationQuery: initialQuery ?? '',
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const step = STEPS[stepIndex] as Step;
  const isLast = stepIndex === STEPS.length - 1;
  const patch = useCallback(
    (update: Partial<WizardState>) => setState((prev) => ({ ...prev, ...update })),
    [],
  );

  const ready = useMemo(() => canAdvance(step, state), [step, state]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const result = await startGeneration(toTripRequest(state), turnstileToken);
    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    router.push(`/trips/${result.data.tripId}`);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-5 pb-32">
      {/* Progress. A bar rather than "Step 3 of 7" — the count is discouraging
          before you have started, and the bar tells you the same thing. */}
      <div className="sticky top-0 z-10 -mx-5 bg-paper/90 px-5 pt-6 pb-4 backdrop-blur-md">
        <div
          className="flex gap-1.5"
          role="progressbar"
          aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}
          aria-valuenow={stepIndex + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
        >
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                i <= stepIndex ? 'bg-ink' : 'bg-rule',
              )}
            />
          ))}
        </div>
      </div>

      {/* Question and answer stay together, and the pair sits in the middle of
          the screen — a short step pinned to the top of a tall viewport reads
          as a page that failed to load the rest of itself. */}
      <div className="flex flex-1 flex-col justify-center py-8">
        <h1 className="type-display type-title mb-8 text-balance">{STEP_TITLES[step]}</h1>
        {step === 'destination' && <DestinationStep state={state} patch={patch} />}
        {step === 'dates' && <DatesStep state={state} patch={patch} />}
        {step === 'travellers' && <TravellersStep state={state} patch={patch} />}
        {step === 'budget' && <BudgetStep state={state} patch={patch} />}
        {step === 'style' && <StyleStep state={state} patch={patch} />}
        {step === 'interests' && <InterestsStep state={state} patch={patch} />}
        {step === 'notes' && <NotesStep state={state} patch={patch} />}
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-edge border border-critical/30 bg-critical/5 px-4 py-3 text-sm text-critical">
          {error}
        </p>
      )}

      {isLast && <Turnstile onToken={setTurnstileToken} />}

      {/* Fixed footer: on a phone the primary action must be reachable with a
          thumb without scrolling to the bottom of a long step. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-rule bg-paper/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {stepIndex > 0 && (
            <Button variant="ghost" size="lg" onClick={() => setStepIndex((i) => i - 1)} aria-label="Back">
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <Button
            variant="signal"
            size="lg"
            block
            disabled={!ready || submitting}
            onClick={() => (isLast ? submit() : setStepIndex((i) => i + 1))}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Starting…
              </>
            ) : isLast ? (
              'Build my itinerary'
            ) : (
              <>
                Continue
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
