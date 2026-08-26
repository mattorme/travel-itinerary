/**
 * Token tariffs, USD per million tokens.
 *
 * These drive the cost ledger and the daily spend ceiling, not a bill. They are
 * configuration, not truth: check platform.openai.com/pricing when adding a
 * model, and treat an unknown model as free rather than crashing a generation.
 */
export interface Tariff {
  readonly inputPerMillion: number;
  readonly cachedInputPerMillion: number;
  readonly outputPerMillion: number;
}

const TARIFFS: Record<string, Tariff> = {
  'gpt-5': { inputPerMillion: 1.25, cachedInputPerMillion: 0.125, outputPerMillion: 10 },
  'gpt-5-mini': { inputPerMillion: 0.25, cachedInputPerMillion: 0.025, outputPerMillion: 2 },
  'gpt-5-nano': { inputPerMillion: 0.05, cachedInputPerMillion: 0.005, outputPerMillion: 0.4 },
};

function tariffFor(model: string): Tariff | null {
  if (TARIFFS[model]) return TARIFFS[model];
  // Dated snapshots ("gpt-5-mini-2026-01-01") should price as their base model.
  const base = Object.keys(TARIFFS).find((key) => model.startsWith(key));
  return base ? (TARIFFS[base] ?? null) : null;
}

export function computeCostUsd(
  model: string,
  tokens: { input: number; cached: number; output: number },
): number {
  const tariff = tariffFor(model);
  if (!tariff) return 0;
  const uncachedInput = Math.max(0, tokens.input - tokens.cached);
  return (
    (uncachedInput * tariff.inputPerMillion +
      tokens.cached * tariff.cachedInputPerMillion +
      tokens.output * tariff.outputPerMillion) /
    1_000_000
  );
}
