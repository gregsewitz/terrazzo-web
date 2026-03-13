/**
 * Price–Value Intelligence
 *
 * Computes a contextual "value index" that relates a place's match score
 * to its price level. This isn't about finding cheap places — it's about
 * surfacing places where the taste alignment *justifies* (or exceeds) the cost.
 *
 * Value Index = matchScore / normalizedPrice
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

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ValueAssessment {
  /** Value index 0-200+ (100 = average value for price point) */
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

// ─── Compute ────────────────────────────────────────────────────────────────────

/**
 * Compute the value assessment for a place.
 *
 * @param matchScore - User's match score (0-100 range, typically 35-93 after normalization)
 * @param priceLevel - Google price level (0-4)
 * @returns ValueAssessment or null if data is insufficient
 */
export function computeValueAssessment(
  matchScore: number | null | undefined,
  priceLevel: number | null | undefined,
): ValueAssessment | null {
  if (matchScore == null || priceLevel == null) return null;
  if (priceLevel < 0 || priceLevel > 4) return null;

  const normalizedPrice = PRICE_NORMALIZATION[priceLevel] ?? 0.50;
  const valueIndex = Math.round((matchScore / 100) / normalizedPrice * 100);

  // Determine sentiment and label
  let label: string;
  let explanation: string;
  let sentiment: ValueAssessment['sentiment'];

  if (matchScore >= 75 && priceLevel >= 3) {
    // High match, high price — "worth the splurge"
    sentiment = 'positive';
    label = 'Worth every penny';
    explanation = `Your ${matchScore}% taste match makes ${PRICE_LABELS[priceLevel]} pricing feel right`;
  } else if (matchScore >= 70 && priceLevel <= 2) {
    // High match, low/moderate price — "exceptional value"
    sentiment = 'positive';
    label = 'Exceptional value';
    explanation = `Strong ${matchScore}% match at ${PRICE_LABELS[priceLevel]} — a standout find`;
  } else if (matchScore >= 55 && priceLevel <= 1) {
    // Decent match, inexpensive — "solid pick"
    sentiment = 'positive';
    label = 'Great find';
    explanation = `Good match at a great price`;
  } else if (matchScore < 50 && priceLevel >= 3) {
    // Low match, expensive — "think twice"
    sentiment = 'cautious';
    label = 'Consider carefully';
    explanation = `${PRICE_LABELS[priceLevel]} pricing with a ${matchScore}% match — make sure it's what you want`;
  } else if (matchScore >= 60) {
    // Moderate match, moderate price — neutral
    sentiment = 'neutral';
    label = 'Fair value';
    explanation = `Solid ${matchScore}% match at ${PRICE_LABELS[priceLevel]}`;
  } else {
    // Low match, any price — neutral
    sentiment = 'neutral';
    label = `${PRICE_LABELS[priceLevel] || 'Priced'}`;
    explanation = `${matchScore}% match`;
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
