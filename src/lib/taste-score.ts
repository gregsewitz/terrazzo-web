/**
 * Shared taste score computation utility.
 *
 * Centralizes the vector-first / signal-fallback scoring strategy that was
 * duplicated between intelligence/enrichment-complete and places/resolve routes.
 */

import { prisma } from '@/lib/prisma';
import { computeMatchFromSignals, DEFAULT_USER_PROFILE } from '@/lib/taste-match-v3';
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
  source: 'vector' | 'signal';
}

/**
 * Compute a taste match score for a user/place pair.
 *
 * Strategy: try vector-first (embedding cosine similarity), fall back to
 * signal-based scoring if the user has no V3 taste vector.
 *
 * @param userId - The user to score against
 * @param googlePlaceId - The Google Place ID to score
 * @param signals - Place intelligence signals array
 * @param antiSignals - Place intelligence anti-signals array
 * @param userProfile - Optional pre-built TasteProfile (avoids DB lookup)
 */
export async function computeTasteScore(
  userId: string,
  googlePlaceId: string,
  signals: BriefingSignal[],
  antiSignals: BriefingAntiSignal[],
  userProfile?: TasteProfile,
): Promise<TasteScoreResult | null> {
  // Try vector-first scoring
  const vectorMatch = await computeVectorMatchFromDb(userId, googlePlaceId);

  if (vectorMatch) {
    return {
      overallScore: vectorMatch.overallScore,
      breakdown: vectorMatch.breakdown,
      explanation: vectorMatch.explanation,
      source: 'vector',
    };
  }

  // Fallback: signal-based scoring
  let profile = userProfile;

  if (!profile) {
    // Fetch user's taste profile from DB
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { tasteProfile: true },
    });
    const generated = userRecord?.tasteProfile as unknown as GeneratedTasteProfile | null;
    profile = generated ? buildTasteProfileFromGenerated(generated) : DEFAULT_USER_PROFILE;
  }

  if (signals.length === 0) return null;

  const match = computeMatchFromSignals(signals, antiSignals, profile);

  return {
    overallScore: match.overallScore,
    breakdown: match.breakdown,
    source: 'signal',
  };
}
