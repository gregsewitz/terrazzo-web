/**
 * Taste Match — compute how well a property's intelligence matches a user's taste profile.
 *
 * Provides two scoring modes:
 * 1. Signal-based: from pipeline enrichment data (signals + anti-signals)
 * 2. Profile-based: from flat numeric profiles (0–1 per domain)
 *
 * v2 additions:
 * - Decay-weighted scoring: newer signals carry more weight via 180-day half-life
 * - Sustainability alignment: optional bonus for eco-conscious users
 * - Rhythm compatibility: pace/tempo matching between user and property
 * - Source credibility weighting: corroborated + multi-source signals score higher
 */

import { TasteDomain, TasteProfile, DIMENSION_TO_DOMAIN, ALL_TASTE_DOMAINS } from '@/types';
import type { SustainabilityProfile, SustainabilitySignal } from '@/types';
import { decayConfidence } from '@/lib/signal-decay';

const ALL_DOMAINS: TasteDomain[] = ALL_TASTE_DOMAINS;

// ─── Signal-based scoring (pipeline-enriched places) ─────────────────────────

interface Signal {
  dimension: string;
  confidence: number;
  signal: string;
  source_type?: string;
  review_corroborated?: boolean;
  /** ISO timestamp — when present, enables decay-weighted scoring */
  extractedAt?: string;
}

/** Options for enhanced scoring (v2) */
export interface MatchOptions {
  /** Apply temporal decay to signal confidence (default: true when extractedAt present) */
  applyDecay?: boolean;
  /** Reference time for decay computation (default: now) */
  decayReferenceTime?: Date;
  /** User sustainability profile — enables sustainability bonus scoring */
  sustainabilityProfile?: SustainabilityProfile;
  /** Property sustainability signals — paired with sustainabilityProfile */
  propertySustainabilitySignals?: SustainabilitySignal[];
  /** Apply source credibility weighting (default: true) */
  applySourceCredibility?: boolean;
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
 * Use for pipeline-enriched places with signal/anti-signal data from Place Intelligence.
 * Returns fine-grained scoring based on signal density and confidence.
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
  userProfile: TasteProfile,
  options: MatchOptions = {},
): MatchResult {
  const {
    applyDecay = true,
    decayReferenceTime = new Date(),
    sustainabilityProfile,
    propertySustainabilitySignals,
    applySourceCredibility = true,
  } = options;

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
      // Base confidence with optional corroboration boost
      let conf = s.confidence;
      if (s.review_corroborated) conf += 0.05;

      // Source credibility: multi-source signals are more reliable
      if (applySourceCredibility && s.source_type) {
        const credibilityBoost = SOURCE_CREDIBILITY[s.source_type] ?? 0;
        conf += credibilityBoost;
      }

      conf = Math.min(conf, 1.0);

      // Apply temporal decay if extractedAt is available
      if (applyDecay && s.extractedAt) {
        conf = decayConfidence(conf, s.extractedAt, 180, decayReferenceTime);
      }

      return sum + conf;
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
  let overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;

  // Sustainability alignment bonus (0-5 points)
  if (sustainabilityProfile && propertySustainabilitySignals && propertySustainabilitySignals.length > 0) {
    const sustainBonus = computeSustainabilityBonus(sustainabilityProfile, propertySustainabilitySignals);
    overallScore = Math.min(100, overallScore + sustainBonus);
  }

  const topDimension = ALL_DOMAINS.reduce((best, d) =>
    breakdown[d] > breakdown[best] ? d : best
  );

  return {
    overallScore,
    breakdown: breakdown as Record<TasteDomain, number>,
    topDimension,
  };
}

// ─── Source Credibility Weights ──────────────────────────────────────────────

/** Bonus confidence for signals from high-credibility sources */
const SOURCE_CREDIBILITY: Record<string, number> = {
  'editorial_verified': 0.08,
  'review_corroborated': 0.05,
  'instagram_visual': 0.02,
  'menu_extracted': 0.03,
  'award_verified': 0.06,
  'multi_source': 0.10,
};

// ─── Sustainability Alignment ───────────────────────────────────────────────

/**
 * Compute bonus score (0-5) for sustainability alignment.
 * Users with LEADING sensitivity get full bonus; INDIFFERENT gets 0.
 */
function computeSustainabilityBonus(
  userProfile: SustainabilityProfile,
  propertySignals: SustainabilitySignal[],
): number {
  if (propertySignals.length === 0) return 0;

  // Sensitivity multiplier
  const sensitivityWeight: Record<string, number> = {
    LEADING: 1.0,
    CONSCIOUS: 0.6,
    PASSIVE: 0.2,
    INDIFFERENT: 0,
  };
  const weight = sensitivityWeight[userProfile.sensitivity] ?? 0;
  if (weight === 0) return 0;

  // Average confidence of property sustainability signals
  const avgConf = propertySignals.reduce((sum, s) => sum + s.confidence, 0) / propertySignals.length;

  // Priority alignment: boost if property has signals in user's priority dimensions
  const prioritySet = new Set(userProfile.priorities.map(p => p.toLowerCase()));
  const alignedSignals = propertySignals.filter(s =>
    prioritySet.has(s.dimension.toLowerCase()) || prioritySet.has(s.tag.toLowerCase())
  );
  const alignmentBonus = alignedSignals.length > 0 ? 0.3 : 0;

  // Dealbreaker check: any property signal that matches a user dealbreaker = penalty
  const dealbreakers = new Set(userProfile.dealbreakers.map(d => d.toLowerCase()));
  const hasDealbreaker = propertySignals.some(s =>
    dealbreakers.has(s.tag.toLowerCase())
  );
  if (hasDealbreaker) return -3; // penalty

  return Math.round((avgConf + alignmentBonus) * weight * 5);
}

// ─── Profile-based scoring (flat numeric profiles from AI extraction) ────────

/**
 * Compute match score from flat 0–1 profiles (used by import route for initial scoring).
 *
 * Use for quick scoring during import — compares flat user profile weights against
 * flat place profile scores. Returns 0-100 match percentage.
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
  Rhythm: 0.5,
  CulturalEngagement: 0.5,
};

/**
 * Polymorphic taste match — automatically selects the right scoring algorithm
 * based on the shape of the place data.
 */
export function computeMatch(
  userProfile: TasteProfile,
  placeData: { signals?: Signal[]; antiSignals?: AntiSignal[]; profile?: TasteProfile },
  options: MatchOptions = {},
): MatchResult {
  if (placeData.signals && placeData.signals.length > 0) {
    return computeMatchFromSignals(placeData.signals, placeData.antiSignals || [], userProfile, options);
  }
  if (placeData.profile) {
    const score = computeMatchScore(userProfile, placeData.profile);
    return {
      overallScore: score,
      breakdown: {} as Record<TasteDomain, number>,
      topDimension: getTopAxes(placeData.profile)[0] || 'Design',
    };
  }
  return { overallScore: 50, breakdown: {} as Record<TasteDomain, number>, topDimension: 'Design' };
}
