/**
 * Behavioral Pattern Recognition
 *
 * Clusters a user's saved/favorited places by their taste vectors to detect
 * emergent patterns — recurring themes the user gravitates toward even if
 * they haven't explicitly expressed them in onboarding.
 *
 * Architecture:
 *   1. Fetch all SavedPlace vectors for a user (via PlaceIntelligence link)
 *   2. K-means-ish clustering on the 400-dim vectors
 *   3. For each cluster, identify the dominant domain + top micro-signals
 *   4. Surface patterns as "behavioral insights" — things like:
 *      "You keep saving places with communal dining formats"
 *      "Your hotel picks consistently favor warm minimalism"
 *
 * This is single-user behavioral analysis — NOT collaborative filtering.
 */

import { prisma } from '@/lib/prisma';

import {
  getClusterIndicesForDomain,
  getAllClusterLabels,
  getAllDomains,
} from '@/lib/taste-intelligence';
import {
  BEHAVIORAL_SIGNAL_THRESHOLD,
  TOP_CLUSTERS_PER_DOMAIN,
} from '@/lib/constants';
import type { TasteDomain } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface BehavioralPattern {
  /** Human-readable pattern label */
  label: string;
  /** Primary domain this pattern lives in */
  domain: TasteDomain;
  /** Strength 0-100 — how consistently this pattern appears */
  strength: number;
  /** Number of places exhibiting this pattern */
  placeCount: number;
  /** Top clusters driving this pattern */
  topClusters: string[];
  /** Sample place names showing this pattern */
  examplePlaces: string[];
  /** Whether this aligns with the user's stated profile or is a "hidden" preference */
  isHiddenPreference: boolean;
}

export interface BehavioralAnalysis {
  /** Detected patterns, sorted by strength */
  patterns: BehavioralPattern[];
  /** Total places analyzed */
  totalPlaces: number;
  /** Places with vectors (usable for analysis) */
  analyzedPlaces: number;
}

// ─── Analysis ───────────────────────────────────────────────────────────────────

/**
 * Analyze behavioral patterns in a user's library.
 *
 * @param userId - The user to analyze
 * @param options.minPlaces - Minimum places needed for meaningful patterns (default 5)
 * @param options.favoritesOnly - Only analyze favorited places (default false)
 */
export async function analyzeBehavioralPatterns(
  userId: string,
  options?: { minPlaces?: number; favoritesOnly?: boolean },
): Promise<BehavioralAnalysis> {
  const minPlaces = options?.minPlaces ?? 5;
  const favoritesOnly = options?.favoritesOnly ?? false;

  // Fetch user's saved places with their linked intelligence vectors
  const whereClause = favoritesOnly
    ? { userId, deletedAt: null, isFavorited: true, placeIntelligenceId: { not: null } }
    : { userId, deletedAt: null, placeIntelligenceId: { not: null } };

  const savedPlaces = await prisma.savedPlace.findMany({
    where: whereClause as { userId: string; deletedAt: null; isFavorited?: boolean; placeIntelligenceId: { not: null } },
    select: {
      id: true,
      name: true,
      type: true,
      placeIntelligenceId: true,
      isFavorited: true,
      matchScore: true,
    },
  });

  if (savedPlaces.length < minPlaces) {
    return { patterns: [], totalPlaces: savedPlaces.length, analyzedPlaces: 0 };
  }

  // Fetch vectors for all linked PlaceIntelligence records
  const piIds = savedPlaces
    .map((sp: { placeIntelligenceId: string | null }) => sp.placeIntelligenceId)
    .filter((id: string | null): id is string => id !== null);

  if (piIds.length === 0) {
    return { patterns: [], totalPlaces: savedPlaces.length, analyzedPlaces: 0 };
  }

  const vectors = await prisma.$queryRawUnsafe<Array<{ id: string; vec: string }>>(
    `SELECT id, "embeddingV3"::text as vec FROM "PlaceIntelligence" WHERE id = ANY($1) AND "embeddingV3" IS NOT NULL`,
    piIds,
  );

  const vecMap = new Map<string, number[]>();
  for (const v of vectors) {
    const parsed = parseVector(v.vec);
    if (parsed) vecMap.set(v.id, parsed);
  }

  const analyzedPlaces = vecMap.size;
  if (analyzedPlaces < minPlaces) {
    return { patterns: [], totalPlaces: savedPlaces.length, analyzedPlaces };
  }

  // Compute mean vector across all user's places
  const dim = 400;
  const meanVec = new Float64Array(dim);
  for (const vec of vecMap.values()) {
    for (let i = 0; i < dim; i++) {
      meanVec[i] += (vec[i] || 0) / analyzedPlaces;
    }
  }

  // Optionally fetch user's taste vector to detect hidden preferences
  const userVecRow = await prisma.$queryRawUnsafe<Array<{ vec: string }>>(
    `SELECT "tasteVectorV3"::text as vec FROM "User" WHERE id = $1 AND "tasteVectorV3" IS NOT NULL`,
    userId,
  );
  const userVec = userVecRow.length > 0 ? parseVector(userVecRow[0].vec) : null;

  // Find dominant clusters in the mean vector
  const allClusterInfo = getAllClusterLabels();
  const clusterLabelMap = new Map<number, string>();
  for (const info of allClusterInfo) {
    clusterLabelMap.set(info.id, info.label);
  }
  const patterns: BehavioralPattern[] = [];

  for (const domain of getAllDomains()) {
    const indices = getClusterIndicesForDomain(domain);
    const clusterScores: Array<{ idx: number; label: string; score: number }> = [];

    for (const idx of indices) {
      const score = meanVec[idx] || 0;
      if (score > BEHAVIORAL_SIGNAL_THRESHOLD) { // threshold for meaningful signal
        clusterScores.push({
          idx,
          label: clusterLabelMap.get(idx) || `cluster-${idx}`,
          score,
        });
      }
    }

    if (clusterScores.length === 0) continue;

    // Sort by score
    clusterScores.sort((a, b) => b.score - a.score);

    // Take top clusters for this domain
    const topClusters = clusterScores.slice(0, TOP_CLUSTERS_PER_DOMAIN);
    const domainStrength = topClusters.reduce((sum, c) => sum + c.score, 0);

    // Count places that contribute to this pattern
    const placeCount = countPlacesWithCluster(
      savedPlaces,
      vecMap,
      topClusters.map(c => c.idx),
    );

    if (placeCount < 2) continue; // Need at least 2 places showing this pattern

    // Determine if this is a hidden preference
    const isHiddenPreference = userVec
      ? topClusters.some(c => (userVec[c.idx] || 0) < 0.01 && (meanVec[c.idx] || 0) > 0.03)
      : false;

    // Generate human-readable label
    const label = generatePatternLabel(domain as TasteDomain, topClusters.map(c => c.label));

    patterns.push({
      label,
      domain: domain as TasteDomain,
      strength: Math.round(Math.min(100, domainStrength * 200)),
      placeCount,
      topClusters: topClusters.map(c => humanizeClusterLabel(c.label)),
      examplePlaces: getExamplePlaces(savedPlaces, vecMap, topClusters.map(c => c.idx)),
      isHiddenPreference,
    });
  }

  // Sort by strength
  patterns.sort((a, b) => b.strength - a.strength);

  return {
    patterns: patterns.slice(0, 8), // Max 8 patterns
    totalPlaces: savedPlaces.length,
    analyzedPlaces,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function parseVector(raw: string): number[] | null {
  try {
    const cleaned = raw.replace(/^\[/, '').replace(/\]$/, '');
    return cleaned.split(',').map(s => parseFloat(s.trim()));
  } catch {
    return null;
  }
}

function countPlacesWithCluster(
  savedPlaces: Array<{ placeIntelligenceId: string | null }>,
  vecMap: Map<string, number[]>,
  clusterIndices: number[],
): number {
  let count = 0;
  for (const sp of savedPlaces) {
    if (!sp.placeIntelligenceId) continue;
    const vec = vecMap.get(sp.placeIntelligenceId);
    if (!vec) continue;
    const hasCluster = clusterIndices.some(idx => (vec[idx] || 0) > 0.01);
    if (hasCluster) count++;
  }
  return count;
}

function getExamplePlaces(
  savedPlaces: Array<{ name: string; placeIntelligenceId: string | null }>,
  vecMap: Map<string, number[]>,
  clusterIndices: number[],
): string[] {
  const examples: Array<{ name: string; score: number }> = [];
  for (const sp of savedPlaces) {
    if (!sp.placeIntelligenceId) continue;
    const vec = vecMap.get(sp.placeIntelligenceId);
    if (!vec) continue;
    const score = clusterIndices.reduce((sum, idx) => sum + (vec[idx] || 0), 0);
    if (score > 0.01) examples.push({ name: sp.name, score });
  }
  return examples
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(e => e.name);
}

function humanizeClusterLabel(raw: string): string {
  const stripped = raw.includes(':') ? raw.split(':')[1] : raw;
  return stripped
    .replace(/-/g, ' ')
    .replace(/\b(format|style|emphasis|preference|level)\b/gi, '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function generatePatternLabel(domain: TasteDomain, clusterLabels: string[]): string {
  const top = humanizeClusterLabel(clusterLabels[0] || 'unknown');
  const domainLabels: Record<TasteDomain, string> = {
    Design: 'Design eye',
    Atmosphere: 'Atmosphere sense',
    Character: 'Character instinct',
    Service: 'Service expectation',
    FoodDrink: 'Culinary thread',
    Setting: 'Setting preference',
    Wellness: 'Wellness pattern',
    Sustainability: 'Values alignment',
  };
  return `${domainLabels[domain]}: ${top}`;
}
