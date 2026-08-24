import 'server-only';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { serverEnv } from '@/lib/env';

/**
 * Rate limiting lives in Redis, not Postgres: a limiter that takes a database
 * write per request is a limiter that falls over exactly when you need it.
 *
 * With no Redis configured (local dev) this degrades to an in-process limiter —
 * useless across instances, but it keeps the code path identical so limits are
 * exercised in development rather than discovered in production.
 */

type Limiter = { limit: (key: string) => Promise<{ success: boolean; reset: number; remaining: number }> };

const memory = new Map<string, { count: number; resetAt: number }>();

function inMemoryLimiter(max: number, windowMs: number): Limiter {
  return {
    async limit(key: string) {
      const now = Date.now();
      const entry = memory.get(key);
      if (!entry || entry.resetAt < now) {
        memory.set(key, { count: 1, resetAt: now + windowMs });
        return { success: true, reset: now + windowMs, remaining: max - 1 };
      }
      entry.count += 1;
      return {
        success: entry.count <= max,
        reset: entry.resetAt,
        remaining: Math.max(0, max - entry.count),
      };
    },
  };
}

let redis: Redis | null = null;
function getRedis(): Redis | null {
  const env = serverEnv();
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return null;
  redis ??= new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  return redis;
}

function build(name: string, max: number, window: `${number} ${'s' | 'm' | 'h' | 'd'}`, windowMs: number): Limiter {
  const client = getRedis();
  if (!client) return inMemoryLimiter(max, windowMs);
  return new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(max, window),
    prefix: `rl:${name}`,
    analytics: false,
  });
}

let limiters: Record<string, Limiter> | null = null;

function all(): Record<string, Limiter> {
  limiters ??= {
    // Generation is the expensive one. Layered: per identity and per IP, because
    // an attacker controls how many anonymous identities they create but not how
    // many addresses they have.
    generateByUser: build('gen:user', 5, '1 h', 3_600_000),
    generateByIp: build('gen:ip', 12, '1 h', 3_600_000),
    // Autocomplete is cheap but billable and runs on every keystroke.
    autocomplete: build('autocomplete', 60, '1 m', 60_000),
    clone: build('clone', 20, '1 h', 3_600_000),
    mutation: build('mutation', 120, '1 m', 60_000),
  };
  return limiters;
}

export type LimiterName = 'generateByUser' | 'generateByIp' | 'autocomplete' | 'clone' | 'mutation';

export interface LimitResult {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

export async function checkLimit(name: LimiterName, key: string): Promise<LimitResult> {
  const limiter = all()[name];
  if (!limiter) return { allowed: true, retryAfterSeconds: 0 };
  const result = await limiter.limit(key);
  return {
    allowed: result.success,
    retryAfterSeconds: Math.max(0, Math.ceil((result.reset - Date.now()) / 1000)),
  };
}
