/**
 * Environment variable validation.
 *
 * Import this module early (e.g., in layout.tsx or instrumentation.ts)
 * to fail fast on missing required variables instead of discovering
 * the problem when the first API route hits.
 *
 * NEXT_PUBLIC_* vars are validated separately since they're
 * inlined at build time and always available client-side.
 */

function required(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Add it to .env.local or your deployment environment.`
    );
  }
  return val;
}

function optional(name: string, fallback?: string): string | undefined {
  return process.env[name] || fallback;
}

// ── Server-side (validated on first import) ──────────────────────────

/** Core infrastructure */
export const DATABASE_URL = required('DATABASE_URL');

/** Auth */
export const ADMIN_SECRET = required('ADMIN_SECRET');
export const CRON_SECRET = required('CRON_SECRET');

/** AI providers */
export const ANTHROPIC_API_KEY = required('ANTHROPIC_API_KEY');
export const OPENAI_API_KEY = required('OPENAI_API_KEY');

/** External services */
export const GOOGLE_PLACES_API_KEY = required('GOOGLE_PLACES_API_KEY');
export const ELEVENLABS_API_KEY = required('ELEVENLABS_API_KEY');

/** Optional services (graceful degradation if missing) */
export const NYLAS_API_KEY = optional('NYLAS_API_KEY');
export const NYLAS_CLIENT_ID = optional('NYLAS_CLIENT_ID');
export const NYLAS_REDIRECT_URI = optional('NYLAS_REDIRECT_URI');
export const NYLAS_WEBHOOK_SECRET = optional('NYLAS_WEBHOOK_SECRET');
export const FIRECRAWL_API_KEY = optional('FIRECRAWL_API_KEY');
export const PIPELINE_WORKER_URL = optional('PIPELINE_WORKER_URL');
export const PIPELINE_WEBHOOK_SECRET = optional('PIPELINE_WEBHOOK_SECRET');
export const UPSTASH_REDIS_REST_URL = optional('UPSTASH_REDIS_REST_URL');
export const UPSTASH_REDIS_REST_TOKEN = optional('UPSTASH_REDIS_REST_TOKEN');

// ── Client-side (NEXT_PUBLIC_*) ──────────────────────────────────────

export const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
