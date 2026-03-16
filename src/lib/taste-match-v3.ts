/**
 * @deprecated LEGACY FALLBACK — v4 architecture uses vector cosine similarity
 * (taste-match-vectors.ts) as the sole scoring/ranking mechanism. Domain weighting
 * was removed from vector computation in v3.6.
 *
 * This signal-based pipeline is only called when:
 *   1. A user or property lacks V3 vectors (rare edge case during enrichment)
 *   2. Domain breakdown display in discover-candidates.ts (to be replaced by
 *      vector-derived breakdown — see computeVectorMatch in taste-match-vectors.ts)
 *   3. Admin taste dashboard for v1-vs-v3 comparison
 *
 * DO NOT add new callers. Use taste-match-vectors.ts for all new scoring code.
 *
 * Taste Match v3.2 — Signal-density weighted profiles for real cross-archetype discrimination.
 *
 * v3.1 introduced profile alignment but synthetic testing with 5 archetypes
 * revealed it couldn't differentiate because LLM-generated radar profiles are
 * nearly flat (cosine similarity 0.95-0.99 between all pairs). Character=1.0
 * for ALL archetypes, Service=0.95-1.0 for all. The alignment transform
 * `0.30 + 0.70 * w` barely differentiates when most weights are 0.8-1.0.
 *
 * v3.2.1 changes:
 * 1. Absent-domain skip: Domains with zero signals are excluded from the
 *    geometric mean entirely instead of contributing a 10% penalty. "No data"
 *    ≠ "bad" — a store with no Atmosphere signals scores on its merits.
 * 2. Signal distribution guard: When userSignalDistribution is empty (micro
 *    signal keys don't map to domain names), falls back to raw radar weights
 *    instead of crushing every domain to 30%. Fixes FoodDrink/Sustainability
 *    being zeroed out for all places.
 *
 * v3.2 changes:
 * 1. Signal-density weighted profile enhancement (new Step 0): When user's
 *    allSignals distribution is provided, modulate flat radar weights:
 *    enhancedWeight = radarWeight × (0.3 + 0.7 × signalShare)
 *    This drops inter-archetype cosine similarity from 0.95-0.99 to 0.77-0.98.
 * 2. Sharper alignment transform: w² instead of 0.30+0.70*w. With enhanced
 *    weights ranging 0.3-1.0, w² gives 0.09-1.0 (11x range vs 3x before).
 * 3. Sharper geometric mean: w^2.0 instead of w^1.5 for stronger top-domain focus.
 * 4. Increased keyword resonance: cap raised from 8 to 15 points.
 * 5. Anti-keyword penalty (new Step 4.5): User rejection keywords matched against
 *    property signal text. Budget backpacker's "anti-luxury" hits luxury properties.
 * 6. All v3.1 foundations retained: confidence-dominant domain scoring, evidence
 *    multiplier, reduced missing-domain weight, top-domain bonus, anti-signal penalty.
 */

import { TasteDomain, TasteProfile, DIMENSION_TO_DOMAIN, ALL_TASTE_DOMAINS } from '@/types';
import type { SustainabilityProfile, SustainabilitySignal } from '@/types';
import { decayConfidence } from '@/lib/signal-decay';

const ALL_DOMAINS: TasteDomain[] = ALL_TASTE_DOMAINS;

// ─── Types ──────────────────────────────────────────────────────────────────

interface Signal {
  dimension: string;
  confidence: number;
  signal: string;
  source_type?: string;
  review_corroborated?: boolean;
  extractedAt?: string;
}

interface AntiSignal {
  dimension: string;
  confidence: number;
  signal: string;
}

export interface MatchOptions {
  applyDecay?: boolean;
  decayReferenceTime?: Date;
  sustainabilityProfile?: SustainabilityProfile;
  propertySustainabilitySignals?: SustainabilitySignal[];
  applySourceCredibility?: boolean;
  /** User's micro-taste signals — enables keyword resonance bonus */
  userMicroSignals?: Record<string, string[]>;
  /**
   * v3.2: Signal count per domain from user's allSignals.
   * Used to modulate flat radar weights with actual signal density,
   * creating much sharper cross-archetype differentiation.
   * Keys should be TasteDomain values, values are signal counts.
   */
  userSignalDistribution?: Record<string, number>;
  /**
   * v3.2: Keywords extracted from user's rejection signals (cat === 'Rejection').
   * Matched against property signal text to create anti-keyword penalty.
   */
  userRejectionKeywords?: string[];
}

interface MatchResult {
  overallScore: number;
  breakdown: Record<TasteDomain, number>;
  topDimension: TasteDomain;
  /** Debug: individual scoring components */
  _debug?: {
    rawDomainScores: Record<string, number>;
    enhancedWeights?: Record<string, number>;
    alignedDomainScores: Record<string, number>;
    geometricBase: number;
    topDomainBonus: number;
    resonanceBonus: number;
    antiKeywordPenalty: number;
    antiSignalPenalty: number;
    sustainabilityBonus: number;
    /** Raw combined score before rescaling to user-facing range */
    rawCombined: number;
  };
}

// ─── Source Credibility ─────────────────────────────────────────────────────

const SOURCE_CREDIBILITY: Record<string, number> = {
  'editorial_verified': 0.08,
  'review_corroborated': 0.05,
  'instagram_visual': 0.02,
  'menu_extracted': 0.03,
  'award_verified': 0.06,
  'multi_source': 0.10,
};

// ─── Core Scoring ───────────────────────────────────────────────────────────

/**
 * Compute taste match score from signals + user profile.
 *
 * Scoring pipeline:
 *   0.  Profile enhancement (signal-density weighted radar weights)
 *   1.  Per-domain raw scores (confidence × evidence multiplier)
 *   1.5 Profile alignment transform (w² of enhanced weights)
 *   2.  Weighted geometric mean (w^2.0, reduced missing-domain weight)
 *   3.  Top-domain bonus (if user's #1 domain scores exceptionally)
 *   4.  Keyword resonance bonus (micro-signal overlap, cap 15)
 *   4.5 Anti-keyword penalty (rejection keyword matches)
 *   5.  Anti-signal penalty (proportional to domain importance)
 *   6.  (removed in v3.1 — coverage handled by geometric mean)
 *   7.  Sustainability bonus (unchanged from v2)
 */
/** @deprecated Use computeVectorMatch from taste-match-vectors.ts for new code. */
export function computeMatchFromSignals(
  signals: Signal[],
  antiSignals: AntiSignal[],
  userProfile: TasteProfile,
  options: MatchOptions = {},
): MatchResult {
  const {
    applyDecay = true,
    decayReferenceTime = new Date(),
    applySourceCredibility = true,
    userMicroSignals,
    userSignalDistribution,
    userRejectionKeywords,
  } = options;

  // ── Step 0: Profile enhancement (v3.2) ─────────────────────────────────
  //
  // LLM-generated radar profiles are nearly flat (cosine sim 0.95-0.99).
  // When userSignalDistribution is provided, we modulate radar weights by
  // actual signal density: enhancedWeight = radar × (0.3 + 0.7 × signalShare).
  // This uses the user's actual conversation emphasis to differentiate profiles.

  let enhancedProfile: Record<string, number> = {};
  const debugEnhancedWeights: Record<string, number> = {};

  if (userSignalDistribution) {
    const maxSignalCount = Math.max(...Object.values(userSignalDistribution), 1);
    for (const domain of ALL_DOMAINS) {
      const radarWeight = userProfile[domain] || 0;
      const signalCount = userSignalDistribution[domain] || 0;
      const signalShare = signalCount / maxSignalCount;
      const enhanced = radarWeight * (0.3 + 0.7 * signalShare);
      enhancedProfile[domain] = enhanced;
      debugEnhancedWeights[domain] = Math.round(enhanced * 100) / 100;
    }
  } else {
    // Fallback: use raw radar weights (v3.1 behavior)
    for (const domain of ALL_DOMAINS) {
      enhancedProfile[domain] = userProfile[domain] || 0;
    }
  }

  // ── Step 1: Per-domain raw scoring ──────────────────────────────────────

  const byDomain: Record<TasteDomain, Signal[]> = {} as Record<TasteDomain, Signal[]>;
  for (const domain of ALL_DOMAINS) byDomain[domain] = [];

  for (const sig of signals) {
    const domain = DIMENSION_TO_DOMAIN[sig.dimension];
    if (domain) byDomain[domain].push(sig);
  }

  const breakdown: Record<string, number> = {};
  let coveredDomains = 0;

  for (const domain of ALL_DOMAINS) {
    const domainSignals = byDomain[domain];

    if (domainSignals.length === 0) {
      // Empty domain gets 0 — NOT 50. Missing data should not inflate scores.
      breakdown[domain] = 0;
      continue;
    }

    coveredDomains++;

    // Effective confidence: base + corroboration + source credibility + decay
    const effectiveConfidences = domainSignals.map((s) => {
      let conf = s.confidence;
      if (s.review_corroborated) conf += 0.05;
      if (applySourceCredibility && s.source_type) {
        conf += SOURCE_CREDIBILITY[s.source_type] ?? 0;
      }
      conf = Math.min(conf, 1.0);
      if (applyDecay && s.extractedAt) {
        conf = decayConfidence(conf, s.extractedAt, 180, decayReferenceTime);
      }
      return conf;
    });

    // Weighted confidence: use RMS instead of arithmetic mean.
    // RMS rewards consistently high confidence and penalizes mixed signals.
    const rmsConfidence = Math.sqrt(
      effectiveConfidences.reduce((sum, c) => sum + c * c, 0) / effectiveConfidences.length
    );

    // v3.1: Density as evidence multiplier, not score component.
    // Saturates at 20 signals (vs 60 in v3.0). After 20 signals per domain,
    // more data doesn't meaningfully increase our confidence in the assessment.
    // At 5 signals: 0.60, 10: 0.80, 20: 1.0, 40+: 1.0
    const density = Math.min(Math.log2(domainSignals.length + 1) / Math.log2(20), 1.0);

    // v3.1: Confidence dominates (85%), density provides a small evidence multiplier (15%).
    // Previously density could contribute ~50% of the domain score, causing signal-rich
    // properties to outscore signal-sparse ones by 20+ points regardless of quality.
    // Now: 5 signals at 0.90 conf ≈ 40 signals at 0.80 conf. Quality over quantity.
    const rawScore = rmsConfidence * (0.85 + density * 0.15);
    breakdown[domain] = Math.round(rawScore * 100);
  }

  // ── Step 1.5: Profile alignment transform (v3.2: w² of enhanced weights) ─
  //
  // v3.2: Use enhanced weights (signal-density modulated) squared.
  // With enhanced weights ranging 0.3-1.0, w² gives 0.09-1.0 (11x range).
  // Previously with flat radar weights 0.8-1.0, alignment was 0.86-1.0 (1.2x).
  //
  // Example: budget-backpacker enhanced weights:
  //   Character=1.00 → alignment 1.00, Setting=0.44 → alignment 0.19
  //   A property scoring 80 in both: Char stays 80, Setting drops to 15.

  const rawDomainScores: Record<string, number> = {};
  for (const domain of ALL_DOMAINS) {
    rawDomainScores[domain] = breakdown[domain];
  }

  for (const domain of ALL_DOMAINS) {
    if (breakdown[domain] > 0) {
      const w = enhancedProfile[domain] || 0;
      // w² alignment: 1.0→1.0, 0.7→0.49, 0.5→0.25, 0.3→0.09
      const alignmentFactor = w * w;
      breakdown[domain] = Math.round(breakdown[domain] * Math.max(alignmentFactor, 0.05));
    }
  }

  const alignedDomainScores: Record<string, number> = {};
  for (const domain of ALL_DOMAINS) {
    alignedDomainScores[domain] = breakdown[domain];
  }

  // ── Step 2: Weighted geometric mean (v3.2: enhanced weights, w^2.0) ─────
  //
  // v3.2: Uses enhanced weights (signal-density modulated) with w^2.0 exponent.
  // With enhanced weights 0.3-1.0: w^2.0 gives 0.09-1.0 (11x range).
  // Previously with flat radar weights 0.8-1.0 and w^1.5: 0.72-1.0 (1.4x).
  // Missing domains still use 10% weight factor.

  const userDomainPriority = ALL_DOMAINS
    .map((d) => ({ domain: d, weight: enhancedProfile[d] || 0 }))
    .filter((d) => d.weight > 0.10) // lower threshold since enhanced weights can be small
    .sort((a, b) => b.weight - a.weight);

  let logSum = 0;
  let weightSum = 0;

  for (const { domain, weight } of userDomainPriority) {
    const score = breakdown[domain];
    // v3.2: w^2.0 for much sharper top-domain focus with enhanced weights
    const sharpWeight = Math.pow(weight, 2.0);

    if (score <= 0) {
      // v3.2.1: Skip domains with zero signals entirely.
      // "No data" ≠ "bad" — a store with no Atmosphere signals shouldn't be
      // penalized for it. The geometric mean is computed only over domains
      // where the property actually has signal coverage. This lets specialized
      // places (stores, activities, experiences) score on their merits without
      // being dragged down by legitimately absent domains.
      continue;
    } else {
      logSum += sharpWeight * Math.log(score);
      weightSum += sharpWeight;
    }
  }

  const geometricBase = weightSum > 0
    ? Math.exp(logSum / weightSum)
    : 50;

  // ── Step 3: Top-domain bonus ────────────────────────────────────────────
  //
  // If the user's highest-priority domain has an exceptional aligned score (>60),
  // add a bonus. Threshold lowered from 85 because w² alignment compresses scores.

  const topUserDomain = userDomainPriority[0];
  let topDomainBonus = 0;
  if (topUserDomain) {
    const topScore = breakdown[topUserDomain.domain];
    if (topScore > 60) {
      topDomainBonus = Math.round((topScore - 60) * 0.25 * topUserDomain.weight);
    }
  }

  // ── Step 4: Keyword resonance bonus ─────────────────────────────────────
  //
  // Direct keyword overlap between user micro-signals and property signals.
  // v3.2: Cap raised from 8 to 15 — with sharper alignment compressing the
  // geometric base, resonance needs more headroom to differentiate.

  let resonanceBonus = 0;
  if (userMicroSignals) {
    const userKeywords = new Set<string>();
    for (const sigs of Object.values(userMicroSignals)) {
      for (const sig of sigs) {
        for (const word of sig.toLowerCase().split(/\s+/)) {
          if (word.length > 3) userKeywords.add(word);
        }
      }
    }

    let matchCount = 0;
    const matchedKeywords = new Set<string>();
    for (const sig of signals) {
      for (const word of sig.signal.toLowerCase().split(/\s+/)) {
        if (userKeywords.has(word) && !matchedKeywords.has(word)) {
          matchedKeywords.add(word);
          matchCount++;
        }
      }
    }

    // Diminishing returns: first matches worth more than later ones
    // v3.2: 1 match = 3pts, 3 matches = 6pts, 6 matches = 10pts, 10+ = 15pts
    resonanceBonus = Math.min(Math.round(Math.log2(matchCount + 1) * 4.5), 15);
  }

  // ── Step 4.5: Anti-keyword penalty (v3.2) ───────────────────────────────
  //
  // Match user's rejection keywords against property signal text.
  // A budget backpacker with rejection tags like "anti-luxury-amenities" or
  // "anti-pretentious-service" gets penalized when property signals contain
  // those keywords (e.g., "luxury", "premium", "butler service").
  // Max 12 points penalty.

  let antiKeywordPenalty = 0;
  if (userRejectionKeywords && userRejectionKeywords.length > 0 && signals.length > 0) {
    const rejectionWords = new Set<string>();
    for (const keyword of userRejectionKeywords) {
      // Split compound keywords like "anti-luxury-amenities" into searchable parts
      for (const part of keyword.toLowerCase().replace(/^anti-/, '').split(/[-_\s]+/)) {
        if (part.length > 3) rejectionWords.add(part);
      }
    }

    let matchCount = 0;
    const matchedWords = new Set<string>();
    for (const sig of signals) {
      for (const word of sig.signal.toLowerCase().split(/[\s-_]+/)) {
        if (rejectionWords.has(word) && !matchedWords.has(word)) {
          matchedWords.add(word);
          matchCount++;
        }
      }
    }

    // Diminishing returns: 1 match = 3pts, 3 = 6pts, 5+ = 10pts, 8+ = 12pts
    antiKeywordPenalty = Math.min(Math.round(Math.log2(matchCount + 1) * 3.5), 12);
  }

  // ── Step 5: Ratio-based anti-signal penalty ─────────────────────────────
  //
  // Instead of summing per-signal penalties (which blows up when properties
  // have 18+ anti-signals — the median), we compute the ratio of weighted
  // anti-signal strength to total signal count. A property with 18 anti-signals
  // and 210 signals (8.5% anti) gets a mild penalty; one with 30 anti-signals
  // and 50 signals (60% anti) gets a severe one.

  let antiSignalPenalty = 0;
  if (antiSignals.length > 0 && signals.length > 0) {
    let antiWeightedSum = 0;
    for (const anti of antiSignals) {
      const domain = DIMENSION_TO_DOMAIN[anti.dimension];
      if (domain) {
        const domainWeight = enhancedProfile[domain] || 0.5;
        antiWeightedSum += anti.confidence * domainWeight;

        // Still reduce domain breakdown for interpretability
        breakdown[domain] = Math.max(0, breakdown[domain] - Math.round(anti.confidence * 5));
      }
    }

    // Ratio: weighted anti-signal strength relative to total signal count
    // Denominator uses signals * 0.5 to make the ratio more sensitive
    const antiRatio = antiWeightedSum / Math.max(signals.length * 0.5, 1);

    // Scale: ratio of 0.1 → ~2pts, 0.3 → ~6pts, 0.5 → ~10pts, 1.0 → ~20pts
    antiSignalPenalty = Math.min(Math.round(antiRatio * 20), 20);
  }

  // ── Step 6: Coverage penalty ────────────────────────────────────────────
  //
  // v3.1: Removed the explicit coverage penalty. Missing domains are now
  // handled by the geometric mean with 10% weight factor, which provides
  // a natural, proportional penalty without crushing specialized properties.
  // A property covering 3 of 6 important domains gets a mild implicit drag
  // from the reduced-weight missing domains, but isn't hard-penalized.

  // ── Step 7: Sustainability bonus (unchanged from v2) ────────────────────

  let sustainabilityBonus = 0;
  if (options.sustainabilityProfile && options.propertySustainabilitySignals) {
    sustainabilityBonus = computeSustainabilityBonus(
      options.sustainabilityProfile,
      options.propertySustainabilitySignals,
    );
  }

  // ── Combine ─────────────────────────────────────────────────────────────

  const rawCombined = geometricBase
    + topDomainBonus
    + resonanceBonus
    - antiKeywordPenalty
    - antiSignalPenalty
    + sustainabilityBonus;

  // NOTE: Raw score is returned directly. Call `normalizeScoresForDisplay()`
  // on the full batch of scores to curve them into a user-friendly range
  // where the top match lands at ~93 and the distribution feels intuitive.
  const overallScore = Math.max(0, Math.min(100, Math.round(rawCombined)));

  const topDimension = ALL_DOMAINS.reduce((best, d) =>
    breakdown[d] > breakdown[best] ? d : best
  );

  return {
    overallScore,
    breakdown: breakdown as Record<TasteDomain, number>,
    topDimension,
    _debug: {
      rawDomainScores,
      enhancedWeights: Object.keys(debugEnhancedWeights).length > 0 ? debugEnhancedWeights : undefined,
      alignedDomainScores,
      geometricBase: Math.round(geometricBase),
      topDomainBonus,
      resonanceBonus,
      antiKeywordPenalty,
      antiSignalPenalty: Math.round(antiSignalPenalty),
      sustainabilityBonus,
      rawCombined: Math.round(rawCombined),
    },
  };
}

// ─── Per-user score normalization (v3.2) ─────────────────────────────────────

/**
 * Curve raw v3.2 scores into a user-friendly display range.
 *
 * The w² alignment produces raw scores in a compressed ~25-50 range. Users
 * expect their top match out of hundreds of properties to show ~90+, with a
 * natural spread down from there. This function maps each user's raw score
 * distribution into a display range using percentile-based curving:
 *
 *   - The #1 match maps to `ceiling` (default 93)
 *   - The lowest match maps to `floor` (default 35)
 *   - Scores in between are placed by their percentile position using a
 *     power curve (exponent 0.7) that stretches the top end — most of the
 *     display range goes to the top quartile where users actually browse.
 *
 * Call this after scoring all properties for a single user.
 *
 * @param scores Array of {id, rawScore} (or any object with overallScore)
 * @param ceiling Display score for the top match (default 93)
 * @param floor Display score for the worst match (default 35)
 * @returns Same array with overallScore replaced by curved display scores
 */
export function normalizeScoresForDisplay<T extends { overallScore: number }>(
  scores: T[],
  ceiling = 96,
  floor = 35,
): T[] {
  if (scores.length === 0) return scores;
  if (scores.length === 1) {
    return [{ ...scores[0], overallScore: ceiling }];
  }

  // Sort descending to find min/max
  const rawScores = scores.map(s => s.overallScore);
  const maxRaw = Math.max(...rawScores);
  const minRaw = Math.min(...rawScores);
  const rawRange = maxRaw - minRaw;

  if (rawRange === 0) {
    // All scores identical — put them at the ceiling
    return scores.map(s => ({ ...s, overallScore: ceiling }));
  }

  const displayRange = ceiling - floor;

  return scores.map(s => {
    // Percentile position: 0 (worst) to 1 (best)
    const pct = (s.overallScore - minRaw) / rawRange;

    // Power curve with exponent < 1 stretches the top end.
    // pct=1.0 → 1.0, pct=0.5 → 0.62, pct=0.25 → 0.47, pct=0.0 → 0.0
    // This means the top half of raw scores gets ~62% of the display range.
    const curved = Math.pow(pct, 0.7);

    const displayScore = Math.round(floor + curved * displayRange);

    return {
      ...s,
      overallScore: Math.max(floor, Math.min(ceiling, displayScore)),
    };
  });
}

// ─── Utility exports ─────────────────────────────────────────────────────────

/** Default taste profile for users without a computed profile */
export const DEFAULT_USER_PROFILE: TasteProfile = {
  Design: 0.85,
  Atmosphere: 0.75,
  Character: 0.8,
  Service: 0.6,
  FoodDrink: 0.75,
  Geography: 0.7,
  Wellness: 0.4,
  Sustainability: 0.3,
};

/** Get the top N taste domains sorted by weight */
export function getTopAxes(profile: TasteProfile, count: number = 3): TasteDomain[] {
  return [...ALL_DOMAINS]
    .sort((a, b) => profile[b] - profile[a])
    .slice(0, count);
}

// ─── Sustainability (unchanged from v2) ─────────────────────────────────────

function computeSustainabilityBonus(
  userProfile: SustainabilityProfile,
  propertySignals: SustainabilitySignal[],
): number {
  if (propertySignals.length === 0) return 0;

  const sensitivityWeight: Record<string, number> = {
    LEADING: 1.0, CONSCIOUS: 0.6, PASSIVE: 0.2, INDIFFERENT: 0,
  };
  const weight = sensitivityWeight[userProfile.sensitivity] ?? 0;
  if (weight === 0) return 0;

  const avgConf = propertySignals.reduce((sum, s) => sum + s.confidence, 0) / propertySignals.length;

  const prioritySet = new Set(userProfile.priorities.map((p) => p.toLowerCase()));
  const alignedSignals = propertySignals.filter(
    (s) => prioritySet.has(s.dimension.toLowerCase()) || prioritySet.has(s.tag.toLowerCase()),
  );
  const alignmentBonus = alignedSignals.length > 0 ? 0.3 : 0;

  const dealbreakers = new Set(userProfile.dealbreakers.map((d) => d.toLowerCase()));
  if (propertySignals.some((s) => dealbreakers.has(s.tag.toLowerCase()))) return -3;

  return Math.round((avgConf + alignmentBonus) * weight * 5);
}
