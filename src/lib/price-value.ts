/**
 * Price–Value Intelligence
 *
 * Computes a contextual "value index" that relates a place's match tier
 * to its price level. This isn't about finding cheap places — it's about
 * surfacing places where the taste alignment *justifies* (or exceeds) the cost.
 *
 * Uses the match tier system (Strong, Good, Worth a look, Mixed, Not for you)
 * rather than raw numeric scores.
 *
 * Price levels (from Google):
 *   0 = Free
 *   1 = Inexpensive     → normalized 0.25
 *   2 = Moderate         → normalized 0.50
 *   3 = Expensive        → normalized 0.75
 *   4 = Very Expensive   → normalized 1.00
 *
 * A high-match, expensive place still scores well — it's "worth it."
 * A low-match, expensive place surfaces a "consider alternatives" nudge.
 */

import { getMatchTier, type MatchTierKey } from '@/lib/match-tier';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ValueAssessment {
  /** Value index (retained for internal ranking) */
  valueIndex: number;
  /** Human-readable framing */
  label: string;
  /** Contextual explanation */
  explanation: string;
  /** Sentiment: positive | neutral | cautious */
  sentiment: 'positive' | 'neutral' | 'cautious';
  /** The price level used */
  priceLevel: number;
  /** The match score used */
  matchScore: number;
}

// ─── Normalization ──────────────────────────────────────────────────────────────

const PRICE_NORMALIZATION: Record<number, number> = {
  0: 0.10,  // Free → minimal denominator
  1: 0.25,
  2: 0.50,
  3: 0.75,
  4: 1.00,
};

const PRICE_LABELS: Record<number, string> = {
  0: 'Free',
  1: '$',
  2: '$$',
  3: '$$$',
  4: '$$$$',
};

// ─── Tier-based value weights ───────────────────────────────────────────────────

/** Approximate weight for value index calculation per tier */
const TIER_VALUE_WEIGHT: Record<MatchTierKey, number> = {
  strong: 0.90,
  good: 0.72,
  worth_a_look: 0.55,
  mixed: 0.40,
  not_for_you: 0.20,
};

// ─── Compute ────────────────────────────────────────────────────────────────────

/**
 * Compute the value assessment for a place.
 *
 * @param matchScore - User's raw match score (used for tier classification via getMatchTier)
 * @param priceLevel - Google price level (0-4)
 * @returns ValueAssessment or null if data is insufficient
 */
export function computeValueAssessment(
  matchScore: number | null | undefined,
  priceLevel: number | null | undefined,
): ValueAssessment | null {
  if (matchScore == null || priceLevel == null) return null;
  if (priceLevel < 0 || priceLevel > 4) return null;

  const tier = getMatchTier(matchScore);
  const normalizedPrice = PRICE_NORMALIZATION[priceLevel] ?? 0.50;
  const tierWeight = TIER_VALUE_WEIGHT[tier.key];
  const valueIndex = Math.round(tierWeight / normalizedPrice * 100);

  // Determine sentiment and label based on tier + price
  let label: string;
  let explanation: string;
  let sentiment: ValueAssessment['sentiment'];

  const isHighTier = tier.key === 'strong' || tier.key === 'good';
  const isLowTier = tier.key === 'mixed' || tier.key === 'not_for_you';

  if (isHighTier && priceLevel >= 3) {
    // Strong/Good match, high price — "worth the splurge"
    sentiment = 'positive';
    label = 'Worth every penny';
    explanation = `A ${tier.label.toLowerCase()} makes ${PRICE_LABELS[priceLevel]} pricing feel right`;
  } else if (isHighTier && priceLevel <= 2) {
    // Strong/Good match, low/moderate price — "exceptional value"
    sentiment = 'positive';
    label = 'Exceptional value';
    explanation = `${tier.label} at ${PRICE_LABELS[priceLevel]} — a standout find`;
  } else if (tier.key === 'worth_a_look' && priceLevel <= 1) {
    // Worth a look, inexpensive — "solid pick"
    sentiment = 'positive';
    label = 'Great find';
    explanation = `Worth a look at a great price`;
  } else if (isLowTier && priceLevel >= 3) {
    // Low match, expensive — "think twice"
    sentiment = 'cautious';
    label = 'Consider carefully';
    explanation = `${PRICE_LABELS[priceLevel]} pricing with a ${tier.label.toLowerCase()} — make sure it's what you want`;
  } else if (tier.key === 'worth_a_look') {
    // Worth a look, moderate price — neutral
    sentiment = 'neutral';
    label = 'Fair value';
    explanation = `Worth a look at ${PRICE_LABELS[priceLevel]}`;
  } else {
    // Low match, any price — neutral
    sentiment = 'neutral';
    label = `${PRICE_LABELS[priceLevel] || 'Priced'}`;
    explanation = `${tier.label}`;
  }

  return {
    valueIndex,
    label,
    explanation,
    sentiment,
    priceLevel,
    matchScore,
  };
}

/**
 * Get the price label string for display.
 */
export function getPriceLabel(priceLevel: number | null | undefined): string | null {
  if (priceLevel == null || priceLevel < 0 || priceLevel > 4) return null;
  return PRICE_LABELS[priceLevel] ?? null;
}
