/**
 * Taste Match — compute how well a property's intelligence matches a user's taste profile.
 *
 * Maps pipeline dimensions (e.g. "Design Language") to app domains (e.g. "Design")
 * and produces per-domain scores + overall match score.
 */

import { TasteDomain, TasteProfile } from '@/types';

// ─── Pipeline dimension → App domain mapping ───

const DIMENSION_TO_DOMAIN: Record<string, TasteDomain> = {
  'Design Language': 'Design',
  'Character & Identity': 'Character',
  'Service Philosophy': 'Service',
  'Food & Drink Identity': 'Food',
  'Location & Context': 'Location',
  'Wellness & Body': 'Wellness',
  // Legacy dimension names (from older pipeline runs)
  'Design & Aesthetic': 'Design',
  'Scale & Intimacy': 'Character',
  'Culture & Character': 'Character',
  'Food & Drink': 'Food',
  'Location & Setting': 'Location',
  'Rhythm & Pace': 'Character',
};

interface Signal {
  dimension: string;
  confidence: number;
  signal: string;
  source_type?: string;
  review_corroborated?: boolean;
}

interface AntiSignal {
  dimension: string;
  confidence: number;
  signal: string;
}

interface MatchResult {
  overallScore: number; // 0-100
  breakdown: Record<TasteDomain, number>; // per-domain 0-100
  topDimension: TasteDomain;
}

const ALL_DOMAINS: TasteDomain[] = ['Design', 'Character', 'Service', 'Food', 'Location', 'Wellness'];

/**
 * Compute taste match from raw signals + user profile.
 *
 * Scoring logic:
 * - Group signals by domain
 * - For each domain: density (how many signals) × avg confidence × user affinity
 * - Corroborated signals get a confidence boost
 * - Anti-signals apply a small penalty to the relevant domain
 * - Overall = weighted average where user's domain weights determine importance
 */
export function computeMatchFromSignals(
  signals: Signal[],
  antiSignals: AntiSignal[],
  userProfile: TasteProfile
): MatchResult {
  // Group signals by domain
  const byDomain: Record<TasteDomain, Signal[]> = {} as Record<TasteDomain, Signal[]>;
  for (const domain of ALL_DOMAINS) {
    byDomain[domain] = [];
  }

  for (const sig of signals) {
    const domain = DIMENSION_TO_DOMAIN[sig.dimension];
    if (domain) {
      byDomain[domain].push(sig);
    }
  }

  // Score each domain
  const breakdown: Record<string, number> = {};

  for (const domain of ALL_DOMAINS) {
    const domainSignals = byDomain[domain];

    if (domainSignals.length === 0) {
      // No data for this domain — neutral score
      breakdown[domain] = 50;
      continue;
    }

    // Average confidence, with boost for corroborated signals
    const totalConf = domainSignals.reduce((sum, s) => {
      const boost = s.review_corroborated ? 0.05 : 0;
      return sum + Math.min(s.confidence + boost, 1.0);
    }, 0);
    const avgConfidence = totalConf / domainSignals.length;

    // Density: how well-documented is this domain? (20+ signals = full density)
    const density = Math.min(domainSignals.length / 20, 1.0);

    // Combine: high confidence + good density = strong property identity for this domain
    const propertyStrength = avgConfidence * 0.6 + density * 0.4;

    // Scale to 0-100
    breakdown[domain] = Math.round(propertyStrength * 100);
  }

  // Apply anti-signal penalties (small — they're contextual, not primary)
  for (const anti of antiSignals) {
    const domain = DIMENSION_TO_DOMAIN[anti.dimension];
    if (domain && breakdown[domain] !== undefined) {
      // Small penalty scaled by anti-signal confidence
      breakdown[domain] = Math.max(0, breakdown[domain] - Math.round(anti.confidence * 5));
    }
  }

  // Compute overall score: weighted by user's taste profile
  let weightedSum = 0;
  let totalWeight = 0;
  for (const domain of ALL_DOMAINS) {
    const userWeight = userProfile[domain] || 0.5;
    weightedSum += userWeight * breakdown[domain];
    totalWeight += userWeight;
  }
  const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;

  // Find top dimension
  const topDimension = ALL_DOMAINS.reduce((best, d) =>
    breakdown[d] > breakdown[best] ? d : best
  );

  return {
    overallScore,
    breakdown: breakdown as Record<TasteDomain, number>,
    topDimension,
  };
}