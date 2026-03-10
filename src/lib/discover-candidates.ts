/**
 * Discover Candidates — retrieval and scoring layer for RAG-grounded discover feed.
 *
 * Fetches enriched PlaceIntelligence records, scores them against a user's taste profile,
 * and returns ranked candidates with the specific signals that drove each match.
 */

import { prisma } from '@/lib/prisma';
import { computeMatchFromSignals, normalizeScoresForDisplay } from '@/lib/taste-match-v3';
import type { MatchOptions } from '@/lib/taste-match-v3';
import {
  findSimilarPropertiesV3,
} from '@/lib/taste-intelligence';
import { normalizeVectorScoresForDisplay, computeVectorMatch } from '@/lib/taste-match-vectors';
import type {
  TasteDomain,
  TasteProfile,
  TasteContradiction,
  BriefingSignal,
  BriefingAntiSignal,
  SustainabilityProfile,
  SustainabilitySignal,
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
  /** Sustainability alignment score (present when user has sustainability profile) */
  sustainabilityScore?: number;
}

/** Extended scoring context for v3.2 matching */
export interface ScoringContext {
  sustainabilityProfile?: SustainabilityProfile;
  propertySustainabilitySignals?: Map<string, SustainabilitySignal[]>;
  applyDecay?: boolean;
  /** v3.2: Signal count per domain — used for signal-density weighted profile enhancement */
  userSignalDistribution?: Record<string, number>;
  /** v3.2: Keywords from user's rejection signals — triggers anti-keyword penalty */
  userRejectionKeywords?: string[];
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
  scoringContext?: ScoringContext,
): ScoredCandidate {
  // Build match options from scoring context (v3.2)
  const matchOptions: MatchOptions = {
    userMicroSignals,
  };
  if (scoringContext?.applyDecay !== undefined) {
    matchOptions.applyDecay = scoringContext.applyDecay;
  }
  if (scoringContext?.sustainabilityProfile) {
    matchOptions.sustainabilityProfile = scoringContext.sustainabilityProfile;
    matchOptions.propertySustainabilitySignals =
      scoringContext.propertySustainabilitySignals?.get(candidate.googlePlaceId);
  }
  if (scoringContext?.userSignalDistribution) {
    matchOptions.userSignalDistribution = scoringContext.userSignalDistribution;
  }
  if (scoringContext?.userRejectionKeywords) {
    matchOptions.userRejectionKeywords = scoringContext.userRejectionKeywords;
  }

  // Core match scoring (v3.2: signal-density weighted profiles, w² alignment)
  const match = computeMatchFromSignals(
    candidate.signals,
    candidate.antiSignals,
    userProfile,
    matchOptions,
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
 * v3.2: Applies per-user percentile normalization so top match → ~93, bottom → ~35.
 */
export function scoreAllCandidates(
  candidates: CandidateProperty[],
  userProfile: TasteProfile,
  userMicroSignals: Record<string, string[]>,
  userContradictions: TasteContradiction[],
  scoringContext?: ScoringContext,
): ScoredCandidate[] {
  const raw = candidates
    .map((c) => scoreCandidate(c, userProfile, userMicroSignals, userContradictions, scoringContext));

  // v3.2: Curve raw scores into user-friendly display range
  const normalized = normalizeScoresForDisplay(raw);
  return normalized.sort((a, b) => b.overallScore - a.overallScore);
}

// ─── Vector-First Scoring (v4) ──────────────────────────────────────────────

/**
 * Score candidates using 100% vector cosine similarity (v4).
 *
 * Uses the 400-dim V3 taste vectors as the sole scoring mechanism:
 * 1. Fetch user's tasteVectorV3 (400-dim semantic cluster vector)
 * 2. Query pgvector HNSW index for top-K nearest property embeddings
 * 3. Score = vector cosine similarity (no signal blending)
 *
 * Signal-based scoring preserved only as a tiebreaker for equal vector scores.
 * Falls back to pure signal-based scoring when V3 vectors aren't available.
 */
export async function scoreWithVectors(
  userId: string,
  candidates: CandidateProperty[],
  userProfile: TasteProfile,
  userMicroSignals: Record<string, string[]>,
  userContradictions: TasteContradiction[],
  scoringContext?: ScoringContext,
): Promise<{ results: ScoredCandidate[]; vectorEnabled: boolean }> {
  // Check if this user has a V3 taste vector (400-dim semantic clusters)
  const vectorResult = await prisma.$queryRaw<{ tasteVectorV3: string | null }[]>`
    SELECT "tasteVectorV3"::text FROM "User" WHERE id = ${userId} LIMIT 1
  `;
  const tasteVectorRaw = vectorResult[0]?.tasteVectorV3 ?? null;

  if (!tasteVectorRaw) {
    // No V3 vector — fall back to signal-based scoring
    console.log('[discover] No V3 taste vector for user, using signal-only scoring');
    const results = scoreAllCandidates(candidates, userProfile, userMicroSignals, userContradictions, scoringContext);
    return { results, vectorEnabled: false };
  }

  // Parse pgvector text format → number[]
  const userVector = tasteVectorRaw.replace(/[\[\]]/g, '').split(',').map(Number);

  // Get vector-based rankings from pgvector V3 (top 200 nearest via HNSW)
  const vectorMatches = await findSimilarPropertiesV3(userVector, 200);

  // Build a lookup: googlePlaceId → vectorScore (0-100)
  const vectorScoreMap = new Map<string, number>();
  for (const match of vectorMatches) {
    vectorScoreMap.set(match.googlePlaceId, match.score);
  }

  // Score all candidates — vector score is primary, signal scoring only for domain breakdown display
  const rawScored = candidates.map((c) => {
    // Signal-based scoring provides domain breakdown + matching signals for display.
    // TODO: Replace with vector-derived domain breakdown (computeVectorMatch) once
    // property vectors are available in the candidate cache. The signal scorer does
    // NOT affect ranking — vector score overrides overallScore below.
    const signalScored = scoreCandidate(c, userProfile, userMicroSignals, userContradictions, scoringContext);
    const vectorScore = vectorScoreMap.get(c.googlePlaceId);

    if (vectorScore !== undefined) {
      // v4: 100% vector scoring — vector IS the score
      return {
        ...signalScored,
        vectorScore,
        blendedScore: vectorScore,
        overallScore: vectorScore, // vector is sole ranking signal
      };
    }

    // Property has no V3 embedding — use signal score as fallback
    return {
      ...signalScored,
      blendedScore: signalScored.overallScore,
    };
  });

  // Curve raw scores into user-friendly display range
  const scored = normalizeVectorScoresForDisplay(rawScored);
  scored.sort((a, b) => b.overallScore - a.overallScore);

  console.log(
    `[discover] V4 vector-first scoring: ${vectorScoreMap.size} properties with V3 embeddings, ` +
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
