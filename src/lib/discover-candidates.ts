/**
 * Discover Candidates — retrieval and scoring layer for RAG-grounded discover feed.
 *
 * Fetches enriched PlaceIntelligence records, scores them against a user's taste profile,
 * and returns ranked candidates with the specific signals that drove each match.
 */

import { prisma } from '@/lib/prisma';
import { computeMatchFromSignals } from '@/lib/taste-match';
import type {
  TasteDomain,
  TasteProfile,
  TasteContradiction,
  BriefingSignal,
  BriefingAntiSignal,
  GeneratedTasteProfile,
} from '@/types';
import { DIMENSION_TO_DOMAIN } from '@/types';

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
    signals: (r.signals as BriefingSignal[]) || [],
    antiSignals: (r.antiSignals as BriefingAntiSignal[]) || [],
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
