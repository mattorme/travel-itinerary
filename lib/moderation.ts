import 'server-only';
import OpenAI from 'openai';
import { serverEnv } from '@/lib/env';

/**
 * Moderation for user-authored text that lands on a public, indexable page.
 *
 * Three outcomes rather than two: `allow` publishes, `review` publishes but
 * flags for a human, `block` refuses. A binary classifier on a consumer product
 * is either too strict (people cannot talk about a red-light district in
 * Amsterdam) or too loose.
 *
 * Fails to `review` rather than `allow` or `block`: an outage should neither
 * silence people nor open the floodgates.
 */

export type ModerationAction = 'allow' | 'review' | 'block';

export interface ModerationVerdict {
  readonly action: ModerationAction;
  readonly categories: readonly string[];
}

/** Categories where a false negative is genuinely harmful. */
const HARD_BLOCK = new Set([
  'sexual/minors',
  'violence/graphic',
  'hate/threatening',
  'harassment/threatening',
  'self-harm/instructions',
  'self-harm/intent',
]);

let client: OpenAI | null = null;

export async function moderateText(text: string): Promise<ModerationVerdict> {
  const key = serverEnv().OPENAI_API_KEY;
  if (!key || text.trim().length === 0) {
    return { action: 'review', categories: [] };
  }

  try {
    client ??= new OpenAI({ apiKey: key, maxRetries: 1 });
    const result = await client.moderations.create({
      model: 'omni-moderation-latest',
      input: text,
    });

    const first = result.results[0];
    if (!first) return { action: 'review', categories: [] };

    const flagged = Object.entries(first.categories)
      .filter(([, value]) => value === true)
      .map(([name]) => name);

    if (flagged.some((c) => HARD_BLOCK.has(c))) {
      return { action: 'block', categories: flagged };
    }
    if (flagged.length > 0) {
      return { action: 'review', categories: flagged };
    }
    return { action: 'allow', categories: [] };
  } catch (error) {
    console.warn('[moderation] check failed, holding for review', error);
    return { action: 'review', categories: [] };
  }
}
