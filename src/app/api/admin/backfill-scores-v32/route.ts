/**
 * POST /api/admin/backfill-scores-v32
 *
 * Re-scores all SavedPlace records using the v3.2 taste matching algorithm.
 * This avoids re-running enrichment on all 800+ properties.
 *
 * For each user:
 *   1. Load their GeneratedTasteProfile (radarData, microTasteSignals, contradictions)
 *   2. Derive v3.2 options (signal distribution, rejection keywords)
 *   3. Score all their SavedPlaces against PlaceIntelligence signals
 *   4. Apply per-user normalizeScoresForDisplay
 *   5. Write updated matchScore + matchBreakdown back to SavedPlace
 *
 * Auth: Requires PIPELINE_WEBHOOK_SECRET bearer token (same as enrichment-complete).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeMatchFromSignals, normalizeScoresForDisplay } from '@/lib/taste-match-v3';
import type { MatchOptions } from '@/lib/taste-match-v3';
import type { TasteProfile, TasteDomain, TasteContradiction } from '@/types';
import { ALL_TASTE_DOMAINS } from '@/types';

export const maxDuration = 300; // 5 minutes — this touches many rows

const VALID_DOMAINS = new Set<string>(ALL_TASTE_DOMAINS);

const DEFAULT_USER_PROFILE: TasteProfile = {
  Design: 0.85,
  Atmosphere: 0.75,
  Character: 0.8,
  Service: 0.6,
  FoodDrink: 0.75,
  Setting: 0.7,
  Wellness: 0.4,
  Sustainability: 0.3,
};

export async function POST(req: NextRequest) {
  // Auth check
  const webhookSecret = process.env.PIPELINE_WEBHOOK_SECRET;
  if (webhookSecret) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${webhookSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // Get all users with a taste profile who have saved places
    const users = await prisma.user.findMany({
      where: {
        tasteProfile: { not: { equals: undefined } },
        savedPlaces: { some: {} },
      },
      select: {
        id: true,
        tasteProfile: true,
      },
    });

    console.log(`[backfill-v32] Found ${users.length} users with profiles and saved places`);

    // Pre-load all PlaceIntelligence signals into a lookup map
    const allIntel = await prisma.placeIntelligence.findMany({
      where: { status: 'complete', signalCount: { gt: 0 } },
      select: {
        googlePlaceId: true,
        signals: true,
        antiSignals: true,
      },
    });

    const intelMap = new Map<string, { signals: any[]; antiSignals: any[] }>();
    for (const intel of allIntel) {
      intelMap.set(intel.googlePlaceId, {
        signals: (intel.signals as any[]) || [],
        antiSignals: (intel.antiSignals as any[]) || [],
      });
    }

    console.log(`[backfill-v32] Loaded signals for ${intelMap.size} enriched properties`);

    let totalUpdated = 0;
    let totalSkipped = 0;
    const userSummaries: { userId: string; updated: number; skipped: number }[] = [];

    for (const user of users) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profileData = user.tasteProfile as any;
      if (!profileData?.radarData) {
        totalSkipped++;
        continue;
      }

      // Build TasteProfile from radarData
      const userProfile: TasteProfile = { ...DEFAULT_USER_PROFILE };
      for (const r of profileData.radarData || []) {
        if (r.axis && typeof r.value === 'number' && VALID_DOMAINS.has(r.axis)) {
          // radarData values may be 0-1 or 0-100 depending on source
          const val = r.value > 1 ? r.value / 100 : r.value;
          userProfile[r.axis as TasteDomain] = Math.max(userProfile[r.axis as TasteDomain], val);
        }
      }

      // v3.2: Derive signal distribution from microTasteSignals
      const microSignals: Record<string, string[]> = profileData.microTasteSignals || {};
      const userSignalDistribution: Record<string, number> = {};
      for (const [domain, signals] of Object.entries(microSignals)) {
        if (VALID_DOMAINS.has(domain) && Array.isArray(signals)) {
          userSignalDistribution[domain] = signals.length;
        }
      }

      // v3.2: Extract rejection keywords from contradictions
      const contradictions: TasteContradiction[] = profileData.contradictions || [];
      const userRejectionKeywords: string[] = [];
      for (const c of contradictions) {
        if (c.stated) userRejectionKeywords.push(c.stated);
      }

      // Fetch all SavedPlaces for this user
      const savedPlaces = await prisma.savedPlace.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          googlePlaceId: true,
        },
      });

      // Score each place, collecting raw scores for batch normalization
      const rawScored: { savedPlaceId: string; overallScore: number; breakdown: Record<string, number> }[] = [];

      for (const sp of savedPlaces) {
        if (!sp.googlePlaceId) { totalSkipped++; continue; }
        const intel = intelMap.get(sp.googlePlaceId);
        if (!intel || intel.signals.length === 0) {
          totalSkipped++;
          continue;
        }

        const matchOptions: MatchOptions = {
          userMicroSignals: microSignals,
          userSignalDistribution: Object.keys(userSignalDistribution).length > 0 ? userSignalDistribution : undefined,
          userRejectionKeywords: userRejectionKeywords.length > 0 ? userRejectionKeywords : undefined,
        };

        const match = computeMatchFromSignals(
          intel.signals,
          intel.antiSignals,
          userProfile,
          matchOptions,
        );

        rawScored.push({
          savedPlaceId: sp.id,
          overallScore: match.overallScore,
          breakdown: match.breakdown,
        });
      }

      // Apply per-user percentile normalization
      const normalized = normalizeScoresForDisplay(rawScored);

      // Write back to database
      let userUpdated = 0;
      for (const scored of normalized) {
        // Convert breakdown from 0-100 to 0-1 to match import convention
        const normalizedBreakdown: Record<string, number> = {};
        for (const [domain, score] of Object.entries(scored.breakdown)) {
          normalizedBreakdown[domain] = Math.round(score) / 100;
        }

        await prisma.savedPlace.update({
          where: { id: scored.savedPlaceId },
          data: {
            matchScore: scored.overallScore,
            matchBreakdown: normalizedBreakdown,
          },
        });
        userUpdated++;
      }

      totalUpdated += userUpdated;
      userSummaries.push({
        userId: user.id,
        updated: userUpdated,
        skipped: savedPlaces.length - rawScored.length,
      });

      console.log(
        `[backfill-v32] User ${user.id}: ${userUpdated} scores updated, ${savedPlaces.length - rawScored.length} skipped (no intel)`
      );
    }

    console.log(`[backfill-v32] Complete: ${totalUpdated} scores updated, ${totalSkipped} skipped across ${users.length} users`);

    return NextResponse.json({
      success: true,
      totalUsers: users.length,
      totalUpdated,
      totalSkipped,
      enrichedProperties: intelMap.size,
      userSummaries,
    });
  } catch (error) {
    console.error('[backfill-v32] Error:', error);
    return NextResponse.json({ error: 'Backfill failed' }, { status: 500 });
  }
}
