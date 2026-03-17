/**
 * POST /api/intelligence/enrichment-complete
 *
 * Webhook called by the Railway pipeline worker after enrichment completes.
 * Performs two post-enrichment tasks:
 *
 * 1. Compute + store property embedding (so similarity queries work immediately)
 * 2. Recompute match scores for all users who saved this place
 *
 * Auth: Bearer token using PIPELINE_WEBHOOK_SECRET to prevent unauthorized calls.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { backfillPropertyEmbeddingV3 } from '@/lib/taste-intelligence/backfill-v3';
import { computeMatchFromSignals } from '@/lib/taste-match-v3';
import { computeVectorMatchFromDb, breakdownToNormalized } from '@/lib/taste-match-vectors';
import { completeTasteFields } from '@/lib/taste-completion';
import type { TasteProfile } from '@/types';

export async function POST(req: NextRequest) {
  // Auth check — Railway must send the shared secret
  const webhookSecret = process.env.PIPELINE_WEBHOOK_SECRET;
  if (webhookSecret) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${webhookSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const { googlePlaceId, placeIntelligenceId } = await req.json();

    if (!googlePlaceId || !placeIntelligenceId) {
      return NextResponse.json(
        { error: 'Missing required fields: googlePlaceId, placeIntelligenceId' },
        { status: 400 },
      );
    }

    console.log(`[enrichment-complete] Processing post-enrichment for ${googlePlaceId}`);

    // ── 1. Compute property embedding (V3 — 400-dim semantic clusters) ────
    let embeddingComputed = false;
    try {
      embeddingComputed = await backfillPropertyEmbeddingV3(placeIntelligenceId);
      console.log(
        `[enrichment-complete] V3 Embedding: ${embeddingComputed ? 'computed' : 'skipped (no signals)'} for ${googlePlaceId}`,
      );
    } catch (err) {
      console.error(`[enrichment-complete] V3 embedding computation failed:`, err);
    }

    // ── 2. Promote synthesis fields from PlaceIntelligence → SavedPlace ──────
    let fieldsPromoted = 0;
    try {
      const intelForPromotion = await prisma.placeIntelligence.findUnique({
        where: { id: placeIntelligenceId },
        select: {
          description: true,
          whatToOrder: true,
          tips: true,
          alsoKnownAs: true,
          googleData: true,
          formalityLevel: true,
          cuisineStyle: true,
          reliabilityScore: true,
          sustainabilityScore: true,
          signalCount: true,
          antiSignalCount: true,
          facts: true,
        },
      });

      if (intelForPromotion) {
        const promotionData: Record<string, any> = {};

        // Summary fields
        if (intelForPromotion.reliabilityScore != null) promotionData.reliabilityScore = intelForPromotion.reliabilityScore;
        if (intelForPromotion.sustainabilityScore != null) promotionData.sustainabilityScore = intelForPromotion.sustainabilityScore;
        if (intelForPromotion.signalCount != null) promotionData.signalCount = intelForPromotion.signalCount;
        if (intelForPromotion.antiSignalCount != null) promotionData.antiSignalCount = intelForPromotion.antiSignalCount;
        if (intelForPromotion.formalityLevel) promotionData.formalityLevel = intelForPromotion.formalityLevel;
        if (intelForPromotion.cuisineStyle) promotionData.cuisineStyle = intelForPromotion.cuisineStyle;

        // Synthesis fields — denormalized cache on SavedPlace
        if (intelForPromotion.description) {
          promotionData.enrichment = { description: intelForPromotion.description };
        }
        if (intelForPromotion.whatToOrder && Array.isArray(intelForPromotion.whatToOrder) && (intelForPromotion.whatToOrder as any[]).length > 0) {
          promotionData.whatToOrder = intelForPromotion.whatToOrder;
        }
        if (intelForPromotion.tips && Array.isArray(intelForPromotion.tips) && (intelForPromotion.tips as any[]).length > 0) {
          promotionData.tips = intelForPromotion.tips;
        }
        if (intelForPromotion.googleData) {
          promotionData.googleData = intelForPromotion.googleData;
        }
        if (intelForPromotion.alsoKnownAs) {
          promotionData.alsoKnownAs = intelForPromotion.alsoKnownAs;
        }

        // Heritage fields — extract from facts Json and promote to dedicated columns
        if (intelForPromotion.facts && typeof intelForPromotion.facts === 'object') {
          const facts = intelForPromotion.facts as Record<string, any>;
          const yearEstablished = facts.yearEstablished || facts.year_established;
          const architect = facts.architect;

          if (yearEstablished) {
            promotionData.yearEstablished = String(yearEstablished);
          }

          // Build heritage highlight: "Est. 1924 · Marcel Breuer"
          const highlightParts: string[] = [];
          if (yearEstablished) {
            const yr = String(yearEstablished);
            highlightParts.push(yr.length === 4 ? `Est. ${yr}` : yr);
          }
          if (architect) {
            highlightParts.push(String(architect));
          }
          if (highlightParts.length > 0) {
            promotionData.heritageHighlight = highlightParts.join(' · ');
          }
        }

        if (Object.keys(promotionData).length > 0) {
          const result = await prisma.savedPlace.updateMany({
            where: { placeIntelligenceId },
            data: promotionData,
          });
          fieldsPromoted = result.count;
          console.log(`[enrichment-complete] Promoted ${Object.keys(promotionData).length} fields to ${fieldsPromoted} SavedPlace(s)`);
        }
      }
    } catch (err) {
      console.error(`[enrichment-complete] Field promotion failed:`, err);
    }

    // ── 3. Recompute match scores for all users who saved this place ──────
    let matchesUpdated = 0;
    try {
      // Find all SavedPlace records for this googlePlaceId, with their user's taste profile
      const savedPlaces = await prisma.savedPlace.findMany({
        where: { googlePlaceId },
        select: {
          id: true,
          user: {
            select: {
              id: true,
              tasteProfile: true,
            },
          },
        },
      });

      // Get fresh intelligence data
      const intel = await prisma.placeIntelligence.findUnique({
        where: { id: placeIntelligenceId },
        select: { signals: true, antiSignals: true },
      });

      if (intel && savedPlaces.length > 0) {
        const signals = (intel.signals as any[]) || [];
        const antiSignals = (intel.antiSignals as any[]) || [];

        if (signals.length > 0) {
          for (const sp of savedPlaces) {
            try {
              // v4: Try vector-first scoring
              const vectorMatch = await computeVectorMatchFromDb(sp.user.id, googlePlaceId);

              if (vectorMatch) {
                // Vector match available — use as sole scoring source
                const normalizedBreakdown = breakdownToNormalized(vectorMatch.breakdown);

                await prisma.savedPlace.update({
                  where: { id: sp.id },
                  // matchExplanation: added in v4 migration — Prisma types update on next `prisma generate`
                  data: {
                    matchScore: vectorMatch.overallScore,
                    matchBreakdown: normalizedBreakdown,
                    matchExplanation: vectorMatch.explanation,
                  } as any,
                });

                matchesUpdated++;
                continue;
              }

              // Fallback: signal-based scoring (user has no V3 vector)
              const profileData = sp.user.tasteProfile as any;
              if (!profileData?.radarData) continue;

              const userProfile: TasteProfile = {} as TasteProfile;
              for (const item of profileData.radarData) {
                if (item.axis && typeof item.value === 'number') {
                  (userProfile as any)[item.axis] = item.value / 100;
                }
              }

              const match = computeMatchFromSignals(signals, antiSignals, userProfile);

              const normalizedBreakdown: Record<string, number> = {};
              for (const [domain, score] of Object.entries(match.breakdown)) {
                normalizedBreakdown[domain] = Math.round(score) / 100;
              }

              await prisma.savedPlace.update({
                where: { id: sp.id },
                data: {
                  matchScore: match.overallScore,
                  matchBreakdown: normalizedBreakdown,
                },
              });

              matchesUpdated++;
            } catch (err) {
              console.error(`[enrichment-complete] Match update failed for SavedPlace ${sp.id}:`, err);
            }
          }
        }
      }

      console.log(`[enrichment-complete] Match scores: ${matchesUpdated} updated for ${googlePlaceId}`);
    } catch (err) {
      console.error(`[enrichment-complete] Match score computation failed:`, err);
    }

    // ── 4. Generate personalized taste text (tasteNote, terrazzoInsight) ──
    let tasteTextUpdated = 0;
    try {
      // Find SPs linked to this PI that are missing tasteNote or terrazzoInsight
      const spsNeedingTaste = await prisma.savedPlace.findMany({
        where: {
          placeIntelligenceId,
          OR: [
            { tasteNote: null },
            { tasteNote: '' },
            { terrazzoInsight: { equals: Prisma.DbNull } },
          ],
        },
        select: {
          id: true,
          name: true,
          type: true,
          location: true,
          userId: true,
        },
      });

      if (spsNeedingTaste.length > 0) {
        // Group by userId (each user needs their own personalized text)
        const byUser = new Map<string, typeof spsNeedingTaste>();
        for (const sp of spsNeedingTaste) {
          const existing = byUser.get(sp.userId) || [];
          existing.push(sp);
          byUser.set(sp.userId, existing);
        }

        for (const [userId, userPlaces] of byUser) {
          try {
            const count = await completeTasteFields(
              userPlaces.map((sp: any) => ({
                savedPlaceId: sp.id,
                name: sp.name,
                type: sp.type,
                location: sp.location || undefined,
              })),
              userId,
              { skipScores: true }, // signal-based scores already written above
            );
            tasteTextUpdated += count;
          } catch (err) {
            console.error(`[enrichment-complete] Taste text generation failed for user ${userId}:`, err);
          }
        }

        console.log(`[enrichment-complete] Taste text: ${tasteTextUpdated} updated for ${googlePlaceId}`);
      }
    } catch (err) {
      console.error(`[enrichment-complete] Taste text generation failed:`, err);
    }

    return NextResponse.json({
      success: true,
      googlePlaceId,
      embeddingComputed,
      fieldsPromoted,
      matchesUpdated,
      tasteTextUpdated,
    });
  } catch (error) {
    console.error('[enrichment-complete] Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
