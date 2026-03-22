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
import { prisma } from '@/lib/prisma';
import { backfillPropertyEmbeddingV3 } from '@/lib/taste-intelligence/backfill-v3';
import { breakdownToNormalized } from '@/lib/taste-match-vectors';
import { computeTasteScore, buildTasteProfileFromRadar } from '@/lib/taste-score';
import { completeTasteFields } from '@/lib/taste-completion';

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
    // Hoisted so step 4 (taste text refresh) can reference the verified description
    let intelForPromotion: Awaited<ReturnType<typeof prisma.placeIntelligence.findUnique>> | null = null;
    try {
      intelForPromotion = await prisma.placeIntelligence.findUnique({
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
      // Find all SavedPlace records linked to this PlaceIntelligence record.
      // IMPORTANT: Query by placeIntelligenceId (not googlePlaceId) to ensure we only
      // update places that are actually linked to the signals we're about to score against.
      // Previously queried by googlePlaceId, which could cross-contaminate scores if
      // multiple PlaceIntelligence records shared a googlePlaceId due to orphan/stale data.
      const savedPlaces = await prisma.savedPlace.findMany({
        where: { placeIntelligenceId },
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
              // Build user profile from stored radar data for signal fallback
              const profileData = sp.user.tasteProfile as any;
              const userProfile = profileData?.radarData
                ? buildTasteProfileFromRadar(profileData.radarData)
                : undefined;

              const score = await computeTasteScore(
                sp.user.id, googlePlaceId, signals, antiSignals, userProfile,
              );

              if (!score) continue;

              const normalizedBreakdown = score.source === 'vector'
                ? breakdownToNormalized(score.breakdown)
                : Object.fromEntries(
                    Object.entries(score.breakdown).map(([k, v]) => [k, Math.round(v) / 100]),
                  );

              await prisma.savedPlace.update({
                where: { id: sp.id },
                data: {
                  matchScore: score.overallScore,
                  matchBreakdown: normalizedBreakdown,
                  ...(score.explanation ? { matchExplanation: score.explanation } : {}),
                } as any,
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
    // Always refresh after enrichment — the pipeline now has verified data
    // that grounds the tasteNote, so stale import-time hallucinations get replaced.
    let tasteTextUpdated = 0;
    try {
      const intelDescription = intelForPromotion?.description || undefined;

      // Fetch ALL SPs linked to this PI (not just those missing tasteNote)
      const spsNeedingTaste = await prisma.savedPlace.findMany({
        where: { placeIntelligenceId },
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
                description: intelDescription, // ground tasteNote in verified pipeline data
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
