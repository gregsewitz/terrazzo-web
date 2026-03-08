/**
 * PE-10: Evaluation Harness
 *
 * Compares vector-based vs. signal-only recommendations to measure
 * embedding quality and track improvements over time.
 *
 * Metrics:
 * - Overlap@K: How many of the top-K vector results appear in top-K signal results
 * - Rank correlation: Spearman correlation between vector and signal rankings
 * - Coverage: % of candidates that have embeddings
 * - Score distribution: Statistical summary of blended vs. signal-only scores
 */

import { prisma } from '@/lib/prisma';
import {
  fetchCandidateProperties,
  scoreAllCandidates,
  scoreWithVectors,
} from '../discover-candidates';
import type { TasteProfile, TasteDomain, TasteContradiction } from '@/types';
import { ALL_TASTE_DOMAINS } from '@/types';
import { DEFAULT_USER_PROFILE } from '../taste-match-v3';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EvaluationResult {
  userId: string;
  candidateCount: number;
  embeddingCoverage: number; // 0-1: % of candidates with embeddings
  vectorEnabled: boolean;

  // Overlap metrics
  overlapAt5: number;   // 0-1: overlap in top-5
  overlapAt10: number;  // 0-1: overlap in top-10
  overlapAt20: number;  // 0-1: overlap in top-20

  // Score distribution
  signalOnly: ScoreDistribution;
  vectorEnhanced: ScoreDistribution;
  blendedDelta: number; // avg blended score - avg signal score

  // Rank correlation (Spearman)
  rankCorrelation: number;

  timestamp: string;
}

interface ScoreDistribution {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function computeDistribution(scores: number[]): ScoreDistribution {
  if (scores.length === 0) {
    return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0, p25: 0, p75: 0 };
  }
  const sorted = [...scores].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;

  return {
    mean: Math.round(mean * 100) / 100,
    median: sorted[Math.floor(n / 2)],
    stdDev: Math.round(Math.sqrt(variance) * 100) / 100,
    min: sorted[0],
    max: sorted[n - 1],
    p25: sorted[Math.floor(n * 0.25)],
    p75: sorted[Math.floor(n * 0.75)],
  };
}

/**
 * Spearman rank correlation between two ranked lists.
 * Returns value in [-1, 1] where 1 = perfect agreement.
 */
function spearmanCorrelation(
  ranking1: string[], // ordered list of IDs
  ranking2: string[], // ordered list of IDs
): number {
  // Build rank maps for the intersection
  const set1 = new Set(ranking1);
  const set2 = new Set(ranking2);
  const common = ranking1.filter((id) => set2.has(id));

  if (common.length < 2) return 0;

  const rank1 = new Map(ranking1.map((id, i) => [id, i + 1]));
  const rank2 = new Map(ranking2.map((id, i) => [id, i + 1]));

  let dSquaredSum = 0;
  for (const id of common) {
    const d = (rank1.get(id) ?? 0) - (rank2.get(id) ?? 0);
    dSquaredSum += d * d;
  }

  const n = common.length;
  return 1 - (6 * dSquaredSum) / (n * (n * n - 1));
}

// ─── Main Evaluation Function ───────────────────────────────────────────────

/**
 * Run a full evaluation comparing vector-based vs. signal-only recommendations
 * for a specific user.
 */
export async function evaluateUser(userId: string): Promise<EvaluationResult> {
  // 1. Load user profile
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      tasteProfile: true,
      allSignals: true,
    },
  });

  if (!user?.tasteProfile) {
    throw new Error(`User ${userId} has no generated taste profile`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = user.tasteProfile as any;
  const userMicroSignals = profile.microTasteSignals || {};
  const userContradictions: TasteContradiction[] = profile.contradictions || [];
  const userTasteProfile: TasteProfile = { ...DEFAULT_USER_PROFILE };

  // Map radar data to taste profile (axes are v2 domain names directly)
  const validDomains = new Set<string>(ALL_TASTE_DOMAINS);
  for (const r of profile.radarData || []) {
    if (validDomains.has(r.axis)) {
      userTasteProfile[r.axis as TasteDomain] = Math.max(userTasteProfile[r.axis as TasteDomain], r.value);
    }
  }

  // 2. Fetch candidates
  const candidates = await fetchCandidateProperties();

  // 3. Signal-only scoring
  const signalResults = scoreAllCandidates(
    candidates, userTasteProfile, userMicroSignals, userContradictions,
  );

  // 4. Vector-enhanced scoring
  const { results: vectorResults, vectorEnabled } = await scoreWithVectors(
    userId, candidates, userTasteProfile, userMicroSignals, userContradictions,
  );

  // 5. Compute metrics
  const signalRanking = signalResults.map((c) => c.googlePlaceId);
  const vectorRanking = vectorResults.map((c) => c.googlePlaceId);

  const overlapAtK = (k: number): number => {
    const signalTopK = new Set(signalRanking.slice(0, k));
    const vectorTopK = vectorRanking.slice(0, k);
    const overlap = vectorTopK.filter((id) => signalTopK.has(id)).length;
    return overlap / k;
  };

  const signalScores = signalResults.map((c) => c.overallScore);
  const vectorScores = vectorResults.map((c) => c.overallScore);
  const embeddingCoverage = vectorResults.filter((c) => c.vectorScore !== undefined).length / Math.max(candidates.length, 1);

  return {
    userId,
    candidateCount: candidates.length,
    embeddingCoverage,
    vectorEnabled,
    overlapAt5: overlapAtK(Math.min(5, candidates.length)),
    overlapAt10: overlapAtK(Math.min(10, candidates.length)),
    overlapAt20: overlapAtK(Math.min(20, candidates.length)),
    signalOnly: computeDistribution(signalScores),
    vectorEnhanced: computeDistribution(vectorScores),
    blendedDelta: computeDistribution(vectorScores).mean - computeDistribution(signalScores).mean,
    rankCorrelation: spearmanCorrelation(signalRanking, vectorRanking),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Run evaluation across all onboarded users and return aggregate stats.
 */
export async function evaluateAll(): Promise<{
  userResults: EvaluationResult[];
  aggregate: {
    avgOverlapAt10: number;
    avgRankCorrelation: number;
    avgBlendedDelta: number;
    avgEmbeddingCoverage: number;
    vectorEnabledRate: number;
  };
}> {
  const users = await prisma.user.findMany({
    where: { isOnboardingComplete: true },
    select: { id: true },
  });

  const userResults: EvaluationResult[] = [];

  for (const u of users) {
    try {
      const result = await evaluateUser(u.id);
      userResults.push(result);
    } catch (err) {
      console.error(`[eval] Failed for user ${u.id}:`, err);
    }
  }

  const n = userResults.length || 1;
  return {
    userResults,
    aggregate: {
      avgOverlapAt10: userResults.reduce((s, r) => s + r.overlapAt10, 0) / n,
      avgRankCorrelation: userResults.reduce((s, r) => s + r.rankCorrelation, 0) / n,
      avgBlendedDelta: userResults.reduce((s, r) => s + r.blendedDelta, 0) / n,
      avgEmbeddingCoverage: userResults.reduce((s, r) => s + r.embeddingCoverage, 0) / n,
      vectorEnabledRate: userResults.filter((r) => r.vectorEnabled).length / n,
    },
  };
}
