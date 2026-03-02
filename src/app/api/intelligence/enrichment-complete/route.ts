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
import { backfillPropertyEmbedding } from '@/lib/taste-intelligence/backfill';
import { computeMatchFromSignals } from '@/lib/taste-match';
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

    // ── 1. Compute property embedding ──────────────────────────────────────
    let embeddingComputed = false;
    try {
      const result = await backfillPropertyEmbedding(placeIntelligenceId);
      embeddingComputed = result.embeddingComputed;
      console.log(
        `[enrichment-complete] Embedding: ${embeddingComputed ? 'computed' : 'skipped (no signals)'} for ${result.propertyName}`,
      );
    } catch (err) {
      console.error(`[enrichment-complete] Embedding computation failed:`, err);
    }

    // ── 2. Recompute match scores for all users who saved this place ──────
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
              // Extract the user's taste profile (radarData → TasteProfile shape)
              const profileData = sp.user.tasteProfile as any;
              if (!profileData?.radarData) continue;

              const userProfile: TasteProfile = {} as TasteProfile;
              for (const item of profileData.radarData) {
                if (item.axis && typeof item.value === 'number') {
                  (userProfile as any)[item.axis] = item.value / 100; // radarData is 0-100, profile is 0-1
                }
              }

              const match = computeMatchFromSignals(signals, antiSignals, userProfile);

              await prisma.savedPlace.update({
                where: { id: sp.id },
                data: { matchScore: match.overallScore },
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

    return NextResponse.json({
      success: true,
      googlePlaceId,
      embeddingComputed,
      matchesUpdated,
    });
  } catch (error) {
    console.error('[enrichment-complete] Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
