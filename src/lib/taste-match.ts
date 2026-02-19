/**
 * Taste Match — compute how well a property's intelligence matches a user's taste profile.
 *
 * Provides two scoring modes:
 * 1. Signal-based: from pipeline enrichment data (signals + anti-signals)
 * 2. Profile-based: from flat numeric profiles (0–1 per domain)
 */

import { TasteDomain, TasteProfile, DIMENSION_TO_DOMAIN } from '@/types';

const ALL_DOMAINS: TasteDomain[] = ['Design', 'Character', 'Service', 'Food', 'Location', 'Wellness'];

// ─── Signal-based scoring (pipeline-enriched places) ─────────────────────────

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
      breakdown[domain] = 50; // No data — neutral score
      continue;
    }

    const totalConf = domainSignals.reduce((sum, s) => {
      const boost = s.review_corroborated ? 0.05 : 0;
      return sum + Math.min(s.confidence + boost, 1.0);
    }, 0);
    const avgConfidence = totalConf / domainSignals.length;
    const density = Math.min(domainSignals.length / 20, 1.0);
    const propertyStrength = avgConfidence * 0.6 + density * 0.4;
    breakdown[domain] = Math.round(propertyStrength * 100);
  }

  // Apply anti-signal penalties
  for (const anti of antiSignals) {
    const domain = DIMENSION_TO_DOMAIN[anti.dimension];
    if (domain && breakdown[domain] !== undefined) {
      breakdown[domain] = Math.max(0, breakdown[domain] - Math.round(anti.confidence * 5));
    }
  }

  // Overall score: weighted by user's taste profile
  let weightedSum = 0;
  let totalWeight = 0;
  for (const domain of ALL_DOMAINS) {
    const userWeight = userProfile[domain] || 0.5;
    weightedSum += userWeight * breakdown[domain];
    totalWeight += userWeight;
  }
  const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;

  const topDimension = ALL_DOMAINS.reduce((best, d) =>
    breakdown[d] > breakdown[best] ? d : best
  );

  return {
    overallScore,
    breakdown: breakdown as Record<TasteDomain, number>,
    topDimension,
  };
}

// ─── Profile-based scoring (flat numeric profiles from AI extraction) ────────

/**
 * Compute match score from flat 0–1 profiles (used by import route for initial scoring).
 */
export function computeMatchScore(userProfile: TasteProfile, placeProfile: TasteProfile): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const domain of ALL_DOMAINS) {
    const userWeight = userProfile[domain];
    const placeScore = placeProfile[domain];
    weightedSum += userWeight * placeScore;
    totalWeight += userWeight;
  }

  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 50;
}

/**
 * Get the top N taste domains from a profile, sorted by strength.
 */
export function getTopAxes(profile: TasteProfile, count: number = 3): TasteDomain[] {
  return [...ALL_DOMAINS]
    .sort((a, b) => profile[b] - profile[a])
    .slice(0, count);
}

/**
 * A stretch pick is one where the place's top axes don't overlap with the user's top axes.
 */
export function isStretchPick(userProfile: TasteProfile, placeProfile: TasteProfile): boolean {
  const userTop = new Set(getTopAxes(userProfile, 2));
  const placeTop = getTopAxes(placeProfile, 2);
  return placeTop.filter(d => userTop.has(d)).length === 0;
}

export const DEFAULT_USER_PROFILE: TasteProfile = {
  Design: 0.85,
  Character: 0.8,
  Service: 0.6,
  Food: 0.75,
  Location: 0.7,
  Wellness: 0.4,
};
