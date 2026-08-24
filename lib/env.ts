import 'server-only';
import { z } from 'zod';

/**
 * Server environment. Validated once at module load so a missing key fails at boot
 * rather than inside a route handler at 2am.
 *
 * Never import this from a client component — `server-only` will fail the build.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL_FAST: z.string().default('gpt-5-mini'),
  OPENAI_MODEL_STRONG: z.string().default('gpt-5'),

  GOOGLE_MAPS_SERVER_KEY: z.string().min(1),

  UPSTASH_REDIS_REST_URL: z.string().url().optional().or(z.literal('')),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional().or(z.literal('')),
  TURNSTILE_SECRET_KEY: z.string().optional().or(z.literal('')),

  DAILY_SPEND_CEILING_USD: z.coerce.number().positive().default(25),
  GENERATION_QUOTA_ANON: z.coerce.number().int().nonnegative().default(1),
  GENERATION_QUOTA_FREE: z.coerce.number().int().nonnegative().default(3),
  GENERATION_QUOTA_PRO: z.coerce.number().int().nonnegative().default(50),

  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
  CRON_SECRET: z.string().optional().or(z.literal('')),
});

export type ServerEnv = z.infer<typeof serverSchema>;

function loadServerEnv(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid server environment:\n${detail}\n\nCopy .env.example to .env.local.`);
  }
  return parsed.data;
}

let cached: ServerEnv | null = null;

/** Lazy so that importing a module that references env does not explode at import time in tests. */
export function serverEnv(): ServerEnv {
  cached ??= loadServerEnv();
  return cached;
}
