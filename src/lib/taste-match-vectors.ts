/**
 * Taste Match — Vector-First Scoring (v4)
 *
 * Sole scoring/ranking mechanism for property matching.
 * Replaces the domain-based 7-step pipeline (taste-match-v3.ts) as the source
 * of truth for matchScore and matchBreakdown.
 *
 * The radar chart and per-domain breakdowns are still shown to users,
 * but they're derived FROM the vector match (cluster contribution sums
 * per domain), not computed independently.
 *
 * Architecture:
 *   - computeVectorMatch(): Pure vector math, no DB calls
 *   - computeVectorMatchFromDb(): Fetches vectors then calls computeVectorMatch
 *   - computeMatchExplanation(): Top-cluster decomposition for "Why this matches"
 *   - normalizeVectorScoresForDisplay(): Percentile-based score curving
 */

import { prisma } from '@/lib/prisma';
import {
  cosineSimilarityV3,
  getClusterIndicesForDomain,
  getAllClusterLabels,
  ALL_DOMAINS,
  VECTOR_DIM_V3,
  vectorToSqlV3,
} from '@/lib/taste-intelligence';
import type { TasteDomain } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VectorMatchResult {
  /** Overall match score 0-100 (raw, before normalization) */
  overallScore: number;
  /** Per-domain breakdown 0-100 derived from cluster contributions */
  breakdown: Record<TasteDomain, number>;
  /** Top domain by contribution */
  topDimension: TasteDomain;
  /** Top contributing clusters for explanation UI */
  topClusters: ClusterContribution[];
  /** Human-readable match explanation */
  explanation: MatchExplanation;
}

export interface ClusterContribution {
  clusterId: number;
  label: string;
  domain: string;
  /** Raw contribution (userVec[i] * propVec[i]) */
  contribution: number;
  /** Top signals in this cluster */
  topSignals: string[];
}

export interface MatchExplanation {
  /** Top 5 clusters driving the match */
  topClusters: Array<{
    label: string;
    domain: string;
    score: number; // 0-100 contribution strength
    signals: string[];
  }>;
  /** Generated narrative string */
  narrative: string;
}

// ─── Domain breakdown from cluster contributions ────────────────────────────

/**
 * Derive per-domain scores from element-wise vector product.
 *
 * For each domain, sum the positive contributions of clusters assigned to it.
 * Normalize to 0-100 scale relative to the max domain contribution.
 */
function deriveDomainBreakdown(
  userVector: number[],
  propertyVector: number[],
): Record<TasteDomain, number> {
  const domainSums: Record<string, number> = {};
  const domainMaxPossible: Record<string, number> = {};

  for (const domain of ALL_DOMAINS) {
    const indices = getClusterIndicesForDomain(domain);
    let sum = 0;
    let maxPossible = 0;

    for (const idx of indices) {
      const contribution = userVector[idx] * propertyVector[idx];
      sum += contribution;
      // Max possible = sum of |user[i]| * |prop[i]| (perfect alignment)
      maxPossible += Math.abs(userVector[idx]) * Math.abs(propertyVector[idx]);
    }

    domainSums[domain] = sum;
    domainMaxPossible[domain] = maxPossible;
  }

  // Normalize: domain score = (actual / maxPossible) * 100
  // Then scale so the top domain is ~90-95
  const breakdown: Record<string, number> = {};
  let maxRatio = 0;

  for (const domain of ALL_DOMAINS) {
    const maxP = domainMaxPossible[domain];
    const ratio = maxP > 0 ? domainSums[domain] / maxP : 0;
    breakdown[domain] = Math.max(0, ratio); // Keep positive ratios
    maxRatio = Math.max(maxRatio, breakdown[domain]);
  }

  // Scale to 0-100 with top domain at ~95
  const scaleFactor = maxRatio > 0 ? 95 / maxRatio : 1;
  for (const domain of ALL_DOMAINS) {
    breakdown[domain] = Math.round(Math.max(0, Math.min(100, breakdown[domain] * scaleFactor)));
  }

  return breakdown as Record<TasteDomain, number>;
}

// ─── Core match computation ─────────────────────────────────────────────────

/**
 * Compute a match between a user and property using only their 400-dim vectors.
 *
 * Both vectors must be L2-normalized (as produced by vectors-v3.ts).
 * Cosine similarity = dot product of L2-normalized vectors.
 */
export function computeVectorMatch(
  userVector: number[],
  propertyVector: number[],
): VectorMatchResult {
  // Cosine similarity (dot product of L2-normalized vectors) → [-1, 1]
  const rawCosine = cosineSimilarityV3(userVector, propertyVector);

  // Map from cosine range to 0-100
  // Cosine of 1.0 = perfect match → 100
  // Cosine of 0.0 = orthogonal → ~35 (still "some" overlap possible)
  // Cosine of -1.0 = opposite → 0
  // In practice, taste vectors rarely go below 0.0 (IDF + L2 norm keeps them positive-ish)
  const rawScore = Math.max(0, Math.min(100, Math.round(rawCosine * 100)));

  // Derive per-domain breakdown from cluster contributions
  const breakdown = deriveDomainBreakdown(userVector, propertyVector);

  // Find top domain
  const topDimension = ALL_DOMAINS.reduce((best, d) =>
    (breakdown[d as TasteDomain] ?? 0) > (breakdown[best as TasteDomain] ?? 0) ? d : best,
  ) as TasteDomain;

  // Compute top cluster contributions for explanation
  const topClusters = computeTopClusters(userVector, propertyVector, 5);

  // Generate explanation
  const explanation = buildExplanation(topClusters, rawScore);

  return {
    overallScore: rawScore,
    breakdown,
    topDimension,
    topClusters,
    explanation,
  };
}

// ─── DB-backed match computation ────────────────────────────────────────────

/**
 * Fetch user and property vectors from DB and compute match.
 * Returns null if either vector is missing (caller should fall back to signal scoring).
 */
export async function computeVectorMatchFromDb(
  userId: string,
  googlePlaceId: string,
): Promise<VectorMatchResult | null> {
  // Fetch both vectors in a single query
  const result = await prisma.$queryRawUnsafe<Array<{
    userVector: string | null;
    propVector: string | null;
  }>>(
    `SELECT
       (SELECT "tasteVectorV3"::text FROM "User" WHERE id = $1) as "userVector",
       (SELECT "embeddingV3"::text FROM "PlaceIntelligence"
        WHERE "googlePlaceId" = $2
          AND "status" = 'complete'
          AND "embeddingV3" IS NOT NULL
        LIMIT 1) as "propVector"`,
    userId,
    googlePlaceId,
  );

  const userVectorRaw = result[0]?.userVector;
  const propVectorRaw = result[0]?.propVector;

  if (!userVectorRaw || !propVectorRaw) {
    return null;
  }

  // Parse pgvector text format "[0.1,0.2,...]" → number[]
  const userVector = sqlToVectorV3(userVectorRaw);
  const propVector = sqlToVectorV3(propVectorRaw);

  return computeVectorMatch(userVector, propVector);
}

// ─── Top cluster decomposition ──────────────────────────────────────────────

function computeTopClusters(
  userVector: number[],
  propertyVector: number[],
  count: number,
): ClusterContribution[] {
  const allLabels = getAllClusterLabels();
  const labelMap = new Map(allLabels.map((c) => [c.id, c]));

  // Compute per-cluster contribution
  const contributions: Array<{ idx: number; contribution: number }> = [];
  for (let i = 0; i < VECTOR_DIM_V3; i++) {
    const contribution = userVector[i] * propertyVector[i];
    if (contribution > 0) {
      contributions.push({ idx: i, contribution });
    }
  }

  // Sort by contribution descending
  contributions.sort((a, b) => b.contribution - a.contribution);

  return contributions.slice(0, count).map(({ idx, contribution }) => {
    const info = labelMap.get(idx);
    return {
      clusterId: idx,
      label: info?.label ?? `cluster-${idx}`,
      domain: info?.domain ?? 'Unknown',
      contribution,
      topSignals: getTopSignalsForCluster(idx),
    };
  });
}

function getTopSignalsForCluster(clusterId: number): string[] {
  const allLabels = getAllClusterLabels();
  // getAllClusterLabels doesn't include topSignals, so we need raw cluster data
  // For now, return the label as a proxy — we'll enrich this when we integrate
  // with the full cluster metadata
  const clusterMap = require('@/lib/taste-intelligence/signal-clusters.json');
  const info = clusterMap.clusters?.[String(clusterId)];
  return info?.topSignals?.slice(0, 3) ?? [];
}

// ─── Explanation generation ─────────────────────────────────────────────────

function buildExplanation(
  topClusters: ClusterContribution[],
  overallScore: number,
): MatchExplanation {
  const clusters = topClusters.map((c) => ({
    label: c.label,
    domain: c.domain,
    score: Math.round(c.contribution * 1000), // Scale for readability
    signals: c.topSignals,
  }));

  // Generate natural language narrative
  const parts: string[] = [];

  if (topClusters.length > 0) {
    const top = topClusters[0];
    const signalStr = top.topSignals.slice(0, 2).join(' and ');
    parts.push(
      `Strong alignment on ${top.label.toLowerCase()}` +
      (signalStr ? ` — you both value ${signalStr}` : ''),
    );
  }

  if (topClusters.length > 1) {
    const second = topClusters[1];
    parts.push(`Also resonates with your taste for ${second.label.toLowerCase()}`);
  }

  if (topClusters.length > 2) {
    const domains = [...new Set(topClusters.slice(2).map((c) => c.domain))];
    if (domains.length > 0) {
      parts.push(`Additional overlap in ${domains.join(', ')}`);
    }
  }

  return {
    topClusters: clusters,
    narrative: parts.join('. ') + '.',
  };
}

// ─── Per-user score normalization ───────────────────────────────────────────

/**
 * Curve raw vector cosine scores into user-friendly display range.
 *
 * Same algorithm as taste-match-v3's normalizeScoresForDisplay:
 * - Top match maps to ceiling (default 93)
 * - Lowest match maps to floor (default 35)
 * - Power curve (exponent 0.7) stretches the top end
 */
export function normalizeVectorScoresForDisplay<T extends { overallScore: number }>(
  scores: T[],
  ceiling = 93,
  floor = 35,
): T[] {
  if (scores.length === 0) return scores;
  if (scores.length === 1) {
    return [{ ...scores[0], overallScore: ceiling }];
  }

  const rawScores = scores.map((s) => s.overallScore);
  const maxRaw = Math.max(...rawScores);
  const minRaw = Math.min(...rawScores);
  const rawRange = maxRaw - minRaw;

  if (rawRange === 0) {
    return scores.map((s) => ({ ...s, overallScore: ceiling }));
  }

  const displayRange = ceiling - floor;

  return scores.map((s) => {
    const pct = (s.overallScore - minRaw) / rawRange;
    // Power curve: exponent < 1 stretches top end
    const curved = Math.pow(pct, 0.7);
    const displayScore = Math.round(floor + curved * displayRange);
    return { ...s, overallScore: Math.max(floor, Math.min(ceiling, displayScore)) };
  });
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/** Parse pgvector text format "[0.1,0.2,...]" → number[] */
function sqlToVectorV3(text: string): number[] {
  const cleaned = text.replace(/[\[\]]/g, '');
  return cleaned.split(',').map(Number);
}

/**
 * Convert a VectorMatchResult breakdown to the 0-1 normalized format
 * used by SavedPlace.matchBreakdown in the database.
 */
export function breakdownToNormalized(breakdown: Record<TasteDomain, number>): Record<string, number> {
  const normalized: Record<string, number> = {};
  for (const [domain, score] of Object.entries(breakdown)) {
    normalized[domain] = Math.round(score) / 100;
  }
  return normalized;
}
