/**
 * Shared taste score computation utility.
 *
 * Vector-only scoring: matchScore comes exclusively from cosine similarity
 * between the user's 400-dim taste vector and the property's embedding.
 * Returns null when vectors are unavailable (no fallback to signal-based scoring,
 * which operates on a completely different scale and would corrupt the z-score
 * tier system).
 */

import { prisma } from '@/lib/prisma';
import { DEFAULT_USER_PROFILE } from '@/lib/taste-match-v3';
import { computeVectorMatchFromDb, breakdownToNormalized } from '@/lib/taste-match-vectors';
import type { TasteProfile, TasteDomain, GeneratedTasteProfile, BriefingSignal, BriefingAntiSignal } from '@/types';
import { ALL_TASTE_DOMAINS } from '@/types';
import type { MatchExplanation } from '@/lib/taste-match-vectors';

const VALID_DOMAINS = new Set<string>(ALL_TASTE_DOMAINS);

/** Build a TasteProfile from the stored GeneratedTasteProfile (radarData). */
export function buildTasteProfileFromGenerated(generated: GeneratedTasteProfile): TasteProfile {
  const profile: TasteProfile = { ...DEFAULT_USER_PROFILE };
  for (const r of generated.radarData || []) {
    if (VALID_DOMAINS.has(r.axis)) {
      profile[r.axis as TasteDomain] = Math.max(profile[r.axis as TasteDomain], r.value);
    }
  }
  return profile;
}

/** Build a TasteProfile from raw radarData (legacy format from user.tasteProfile). */
export function buildTasteProfileFromRadar(
  radarData: Array<{ axis: string; value: number }>,
): TasteProfile {
  const profile: TasteProfile = {} as TasteProfile;
  for (const item of radarData) {
    if (item.axis && typeof item.value === 'number') {
      (profile as Record<string, number>)[item.axis] = item.value / 100;
    }
  }
  return profile;
}

export interface TasteScoreResult {
  overallScore: number;
  breakdown: Record<string, number>;
  explanation?: MatchExplanation;
  source: 'vector';
}

/**
 * Compute a taste match score for a user/place pair.
 *
 * Vector-only: returns raw cosine similarity when both user and property
 * vectors exist. Returns null otherwise — callers should not write a
 * matchScore when this returns null (the score will be filled in later
 * when the property is enriched and rescored).
 *
 * @param userId - The user to score against
 * @param googlePlaceId - The Google Place ID to score
 * @param _signals - @deprecated Unused, kept for call-site compat
 * @param _antiSignals - @deprecated Unused, kept for call-site compat
 * @param _userProfile - @deprecated Unused, kept for call-site compat
 */
export async function computeTasteScore(
  userId: string,
  googlePlaceId: string,
  _signals?: BriefingSignal[],
  _antiSignals?: BriefingAntiSignal[],
  _userProfile?: TasteProfile,
): Promise<TasteScoreResult | null> {
  const vectorMatch = await computeVectorMatchFromDb(userId, googlePlaceId);

  if (vectorMatch) {
    return {
      overallScore: vectorMatch.overallScore,
      breakdown: vectorMatch.breakdown,
      explanation: vectorMatch.explanation,
      source: 'vector',
    };
  }

  // No vectors available — return null instead of falling back to
  // signal-based scoring (which operates on a 0-100 scale incompatible
  // with the raw cosine z-score tier system).
  return null;
}
