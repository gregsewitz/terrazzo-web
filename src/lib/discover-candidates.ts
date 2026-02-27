/**
 * Discover Candidates — retrieval and scoring layer for RAG-grounded discover feed.
 *
 * Fetches enriched PlaceIntelligence records, scores them against a user's taste profile,
 * and returns ranked candidates with the specific signals that drove each match.
 */

import { prisma } from '@/lib/prisma';
import { computeMatchFromSignals } from '@/lib/taste-match';
import {
  findSimilarProperties,
  sqlToVector,
} from '@/lib/taste-intelligence';
import type {
  TasteDomain,
  TasteProfile,
  TasteContradiction,
  BriefingSignal,
  BriefingAntiSignal,
} from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CandidateProperty {
  googlePlaceId: string;
  propertyName: string;
  signals: BriefingSignal[];
  antiSignals: BriefingAntiSignal[];
  facts: Record<string, unknown> | null;
  signalCount: number;
  reliabilityScore: number | null;
}

export interface ScoredCandidate extends CandidateProperty {
  overallScore: number;
  domainBreakdown: Record<TasteDomain, number>;
  topDimension: TasteDomain;
  topMatchingSignals: BriefingSignal[];
  contradictionRelevance: {
    contradiction: TasteContradiction;
    coversBothSides: boolean;
  } | null;
  /** Vector cosine similarity score (0-100), present when vectors are available */
  vectorScore?: number;
  /** Blended score combining signal-based and vector-based matching */
  blendedScore?: number;
}

// ─── In-memory cache (upgrade to Upstash Redis when traffic justifies it) ───

let _candidateCache: { data: CandidateProperty[]; expiry: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch all enriched PlaceIntelligence records that are ready for matching.
 * Results are cached in-memory for 5 minutes.
 */
export async function fetchCandidateProperties(): Promise<CandidateProperty[]> {
  // Check cache
  if (_candidateCache && Date.now() < _candidateCache.expiry) {
    return _candidateCache.data;
  }

  const records = await prisma.placeIntelligence.findMany({
    where: {
      status: 'complete',
      signalCount: { gt: 0 },
    },
    select: {
      googlePlaceId: true,
      propertyName: true,
      signals: true,
      antiSignals: true,
      facts: true,
      signalCount: true,
      reliabilityScore: true,
    },
  });

  const candidates: CandidateProperty[] = records.map((r) => ({
    googlePlaceId: r.googlePlaceId,
    propertyName: r.propertyName,
    signals: (r.signals as unknown as BriefingSignal[]) || [],
    antiSignals: (r.antiSignals as unknown as BriefingAntiSignal[]) || [],
    facts: r.facts as Record<string, unknown> | null,
    signalCount: r.signalCount,
    reliabilityScore: r.reliabilityScore,
  }));

  _candidateCache = { data: candidates, expiry: Date.now() + CACHE_TTL_MS };
  console.log(`[discover-candidates] Cached ${candidates.length} enriched properties`);

  return candidates;
}

/** Invalidate the candidate cache (call after pipeline completion). */
export function invalidateCandidateCache(): void {
  _candidateCache = null;
}

// ─── Scoring ────────────────────────────────────────────────────────────────

/**
 * Score a single candidate property against a user's full taste profile.
 *
 * Returns the existing computeMatchFromSignals score plus:
 * - The top 5 signals that drove the match (for editorial generation)
 * - Whether this property resolves any of the user's taste contradictions
 */
export function scoreCandidate(
  candidate: CandidateProperty,
  userProfile: TasteProfile,
  userMicroSignals: Record<string, string[]>,
  userContradictions: TasteContradiction[],
): ScoredCandidate {
  // Core match scoring (reuse existing logic)
  const match = computeMatchFromSignals(
    candidate.signals,
    candidate.antiSignals,
    userProfile,
  );

  // Find signals most relevant to this user's micro-signals
  const topMatchingSignals = findTopMatchingSignals(
    candidate.signals,
    userMicroSignals,
    5,
  );

  // Check contradiction resolution potential
  const contradictionRelevance = findContradictionRelevance(
    candidate.signals,
    userContradictions,
  );

  return {
    ...candidate,
    overallScore: match.overallScore,
    domainBreakdown: match.breakdown,
    topDimension: match.topDimension,
    topMatchingSignals,
    contradictionRelevance,
  };
}

/**
 * Score all candidates against a user profile. Returns sorted by overallScore descending.
 */
export function scoreAllCandidates(
  candidates: CandidateProperty[],
  userProfile: TasteProfile,
  userMicroSignals: Record<string, string[]>,
  userContradictions: TasteContradiction[],
): ScoredCandidate[] {
  return candidates
    .map((c) => scoreCandidate(c, userProfile, userMicroSignals, userContradictions))
    .sort((a, b) => b.overallScore - a.overallScore);
}

// ─── Vector-Enhanced Scoring ─────────────────────────────────────────────────

/**
 * Score candidates using both signal-based matching AND vector similarity.
 *
 * When a user has a computed tasteVector:
 * 1. Fetch top-K vector matches from pgvector (fast ANN via HNSW)
 * 2. Run signal-based scoring on those candidates
 * 3. Blend both scores: 60% vector + 40% signal (vector is more reliable)
 *
 * Falls back to pure signal-based scoring when vectors aren't available.
 */
export async function scoreWithVectors(
  userId: string,
  candidates: CandidateProperty[],
  userProfile: TasteProfile,
  userMicroSignals: Record<string, string[]>,
  userContradictions: TasteContradiction[],
): Promise<{ results: ScoredCandidate[]; vectorEnabled: boolean }> {
  // Check if this user has a taste vector
  // Note: tasteVector uses Prisma's Unsupported("vector(32)") type, so we must
  // query it via raw SQL instead of the typed client.
  const vectorResult = await prisma.$queryRaw<{ tasteVector: string | null }[]>`
    SELECT "tasteVector"::text FROM "User" WHERE id = ${userId} LIMIT 1
  `;
  const tasteVectorRaw = vectorResult[0]?.tasteVector ?? null;

  if (!tasteVectorRaw) {
    // No vector — fall back to signal-based scoring
    console.log('[discover] No taste vector for user, using signal-only scoring');
    const results = scoreAllCandidates(candidates, userProfile, userMicroSignals, userContradictions);
    return { results, vectorEnabled: false };
  }

  const userVector = sqlToVector(tasteVectorRaw);

  // Get vector-based rankings from pgvector (top 100 nearest)
  const vectorMatches = await findSimilarProperties(userVector, 100);

  // Build a lookup: googlePlaceId → vectorScore
  const vectorScoreMap = new Map<string, number>();
  for (const match of vectorMatches) {
    vectorScoreMap.set(match.googlePlaceId, match.score);
  }

  // Score all candidates with signal-based approach + blend in vector scores
  const scored = candidates.map((c) => {
    const signalScored = scoreCandidate(c, userProfile, userMicroSignals, userContradictions);
    const vectorScore = vectorScoreMap.get(c.googlePlaceId);

    if (vectorScore !== undefined) {
      // Blend: 60% vector, 40% signal
      const blended = Math.round(vectorScore * 0.6 + signalScored.overallScore * 0.4);
      return {
        ...signalScored,
        vectorScore,
        blendedScore: blended,
        overallScore: blended, // override overallScore with blended
      };
    }

    // Property has no embedding — use signal score alone
    return {
      ...signalScored,
      blendedScore: signalScored.overallScore,
    };
  });

  scored.sort((a, b) => b.overallScore - a.overallScore);

  console.log(
    `[discover] Vector-enhanced scoring: ${vectorScoreMap.size} properties with embeddings, ` +
    `${scored.filter(s => s.vectorScore !== undefined).length} candidates enriched`
  );

  return { results: scored, vectorEnabled: true };
}

// ─── Signal matching helpers ────────────────────────────────────────────────

/**
 * Find the property signals most relevant to the user's micro-signals.
 *
 * Uses simple keyword overlap between the user's micro-signal strings and
 * the property's signal strings. This is intentionally naive — once we have
 * embeddings (Phase 2), this becomes a vector similarity lookup.
 */
function findTopMatchingSignals(
  propertySignals: BriefingSignal[],
  userMicroSignals: Record<string, string[]>,
  limit: number,
): BriefingSignal[] {
  // Flatten user micro-signals into a set of lowercase keywords
  const userKeywords = new Set<string>();
  for (const signals of Object.values(userMicroSignals)) {
    for (const sig of signals) {
      // Split signal into words and normalize
      for (const word of sig.toLowerCase().split(/\s+/)) {
        if (word.length > 3) userKeywords.add(word); // skip short words
      }
    }
  }

  // Score each property signal by keyword overlap
  const scored = propertySignals.map((sig) => {
    const sigWords = sig.signal.toLowerCase().split(/\s+/);
    const overlap = sigWords.filter((w) => userKeywords.has(w)).length;
    const relevance = overlap * sig.confidence;
    return { signal: sig, relevance };
  });

  return scored
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit)
    .map((s) => s.signal);
}

/**
 * Check if a property's signals span both sides of any user contradiction.
 *
 * A property "resolves" a contradiction if it has signals relevant to both
 * the stated preference AND the revealed preference.
 */
function findContradictionRelevance(
  propertySignals: BriefingSignal[],
  userContradictions: TasteContradiction[],
): ScoredCandidate['contradictionRelevance'] {
  if (!userContradictions.length || !propertySignals.length) return null;

  const signalText = propertySignals
    .map((s) => s.signal.toLowerCase())
    .join(' ');

  let bestMatch: ScoredCandidate['contradictionRelevance'] = null;
  let bestScore = 0;

  for (const contradiction of userContradictions) {
    const statedWords = contradiction.stated.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const revealedWords = contradiction.revealed.toLowerCase().split(/\s+/).filter((w) => w.length > 3);

    const statedOverlap = statedWords.filter((w) => signalText.includes(w)).length;
    const revealedOverlap = revealedWords.filter((w) => signalText.includes(w)).length;

    const coversBothSides = statedOverlap > 0 && revealedOverlap > 0;
    const score = statedOverlap + revealedOverlap + (coversBothSides ? 5 : 0);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = { contradiction, coversBothSides };
    }
  }

  return bestScore > 0 ? bestMatch : null;
}
