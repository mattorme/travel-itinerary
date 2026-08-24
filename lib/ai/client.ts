import 'server-only';

/**
 * The LLM boundary.
 *
 * Call sites ask for a `tier`, never a model name, so switching models is one
 * config change rather than a grep. Deliberately small: a thin interface, not a
 * provider plugin system — the abstraction we need is "swap the model", not
 * "support an ecosystem".
 */

export type ModelTier = 'fast' | 'strong';

export interface Usage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedTokens: number;
  readonly reasoningTokens: number;
  readonly costUsd: number;
  readonly latencyMs: number;
  readonly model: string;
}

export interface StructuredRequest<T> {
  /** A strict-mode-compatible JSON Schema. See lib/ai/wire for the constraints. */
  readonly schema: JsonSchema;
  readonly schemaName: string;
  readonly parse: (raw: unknown) => T;
  readonly system: string;
  readonly input: string;
  readonly tier: ModelTier;
  readonly stage: string;
  readonly maxOutputTokens?: number;
}

export interface StructuredResult<T> {
  readonly value: T;
  readonly usage: Usage;
}

export interface LlmClient {
  generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>>;
}

export interface JsonSchema {
  readonly type: 'object';
  readonly properties: Record<string, unknown>;
  readonly required: readonly string[];
  readonly additionalProperties: false;
}

export class LlmError extends Error {
  override name = 'LlmError';
  readonly stage: string;
  readonly retryable: boolean;

  constructor(message: string, stage: string, retryable: boolean, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.stage = stage;
    this.retryable = retryable;
  }
}
