/**
 * Centralized AI model configuration.
 *
 * All Claude and OpenAI model strings should be imported from here
 * so they can be updated in one place when models are deprecated.
 *
 * Supports env override via ANTHROPIC_MODEL for testing/staging.
 */

/** Default Claude model for all conversational + extraction tasks */
export const CLAUDE_SONNET = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

/** Claude Opus for high-fidelity tasks (currently unused, reserved) */
export const CLAUDE_OPUS = 'claude-opus-4-1-20250805';

/** OpenAI embedding model for signal clustering */
export const OPENAI_EMBEDDING = 'text-embedding-3-small';
