/**
 * taste-completion.ts
 *
 * Shared helper that generates personalized taste fields (tasteNote,
 * terrazzoInsight, matchScore, matchBreakdown) for SavedPlace records.
 *
 * Used by:
 *   - enrichment-complete webhook (text fields only — scores come from signals)
 *   - email reservation confirm flows (all fields — no signals yet)
 *   - shared collection save (all fields — re-personalizes for recipient)
 */

import { prisma } from '@/lib/prisma';
import { generateTasteMatchBatch } from '@/lib/anthropic';
import type { TasteProfile } from '@/types';

interface PlaceInput {
  savedPlaceId: string;
  name: string;
  type: string;
  location?: string;
  /** Verified description from enrichment pipeline — grounds the tasteNote instead of relying on training knowledge. */
  description?: string;
}

interface CompletionOptions {
  /** If true, only writes tasteNote + terrazzoInsight (skip matchScore/matchBreakdown).
   *  Use this when signal-based scores are preferred (e.g. enrichment-complete webhook). */
  skipScores?: boolean;
}

/**
 * Generate and persist personalized taste fields for a batch of places.
 *
 * Loads the user's taste profile, calls Claude to generate taste data,
 * and updates each SavedPlace record.
 *
 * @returns number of records updated
 */
export async function completeTasteFields(
  places: PlaceInput[],
  userId: string,
  options: CompletionOptions = {},
): Promise<number> {
  if (places.length === 0) return 0;

  // Load user's taste profile
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tasteProfile: true },
  });

  const profileData = user?.tasteProfile as Record<string, unknown>;
  if (!profileData?.radarData) {
    // No taste profile — can't generate personalized data
    return 0;
  }

  // Convert radarData (0-100) → flat profile (0-1) for the Anthropic call
  const userProfile: Record<string, number> = {};
  const radarData = profileData.radarData as Array<{ axis?: string; value?: number }>;
  for (const item of radarData) {
    if (item.axis && typeof item.value === 'number') {
      userProfile[item.axis] = item.value / 100;
    }
  }

  // Call Claude to generate taste data for all places in one batch.
  // Pass the verified pipeline description when available so Claude doesn't
  // hallucinate a tasteNote from training knowledge alone.
  const batchInput = places.map(p => ({
    name: p.name,
    type: p.type,
    city: p.location?.split(',')[0]?.trim(),
    ...(p.description ? { description: p.description } : {}),
  }));

  const results = await generateTasteMatchBatch(batchInput, userProfile);
  if (!results || results.length === 0) return 0;

  let updated = 0;

  for (let i = 0; i < places.length; i++) {
    const place = places[i];
    const taste = results[i];
    if (!taste) continue;

    try {
      const data: Record<string, any> = {};

      // Always write text fields
      if (taste.terrazzoInsight) {
        data.terrazzoInsight = taste.terrazzoInsight;
      }

      // Optionally write score fields
      if (!options.skipScores) {
        if (typeof taste.matchScore === 'number') {
          data.matchScore = taste.matchScore;
        }
        if (taste.matchBreakdown) {
          data.matchBreakdown = taste.matchBreakdown;
        }
      }

      if (Object.keys(data).length > 0) {
        await prisma.savedPlace.update({
          where: { id: place.savedPlaceId },
          data,
        });
        updated++;
      }
    } catch (err) {
      console.error(`[taste-completion] Failed to update ${place.name}:`, err);
    }
  }

  return updated;
}
