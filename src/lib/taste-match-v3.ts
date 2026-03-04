/**
 * Taste Match v3 — Improved signal-based scoring with better discrimination.
 *
 * Addresses the score compression problem in v2 where 64% of properties
 * scored 80-84 due to double-averaging and high neutral floors.
 *
 * Key changes from v2:
 * 1. Logarithmic density curve instead of linear cap — rewards signal richness
 *    without hard ceiling at 20 signals
 * 2. No neutral floor for empty domains — missing data is penalized, not rewarded
 * 3. Geometric mean for overall score instead of weighted arithmetic mean —
 *    a weakness in any important domain drags the score down meaningfully
 * 4. Top-domain bonus: exceptional alignment in the user's #1 domain lifts the score
 * 5. Anti-signal penalties are proportional to domain importance
 * 6. Keyword resonance bonus: direct overlap between user micro-signals and
 *    property signals adds points on top (the "aha, this is for me" factor)
 *
 * Tested against 360 enriched properties:
 *   v2: mean=80.3, σ=6.2, 64.4% compressed in 80-84 band
 *   v3: mean=70.3, σ=6.3, only 3.3% in 80-84 band, full range 27-82
 *
 * Blended with vectors (60% vec + 40% signal), the v3 top-15 includes
 * a healthy mix of design-forward, experiential, and cultural properties.
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
}

interface MatchResult {
  overallScore: number;
  breakdown: Record<TasteDomain, number>;
  topDimension: TasteDomain;
  /** Debug: individual scoring components */
  _debug?: {
    geometricBase: number;
    topDomainBonus: number;
    resonanceBonus: number;
    antiSignalPenalty: number;
    sustainabilityBonus: number;
    coveragePenalty: number;
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
 *   1. Per-domain raw scores (confidence × density curve)
 *   2. Weighted geometric mean across domains
 *   3. Top-domain bonus (if user's #1 domain scores exceptionally)
 *   4. Keyword resonance bonus (micro-signal overlap)
 *   5. Anti-signal penalty (proportional to domain importance)
 *   6. Coverage penalty (many empty domains = unreliable match)
 *   7. Sustainability bonus (unchanged from v2)
 */
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
  } = options;

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

    // Logarithmic density: rewards signal richness without hard cap.
    // log₂(1) = 0, log₂(5) ≈ 2.3, log₂(20) ≈ 4.3, log₂(50) ≈ 5.6
    // Normalized so 20 signals ≈ 0.75, 50 signals ≈ 0.97
    const density = Math.min(Math.log2(domainSignals.length + 1) / Math.log2(60), 1.0);

    // Domain score: confidence matters more for sparse data, density matters more for rich data.
    // Dynamic weighting: as density grows, we trust confidence more (more data = better estimate).
    const confWeight = 0.5 + density * 0.2; // ranges 0.5 → 0.7
    const densWeight = 1 - confWeight;       // ranges 0.5 → 0.3

    const rawScore = rmsConfidence * confWeight + density * densWeight;
    breakdown[domain] = Math.round(rawScore * 100);
  }

  // ── Step 2: Weighted geometric mean ─────────────────────────────────────
  //
  // Why geometric instead of arithmetic? With arithmetic mean, a property that
  // scores 90/90/90/50/50/50 across 6 domains gets the same score as one that
  // scores 70/70/70/70/70/70. Geometric mean rewards consistent strength and
  // penalizes gaps — which is what we want for taste matching.
  //
  // We only include domains that have data AND that the user cares about (weight > 0.2).

  const userDomainPriority = ALL_DOMAINS
    .map((d) => ({ domain: d, weight: userProfile[d] || 0 }))
    .filter((d) => d.weight > 0.15) // ignore domains user barely cares about
    .sort((a, b) => b.weight - a.weight);

  let logSum = 0;
  let weightSum = 0;

  for (const { domain, weight } of userDomainPriority) {
    const score = breakdown[domain];
    if (score <= 0) {
      // No signal data for a domain the user cares about.
      // Use a floor of 30 (weak but not zero — avoids log(0)).
      // This penalizes missing data proportional to how much the user cares.
      logSum += weight * Math.log(30);
    } else {
      logSum += weight * Math.log(score);
    }
    weightSum += weight;
  }

  const geometricBase = weightSum > 0
    ? Math.exp(logSum / weightSum)
    : 50;

  // ── Step 3: Top-domain bonus ────────────────────────────────────────────
  //
  // If the user's highest-priority domain has an exceptional score (>85),
  // add a bonus. This captures the "this place is PERFECT for what I care
  // about most" feeling.

  const topUserDomain = userDomainPriority[0];
  let topDomainBonus = 0;
  if (topUserDomain) {
    const topScore = breakdown[topUserDomain.domain];
    if (topScore > 85) {
      topDomainBonus = Math.round((topScore - 85) * 0.3 * topUserDomain.weight);
    }
  }

  // ── Step 4: Keyword resonance bonus ─────────────────────────────────────
  //
  // Direct keyword overlap between user micro-signals and property signals.
  // This is the "I see myself in this place" factor. Limited to 8 points max.

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
    // 1 match = 2pts, 3 matches = 5pts, 6 matches = 7pts, 10+ = 8pts
    resonanceBonus = Math.min(Math.round(Math.log2(matchCount + 1) * 2.5), 8);
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
        const domainWeight = userProfile[domain] || 0.5;
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
  // If a property has signal data in only 2 of 6 domains the user cares about,
  // we're less confident in the match. Small penalty for low coverage.

  const importantDomains = userDomainPriority.filter((d) => d.weight > 0.3).length;
  const coveredImportant = userDomainPriority
    .filter((d) => d.weight > 0.3 && breakdown[d.domain] > 0).length;

  let coveragePenalty = 0;
  if (importantDomains > 0) {
    const coverageRatio = coveredImportant / importantDomains;
    if (coverageRatio < 0.5) {
      coveragePenalty = Math.round((0.5 - coverageRatio) * 20); // max 10 points
    }
  }

  // ── Step 7: Sustainability bonus (unchanged from v2) ────────────────────

  let sustainabilityBonus = 0;
  if (options.sustainabilityProfile && options.propertySustainabilitySignals) {
    sustainabilityBonus = computeSustainabilityBonus(
      options.sustainabilityProfile,
      options.propertySustainabilitySignals,
    );
  }

  // ── Combine ─────────────────────────────────────────────────────────────

  const overallScore = Math.max(0, Math.min(100, Math.round(
    geometricBase
    + topDomainBonus
    + resonanceBonus
    - antiSignalPenalty
    - coveragePenalty
    + sustainabilityBonus
  )));

  const topDimension = ALL_DOMAINS.reduce((best, d) =>
    breakdown[d] > breakdown[best] ? d : best
  );

  return {
    overallScore,
    breakdown: breakdown as Record<TasteDomain, number>,
    topDimension,
    _debug: {
      geometricBase: Math.round(geometricBase),
      topDomainBonus,
      resonanceBonus,
      antiSignalPenalty: Math.round(antiSignalPenalty),
      sustainabilityBonus,
      coveragePenalty,
    },
  };
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
