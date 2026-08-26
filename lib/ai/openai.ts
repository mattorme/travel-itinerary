import 'server-only';
import OpenAI from 'openai';
import { serverEnv } from '@/lib/env';
import { computeCostUsd } from './pricing';
import { sleep } from '@/lib/utils/async';
import { LlmError, type LlmClient, type StructuredRequest, type StructuredResult } from './client';

/**
 * OpenAI implementation of the LLM boundary, using the Responses API with
 * Structured Outputs.
 *
 * Note the shape: structured output lives under `text.format` in Responses,
 * not `response_format` as in Chat Completions. `strict: true` is what makes
 * the schema a guarantee rather than a suggestion.
 */

let client: OpenAI | null = null;

function openai(): OpenAI {
  client ??= new OpenAI({ apiKey: serverEnv().OPENAI_API_KEY, maxRetries: 0 });
  return client;
}

const MAX_ATTEMPTS = 3;

export function createOpenAiClient(): LlmClient {
  return {
    async generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
      const env = serverEnv();
      const model = request.tier === 'strong' ? env.OPENAI_MODEL_STRONG : env.OPENAI_MODEL_FAST;

      let lastError: unknown;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const startedAt = Date.now();
        try {
          const response = await openai().responses.create({
            model,
            instructions: request.system,
            input: request.input,
            max_output_tokens: request.maxOutputTokens ?? 8000,
            text: {
              format: {
                type: 'json_schema',
                name: request.schemaName,
                strict: true,
                schema: request.schema as unknown as Record<string, unknown>,
              },
            },
          });

          if (response.status === 'incomplete') {
            throw new LlmError(
              `Model stopped early (${response.incomplete_details?.reason ?? 'unknown'}) at stage ${request.stage}`,
              request.stage,
              true,
            );
          }

          const text = response.output_text;
          if (!text) {
            throw new LlmError(`Empty response at stage ${request.stage}`, request.stage, true);
          }

          const value = request.parse(JSON.parse(text));
          const usage = response.usage;

          const inputTokens = usage?.input_tokens ?? 0;
          const outputTokens = usage?.output_tokens ?? 0;
          const cachedTokens = usage?.input_tokens_details?.cached_tokens ?? 0;
          const reasoningTokens = usage?.output_tokens_details?.reasoning_tokens ?? 0;

          return {
            value,
            usage: {
              model,
              inputTokens,
              outputTokens,
              cachedTokens,
              reasoningTokens,
              latencyMs: Date.now() - startedAt,
              costUsd: computeCostUsd(model, {
                input: inputTokens,
                cached: cachedTokens,
                output: outputTokens,
              }),
            },
          };
        } catch (cause) {
          lastError = cause;
          const retryable = isRetryable(cause);
          if (!retryable || attempt === MAX_ATTEMPTS) {
            throw cause instanceof LlmError
              ? cause
              : new LlmError(
                  `LLM call failed at stage ${request.stage}`,
                  request.stage,
                  retryable,
                  cause,
                );
          }
          await sleep(Math.random() * Math.min(4000, 400 * 2 ** (attempt - 1)));
        }
      }

      throw lastError instanceof Error
        ? lastError
        : new LlmError('exhausted retries', request.stage, false);
    },
  };
}

function isRetryable(error: unknown): boolean {
  if (error instanceof LlmError) return error.retryable;
  if (error instanceof OpenAI.APIError) {
    return error.status === 429 || error.status === undefined || error.status >= 500;
  }
  // A schema-validation failure on our side is deterministic — retrying the same
  // prompt will fail the same way.
  return false;
}

