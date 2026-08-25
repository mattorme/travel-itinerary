import { z } from 'zod';

/**
 * The only values that may reach the browser bundle. Next.js inlines `NEXT_PUBLIC_*`
 * at build time, so these must be referenced statically (not via a dynamic key).
 */
const publicSchema = z.object({
  supabaseUrl: z.string().url(),
  supabaseAnonKey: z.string().min(1),
  siteUrl: z.string().url(),
  mapsBrowserKey: z.string().optional(),
  mapsMapId: z.string().optional(),
  turnstileSiteKey: z.string().optional(),
});

export const publicEnv = publicSchema.parse({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  mapsBrowserKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY || undefined,
  mapsMapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || undefined,
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined,
});
