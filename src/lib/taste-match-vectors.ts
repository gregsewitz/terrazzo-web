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

/**
 * Noise/infrastructure cluster IDs — these represent operational or environmental
 * attributes rather than taste preferences. They're excluded from match explanations
 * because surfacing "street-noise-penetration" or "mosquito-management" as a match
 * reason confuses users even if the vectors align on those dimensions.
 *
 * These clusters DO still participate in scoring (they affect cosine similarity),
 * they're just filtered from the explanation/narrative layer.
 */
const NOISE_CLUSTER_IDS = new Set([
  5,    // adjacent-exposure-from (noise, construction complaints)
  7,    // fire-high-pace (high-turnover-pressure)
  13,   // balance-control-dependent (weather/temperature issues)
  15,   // challenge-experience-grounds (mosquito management)
  16,   // density-high-operation (high-density seating, overflow)
  28,   // crowd-crowding-dependent (weekend crowding)
  44,   // acceptance-culture-expectation (queue culture)
  50,   // concerns-environment-high (high noise level)
  88,   // challenges-control-heated (temperature control challenges)
  109,  // cellular-connectivity-issues (wifi issues)
  125,  // culture-execution-high (inconsistent execution, turnover)
  131,  // buggy-intentionally-remote (buggy transport)
  135,  // cash-coordination-only (cash-only, parking)
  138,  // design-dual-issues (shower water pressure issues)
  143,  // access-accessibility-challenge (steep hillside challenge)
  163,  // communal-cramped-layout (cramped seating)
  164,  // between-construction-noise (noise transfer, thin walls)
  166,  // building-campus-elevator (slow elevator)
  181,  // challenges-control-inconsistent (room temperature issues)
  184,  // anti-connectivity-philosophy (wifi problems)
  249,  // execution-inconsistent-pacing (inconsistent service)
  266,  // deposit-difficulty-policy (reservation difficulty)
  305,  // capacity-controlled-elevator (elevator wait times)
  316,  // management-multi-progression (queue management)
  324,  // high-model-pressure (table turnover pressure)
]);

/**
 * Compute a "baseline" profile for a user vector — the expected contribution
 * per cluster if a property had uniform activation. Used to identify which
 * clusters are *distinctive* for a given property vs just globally strong.
 *
 * Cached per user vector identity (first 3 dims as a quick fingerprint).
 */
let cachedBaselineKey = '';
let cachedBaseline: number[] = [];

function getUserBaseline(userVector: number[]): number[] {
  const key = `${userVector[0].toFixed(6)}_${userVector[1].toFixed(6)}_${userVector[2].toFixed(6)}`;
  if (key === cachedBaselineKey) return cachedBaseline;

  // Baseline = abs(userVector[i]) for each cluster — represents how much
  // the user cares about each cluster regardless of property
  const baseline = new Array(VECTOR_DIM_V3);
  for (let i = 0; i < VECTOR_DIM_V3; i++) {
    baseline[i] = Math.abs(userVector[i]);
  }
  cachedBaselineKey = key;
  cachedBaseline = baseline;
  return baseline;
}

function computeTopClusters(
  userVector: number[],
  propertyVector: number[],
  count: number,
): ClusterContribution[] {
  const allLabels = getAllClusterLabels();
  const labelMap = new Map(allLabels.map((c) => [c.id, c]));
  const baseline = getUserBaseline(userVector);

  // Compute per-cluster contribution, filtering out noise clusters
  // Use "distinctiveness" scoring: weight by how strong the PROPERTY is on
  // this cluster relative to the user's baseline. This surfaces what makes
  // this property special for the user, not just globally-dominant clusters.
  const contributions: Array<{ idx: number; contribution: number; distinctiveness: number }> = [];
  for (let i = 0; i < VECTOR_DIM_V3; i++) {
    if (NOISE_CLUSTER_IDS.has(i)) continue;
    const contribution = userVector[i] * propertyVector[i];
    if (contribution > 0 && baseline[i] > 0.001) {
      // distinctiveness = how strong the property is on this dimension
      // relative to the user's strength. High = property is especially
      // strong here; low = property is about as strong as user expects.
      const propertyStrength = Math.abs(propertyVector[i]);
      const distinctiveness = contribution * (propertyStrength / baseline[i]);
      contributions.push({ idx: i, contribution, distinctiveness });
    }
  }

  // Sort by distinctiveness — surfaces what makes THIS property special
  contributions.sort((a, b) => b.distinctiveness - a.distinctiveness);

  // Ensure domain diversity: pick top clusters but avoid >2 from same domain
  const result: ClusterContribution[] = [];
  const domainCount: Record<string, number> = {};

  for (const { idx, contribution } of contributions) {
    if (result.length >= count) break;
    const info = labelMap.get(idx);
    const domain = info?.domain ?? 'Unknown';

    if ((domainCount[domain] ?? 0) >= 2) continue;
    domainCount[domain] = (domainCount[domain] ?? 0) + 1;

    result.push({
      clusterId: idx,
      label: info?.label ?? `cluster-${idx}`,
      domain,
      contribution,
      topSignals: getTopSignalsForCluster(idx),
    });
  }

  return result;
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

/**
 * Clean a raw cluster label like "Atmosphere:atmosphere-communal-dining"
 * into a human-readable form like "communal dining atmosphere".
 */
function humanizeClusterLabel(rawLabel: string): string {
  // Strip domain prefix (e.g. "Atmosphere:" or "Character:")
  const stripped = rawLabel.includes(':') ? rawLabel.split(':').slice(1).join(':') : rawLabel;
  // Remove the domain echo at the start (e.g. "atmosphere-communal-dining" → "communal-dining")
  const domainPrefixes = ['atmosphere-', 'character-', 'design-', 'service-', 'setting-', 'fooddrink-', 'wellness-', 'sustainability-'];
  let cleaned = stripped.toLowerCase();
  for (const prefix of domainPrefixes) {
    if (cleaned.startsWith(prefix)) {
      cleaned = cleaned.slice(prefix.length);
      break;
    }
  }
  // Convert hyphens to spaces
  return cleaned.replace(/-/g, ' ').trim();
}

/**
 * Clean a raw signal name like "communal-dining-format" → "communal dining"
 */
function humanizeSignal(signal: string): string {
  return signal
    .replace(/-/g, ' ')
    .replace(/\b(format|model|philosophy|positioning|aesthetic|ritual|program|programming|structure|operation|style|emphasis|approach|driven|focused|based|oriented)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

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

  // Generate natural language narrative from diverse clusters
  const parts: string[] = [];

  if (topClusters.length > 0) {
    const top = topClusters[0];
    const humanLabel = humanizeClusterLabel(top.label);
    const humanSignals = top.topSignals.slice(0, 2).map(humanizeSignal).filter(Boolean);
    const signalStr = humanSignals.length > 0 ? humanSignals.join(' and ') : '';

    parts.push(
      `Strong match on ${humanLabel}` +
      (signalStr ? ` — shared appreciation for ${signalStr}` : ''),
    );
  }

  if (topClusters.length > 1) {
    const second = topClusters[1];
    const humanLabel = humanizeClusterLabel(second.label);
    const humanSignals = second.topSignals.slice(0, 1).map(humanizeSignal).filter(Boolean);
    parts.push(
      `Also aligns with your ${humanLabel}${humanSignals.length > 0 ? ` sensibility (${humanSignals[0]})` : ''} taste`,
    );
  }

  // Mention additional domains that appear in remaining clusters (if different from top 2)
  if (topClusters.length > 2) {
    const topDomains = new Set(topClusters.slice(0, 2).map((c) => c.domain));
    const additionalDomains = [...new Set(topClusters.slice(2).map((c) => c.domain))]
      .filter((d) => !topDomains.has(d));
    if (additionalDomains.length > 0) {
      parts.push(`Further overlap in ${additionalDomains.join(' and ')}`);
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
 * Uses z-score normalization to preserve relative differences even when
 * the raw score range is narrow (e.g., all cosines between 0.60–0.85).
 *
 * Algorithm:
 *   1. Compute mean and stddev of raw scores
 *   2. Convert each score to z-score (stddevs from mean)
 *   3. Map z-scores to display range via sigmoid-like curve
 *   4. Center the display range around the median (~65 display score)
 *
 * This replaces the previous min-max approach which compressed scores
 * when all raw cosines clustered in a narrow band.
 */
export function normalizeVectorScoresForDisplay<T extends { overallScore: number }>(
  scores: T[],
  ceiling = 93,
  floor = 35,
): T[] {
  if (scores.length === 0) return scores;
  if (scores.length === 1) {
    return [{ ...scores[0], overallScore: Math.round((ceiling + floor) / 2 + 10) }];
  }

  const rawScores = scores.map((s) => s.overallScore);
  const n = rawScores.length;

  // Compute mean and stddev
  const mean = rawScores.reduce((a, b) => a + b, 0) / n;
  const variance = rawScores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);

  // Edge case: all scores identical
  if (stddev < 0.1) {
    return scores.map((s) => ({ ...s, overallScore: Math.round((ceiling + floor) / 2 + 10) }));
  }

  const displayRange = ceiling - floor;
  // Median display score — where an average property lands
  const medianDisplay = floor + displayRange * 0.50; // ~64 for default floor=35, ceil=93

  return scores.map((s) => {
    // Z-score: how many stddevs above/below mean
    const z = (s.overallScore - mean) / stddev;

    // Sigmoid-like mapping: z=0 → median, z=+2 → near ceiling, z=-2 → near floor
    // tanh gives us a nice smooth curve in [-1, 1]
    // Spread factor 0.8 gives better separation:
    //   z=+2  → tanh(1.6)=0.92 → display ~91
    //   z=+1  → tanh(0.8)=0.66 → display ~83
    //   z=0   → tanh(0)=0      → display ~64
    //   z=-1  → tanh(-0.8)=-0.66 → display ~45
    //   z=-2  → tanh(-1.6)=-0.92 → display ~37
    const curved = Math.tanh(z * 0.8);

    const displayScore = Math.round(medianDisplay + curved * (displayRange * 0.50));
    return { ...s, overallScore: Math.max(floor, Math.min(ceiling, displayScore)) };
  });
}

// ─── Single-score normalization ──────────────────────────────────────────────

/**
 * Normalize a single raw vector cosine score into the same 35-93 display range
 * used by the discover feed's batch normalization.
 *
 * Since we don't have a batch to compute z-scores against, we fetch the
 * population mean and stddev of this user's cosine similarities against all
 * enriched properties. These are the same statistics the batch normalizer
 * would see if it scored every property.
 *
 * Falls back to a fixed mapping if population stats can't be computed.
 */
export async function normalizeSingleVectorScore(
  rawScore: number,
  userId: string,
  ceiling = 93,
  floor = 35,
): Promise<number> {
  try {
    // Fetch user vector and compute population stats in one query
    const stats = await prisma.$queryRawUnsafe<Array<{
      mean: number | null;
      stddev: number | null;
      cnt: number;
    }>>(
      `WITH uv AS (
        SELECT "tasteVectorV3" as vec FROM "User" WHERE id = $1
      )
      SELECT
        AVG((1 - (pi."embeddingV3" <=> uv.vec)) * 100)::float as mean,
        STDDEV((1 - (pi."embeddingV3" <=> uv.vec)) * 100)::float as stddev,
        COUNT(*)::int as cnt
      FROM "PlaceIntelligence" pi, uv
      WHERE pi.status = 'complete'
        AND pi."embeddingV3" IS NOT NULL`,
      userId,
    );

    const { mean, stddev, cnt } = stats[0] || {};

    if (!mean || !stddev || stddev < 0.1 || !cnt || cnt < 5) {
      // Not enough data for meaningful normalization — use fixed midpoint
      return Math.round((ceiling + floor) / 2 + 10);
    }

    // Same tanh curve as normalizeVectorScoresForDisplay
    const displayRange = ceiling - floor;
    const medianDisplay = floor + displayRange * 0.50;
    const z = (rawScore - mean) / stddev;
    const curved = Math.tanh(z * 0.8);
    const displayScore = Math.round(medianDisplay + curved * (displayRange * 0.50));
    return Math.max(floor, Math.min(ceiling, displayScore));
  } catch (err) {
    console.error('[normalizeSingleVectorScore] Error computing population stats:', err);
    // Fallback: fixed midpoint
    return Math.round((ceiling + floor) / 2 + 10);
  }
}

// ─── Client-safe score normalization (no DB) ────────────────────────────────

/**
 * Pure function to normalize a raw cosine×100 matchScore into the 35-93
 * display range. Uses hardcoded population stats so it can run client-side
 * without a DB call. Same tanh curve as the batch/single normalizers above.
 *
 * Population stats are updated periodically; current values are from the
 * v3.6 backfill (Mar 2026).
 */
export function normalizeMatchScoreForDisplay(
  rawScore: number,
  ceiling = 93,
  floor = 35,
): number {
  // Hardcoded population stats (mean/stddev of cosine×100 across all user-property pairs)
  // Updated after v3.6 backfill — regenerate via:
  //   SELECT AVG((1-(u."tasteVectorV3" <=> pi."embeddingV3"))*100), STDDEV(...)
  //   FROM "User" u, "PlaceIntelligence" pi WHERE both vectors NOT NULL
  const POPULATION_MEAN = 7;
  const POPULATION_STDDEV = 8.5;

  if (POPULATION_STDDEV < 0.1) return Math.round((ceiling + floor) / 2 + 10);

  const displayRange = ceiling - floor;
  const medianDisplay = floor + displayRange * 0.50;
  const z = (rawScore - POPULATION_MEAN) / POPULATION_STDDEV;
  const curved = Math.tanh(z * 0.8);
  const displayScore = Math.round(medianDisplay + curved * (displayRange * 0.50));
  return Math.max(floor, Math.min(ceiling, displayScore));
}

// ─── Batch rescore for a user ────────────────────────────────────────────────

export interface RescoreResult {
  total: number;
  scored: number;
  skipped: number;
  vectorDrift: number | null; // cosine distance from previous vector, if applicable
}

/**
 * Rescore ALL saved places for a user using V3 vector matching.
 *
 * Called after onboarding or "expand your mosaic" sessions whenever
 * the user's taste vector may have changed.
 *
 * Flow:
 *   1. Fetch user's V3 vector
 *   2. Fetch all SavedPlaces with enriched PlaceIntelligence (embeddingV3 present)
 *   3. Compute raw vector matches for each
 *   4. Normalize scores across the full set
 *   5. Write matchScore + matchBreakdown + matchExplanation to DB
 */
export async function rescoreAllSavedPlacesV3(userId: string): Promise<RescoreResult> {
  // 1. Fetch user vector
  const userRow = await prisma.$queryRawUnsafe<Array<{ vec: string | null }>>(
    `SELECT "tasteVectorV3"::text as vec FROM "User" WHERE id = $1`,
    userId,
  );
  const userVecRaw = userRow[0]?.vec;
  if (!userVecRaw) {
    console.warn(`[rescore] User ${userId} has no V3 vector — skipping`);
    return { total: 0, scored: 0, skipped: 0, vectorDrift: null };
  }
  const userVector = sqlToVectorV3(userVecRaw);

  // 2. Fetch all saved places with enriched property vectors
  const places = await prisma.$queryRawUnsafe<
    Array<{ spId: string; googlePlaceId: string; propVec: string }>
  >(
    `SELECT sp.id as "spId", sp."googlePlaceId", pi."embeddingV3"::text as "propVec"
     FROM "SavedPlace" sp
     JOIN "PlaceIntelligence" pi ON pi."googlePlaceId" = sp."googlePlaceId"
     WHERE sp."userId" = $1
       AND pi."status" = 'complete'
       AND pi."embeddingV3" IS NOT NULL`,
    userId,
  );

  console.log(`[rescore] User ${userId}: ${places.length} places with V3 embeddings`);

  // 3. Compute raw matches
  const rawMatches: Array<{
    spId: string;
    result: VectorMatchResult;
  }> = [];

  for (const place of places) {
    try {
      const propVector = sqlToVectorV3(place.propVec);
      const result = computeVectorMatch(userVector, propVector);
      rawMatches.push({ spId: place.spId, result });
    } catch (err) {
      console.error(`[rescore] Failed for ${place.googlePlaceId}:`, err);
    }
  }

  // 4. Normalize scores across the full set
  const normalized = normalizeVectorScoresForDisplay(
    rawMatches.map((m) => ({ spId: m.spId, result: m.result, overallScore: m.result.overallScore })),
  );

  // 5. Write to DB in batches
  let scored = 0;
  for (const match of normalized) {
    const raw = rawMatches.find((m) => m.spId === match.spId);
    if (!raw) continue;

    try {
      await prisma.savedPlace.update({
        where: { id: match.spId },
        data: {
          matchScore: match.overallScore,
          matchBreakdown: breakdownToNormalized(raw.result.breakdown),
          matchExplanation: raw.result.explanation,
        } as any,
      });
      scored++;
    } catch (err) {
      console.error(`[rescore] DB write failed for ${match.spId}:`, err);
    }
  }

  console.log(`[rescore] Done: ${scored} scored, ${places.length - scored} skipped`);
  return {
    total: places.length,
    scored,
    skipped: places.length - scored,
    vectorDrift: null,
  };
}

/**
 * Compute cosine distance between two vectors.
 * Returns 0 if identical, 2 if opposite. Useful for drift detection.
 */
export function vectorDrift(a: number[], b: number[]): number {
  if (a.length !== b.length) return 2;
  const cosine = cosineSimilarityV3(a, b);
  return 1 - cosine; // 0 = identical, 1 = orthogonal, 2 = opposite
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
