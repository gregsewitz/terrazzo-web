/**
 * Match tier system.
 *
 * Replaces percentage-based match scores with qualitative tiers.
 * The underlying numeric score (0-100) is still computed and stored
 * in the DB for sorting, normalization, and internal use — this module
 * provides the human-facing label layer.
 *
 * Tier boundaries are based on the normalized display range (35-96):
 *   Strong match  ≥ 78   (top ~15% — genuinely distinctive alignment)
 *   Good match    ≥ 65   (solid fit across multiple domains)
 *   Worth a look  ≥ 50   (partial overlap, some signals resonate)
 *   Mixed fit     ≥ 40   (weak overlap or contradictory signals)
 *   Not for you   < 40   (anti-signals dominate or near-zero overlap)
 */

export type MatchTierKey = 'strong' | 'good' | 'worth_a_look' | 'mixed' | 'not_for_you';

export interface MatchTier {
  key: MatchTierKey;
  label: string;
  /** Short label for tight UI (day board badges, rail pips) */
  shortLabel: string;
  /** CSS color for the tier label text */
  color: string;
  /** Light background tint for badges */
  bg: string;
}

const TIERS: readonly MatchTier[] = [
  { key: 'strong',       label: 'Strong match',  shortLabel: 'Strong',  color: 'var(--t-dark-teal)', bg: 'rgba(58,128,136,0.10)' },
  { key: 'good',         label: 'Good match',    shortLabel: 'Good',    color: '#6b7a3a',            bg: 'rgba(107,122,58,0.10)' },
  { key: 'worth_a_look', label: 'Worth a look',  shortLabel: 'Worth a look', color: '#8a6a2a',       bg: 'rgba(138,106,42,0.10)' },
  { key: 'mixed',        label: 'Mixed fit',     shortLabel: 'Mixed',   color: 'var(--t-navy-60)',   bg: 'rgba(0,42,85,0.06)' },
  { key: 'not_for_you',  label: 'Not for you',   shortLabel: 'Not for you',  color: 'var(--t-navy-40)',   bg: 'rgba(0,42,85,0.04)' },
] as const;

/** Score thresholds — index-aligned with TIERS (first tier whose min is satisfied wins) */
const THRESHOLDS: readonly number[] = [78, 65, 50, 40, 0];

/**
 * Convert a numeric match score (0-100, already normalized for display)
 * into a qualitative tier with label, color, and background.
 */
export function getMatchTier(score: number | null | undefined): MatchTier {
  if (score == null) return TIERS[3]; // default to 'mixed' when no score
  for (let i = 0; i < THRESHOLDS.length; i++) {
    if (score >= THRESHOLDS[i]) return TIERS[i];
  }
  return TIERS[TIERS.length - 1];
}

/**
 * Whether a score is high enough to warrant showing a tier badge.
 * Used in compact UI (day board, rail) where we only show positive tiers.
 */
export function shouldShowTierBadge(score: number | null | undefined): boolean {
  if (score == null) return false;
  return score >= 50; // 'worth a look' or above
}

/**
 * Whether a score represents a strong enough match to feature prominently.
 * Used for pip indicators, sorting highlights, etc.
 */
export function isStrongMatch(score: number | null | undefined): boolean {
  if (score == null) return false;
  return score >= 78;
}
