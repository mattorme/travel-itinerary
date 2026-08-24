import 'server-only';
import { createAdminClient } from '@/lib/db/supabase/admin';
import type { LlmClient, StructuredRequest, StructuredResult } from './client';

/**
 * Wraps an LlmClient so that every call — successful or not — lands in
 * `ai_generations`. Instrumentation as a decorator rather than inside the
 * provider keeps the provider swappable without losing the ledger.
 */
export function withLedger(
  inner: LlmClient,
  context: { tripId: string | null; jobId: string | null },
): LlmClient {
  return {
    async generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
      const startedAt = Date.now();
      try {
        const result = await inner.generateStructured(request);
        void record(context, request.stage, result.usage.model, {
          input: result.usage.inputTokens,
          output: result.usage.outputTokens,
          cached: result.usage.cachedTokens,
          reasoning: result.usage.reasoningTokens,
          cost: result.usage.costUsd,
          latency: result.usage.latencyMs,
          ok: true,
          errorCode: null,
        });
        return result;
      } catch (error) {
        void record(context, request.stage, 'unknown', {
          input: 0, output: 0, cached: 0, reasoning: 0, cost: 0,
          latency: Date.now() - startedAt,
          ok: false,
          errorCode: error instanceof Error ? error.name : 'unknown',
        });
        throw error;
      }
    },
  };
}

async function record(
  context: { tripId: string | null; jobId: string | null },
  stage: string,
  model: string,
  m: {
    input: number; output: number; cached: number; reasoning: number;
    cost: number; latency: number; ok: boolean; errorCode: string | null;
  },
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('ai_generations').insert({
    job_id: context.jobId,
    trip_id: context.tripId,
    stage,
    provider: 'openai',
    model,
    input_tokens: m.input,
    output_tokens: m.output,
    cached_tokens: m.cached,
    reasoning_tokens: m.reasoning,
    cost_usd: m.cost,
    latency_ms: m.latency,
    ok: m.ok,
    error_code: m.errorCode,
  });
  if (error) console.error('[ledger] failed to record generation', error.message);
}
