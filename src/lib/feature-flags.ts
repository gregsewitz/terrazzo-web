/**
 * Simple environment-based feature flags.
 *
 * Every flag defaults to false unless the env var is set to "true" or "1".
 * This lets us ship code behind flags and toggle without a deploy
 * (via Vercel env vars or .env.local overrides).
 *
 * Usage:
 *   import { flags } from '@/lib/feature-flags';
 *   if (flags.RAG_DISCOVER) { ... }
 */

function isEnabled(envVar: string): boolean {
  const val = process.env[envVar];
  return val === 'true' || val === '1';
}

export const flags = {
  /** Use RAG-powered discover feed instead of legacy LLM-only flow */
  RAG_DISCOVER: isEnabled('FF_RAG_DISCOVER'),

  /** Enable collaborative filtering recommendations */
  COLLABORATIVE_FILTERING: isEnabled('FF_COLLABORATIVE_FILTERING'),

  /** Enable email-based property reactions in onboarding */
  EMAIL_PROPERTY_REACTIONS: isEnabled('FF_EMAIL_PROPERTY_REACTIONS'),
} as const;

export type FeatureFlag = keyof typeof flags;
