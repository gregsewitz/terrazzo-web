/**
 * POST /api/intelligence/backfill-google-data
 *
 * Comprehensive backfill that fills in all missing fields across both
 * PlaceIntelligence and SavedPlace records. Runs four phases in order:
 *
 *   Phase 1 — Re-fetch Google Places data for SavedPlaces missing rating
 *   Phase 2 — Copy googleData from SavedPlace → PlaceIntelligence
 *   Phase 3 — Copy synthesis fields (description, whatToOrder, tips, etc.)
 *             from PlaceIntelligence → SavedPlace where PI has them but SP doesn't
 *   Phase 4 — Trigger pipeline re-enrichment for PI records still missing synthesis
 *
 * Query params:
 *   ?dryRun=true     — report what would happen without acting
 *   ?limit=50        — max records per phase (default 50)
 *   ?phase=1,2,3,4   — run only specific phases (comma-separated, default: all)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { searchPlace } from '@/lib/places';

const PIPELINE_WORKER_URL = process.env.PIPELINE_WORKER_URL || '';

export async function POST(req: NextRequest) {
  try {
    const dryRun = req.nextUrl.searchParams.get('dryRun') === 'true';
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);
    const phaseParam = req.nextUrl.searchParams.get('phase');
    const phases = phaseParam
      ? phaseParam.split(',').map(Number)
      : [1, 2, 3, 4];

    const report: Record<string, unknown> = { dryRun, phases };

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 1 — Re-fetch Google data for SavedPlaces missing rating
    // ═══════════════════════════════════════════════════════════════════
    if (phases.includes(1)) {
      const allSP = await prisma.savedPlace.findMany({
        where: { deletedAt: null, googlePlaceId: { not: null } },
        select: { id: true, name: true, googlePlaceId: true, googleData: true, placeIntelligenceId: true },
      });

      const needsGoogleRefresh = allSP.filter(p => {
        const gd = p.googleData as Record<string, unknown> | null;
        return !gd?.rating;
      }).slice(0, limit);

      if (dryRun) {
        report.phase1 = { needed: needsGoogleRefresh.length, places: needsGoogleRefresh.map(p => p.name) };
      } else {
        const updated: string[] = [];
        const errors: { name: string; error: string }[] = [];

        for (const place of needsGoogleRefresh) {
          try {
            const googleResult = await searchPlace(place.name);
            if (!googleResult || googleResult.id !== place.googlePlaceId) {
              errors.push({ name: place.name, error: 'Google result mismatch' });
              continue;
            }

            const canonicalGoogleData = {
              ...(place.googleData as Record<string, unknown>),
              rating: googleResult.rating || null,
              reviewCount: googleResult.userRatingCount || null,
              priceLevel: googleResult.priceLevel || null,
              hours: googleResult.regularOpeningHours?.weekdayDescriptions || null,
              category: googleResult.primaryTypeDisplayName?.text || null,
            };

            await prisma.savedPlace.updateMany({
              where: { googlePlaceId: place.googlePlaceId },
              data: { googleData: canonicalGoogleData as any },
            });

            if (place.placeIntelligenceId) {
              await prisma.placeIntelligence.update({
                where: { id: place.placeIntelligenceId },
                data: { googleData: canonicalGoogleData as any },
              });
            }

            updated.push(place.name);
            await new Promise(r => setTimeout(r, 250));
          } catch (err) {
            errors.push({ name: place.name, error: (err as Error).message });
          }
        }

        report.phase1 = { needed: needsGoogleRefresh.length, updated: updated.length, errors: errors.length > 0 ? errors : undefined };
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 2 — Copy googleData from SavedPlace → PlaceIntelligence
    // ═══════════════════════════════════════════════════════════════════
    if (phases.includes(2)) {
      const piMissingGD = await prisma.placeIntelligence.findMany({
        where: { googleData: { equals: Prisma.JsonNull } },
        select: { id: true, googlePlaceId: true, propertyName: true },
        take: limit,
      });

      if (dryRun) {
        report.phase2 = { needed: piMissingGD.length };
      } else {
        let copied = 0;
        for (const pi of piMissingGD) {
          const sp = await prisma.savedPlace.findFirst({
            where: { googlePlaceId: pi.googlePlaceId, deletedAt: null },
            select: { googleData: true },
          });
          const gd = sp?.googleData as Record<string, unknown> | null;
          if (gd && Object.keys(gd).length > 0) {
            await prisma.placeIntelligence.update({
              where: { id: pi.id },
              data: { googleData: gd as any },
            });
            copied++;
          }
        }
        report.phase2 = { needed: piMissingGD.length, copied };
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 3 — Promote synthesis fields from PI → SavedPlace
    //           For PI records that have synthesis but linked SP doesn't
    // ═══════════════════════════════════════════════════════════════════
    if (phases.includes(3)) {
      const piWithSynthesis = await prisma.placeIntelligence.findMany({
        where: { description: { not: null } },
        select: {
          id: true,
          googlePlaceId: true,
          description: true,
          whatToOrder: true,
          tips: true,
          alsoKnownAs: true,
          googleData: true,
          formalityLevel: true,
          cuisineStyle: true,
        },
        take: limit,
      });

      if (dryRun) {
        report.phase3 = { piWithSynthesis: piWithSynthesis.length };
      } else {
        let promoted = 0;
        for (const pi of piWithSynthesis) {
          const promotionData: Record<string, unknown> = {};

          if (pi.description) promotionData.enrichment = { description: pi.description };
          if (pi.whatToOrder && Array.isArray(pi.whatToOrder) && (pi.whatToOrder as unknown[]).length > 0) {
            promotionData.whatToOrder = pi.whatToOrder;
          }
          if (pi.tips && Array.isArray(pi.tips) && (pi.tips as unknown[]).length > 0) {
            promotionData.tips = pi.tips;
          }
          if (pi.alsoKnownAs) promotionData.alsoKnownAs = pi.alsoKnownAs;
          if (pi.googleData) promotionData.googleData = pi.googleData;
          if (pi.formalityLevel) promotionData.formalityLevel = pi.formalityLevel;
          if (pi.cuisineStyle) promotionData.cuisineStyle = pi.cuisineStyle;

          if (Object.keys(promotionData).length > 0) {
            const result = await prisma.savedPlace.updateMany({
              where: { placeIntelligenceId: pi.id },
              data: promotionData as any,
            });
            promoted += result.count;
          }
        }
        report.phase3 = { piWithSynthesis: piWithSynthesis.length, savedPlacesUpdated: promoted };
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 4 — Trigger pipeline for PI records missing synthesis
    // ═══════════════════════════════════════════════════════════════════
    if (phases.includes(4)) {
      const piNeedsSynthesis = await prisma.placeIntelligence.findMany({
        where: {
          status: 'complete',
          description: null,
          signalCount: { gt: 0 },
        },
        select: { id: true, googlePlaceId: true, propertyName: true, placeType: true },
        take: limit,
      });

      if (dryRun) {
        report.phase4 = {
          needed: piNeedsSynthesis.length,
          places: piNeedsSynthesis.map(p => ({ name: p.propertyName, googlePlaceId: p.googlePlaceId })),
        };
      } else {
        const triggered: string[] = [];
        const errors: { name: string; error: string }[] = [];

        for (const pi of piNeedsSynthesis) {
          try {
            await prisma.placeIntelligence.update({
              where: { id: pi.id },
              data: { status: 'pending' },
            });

            const res = await fetch(`${PIPELINE_WORKER_URL}/enrich`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                googlePlaceId: pi.googlePlaceId,
                propertyName: pi.propertyName,
                placeIntelligenceId: pi.id,
                placeType: pi.placeType || 'restaurant',
              }),
              signal: AbortSignal.timeout(10_000),
            });

            if (!res.ok) {
              const errText = await res.text();
              errors.push({ name: pi.propertyName, error: `Railway ${res.status}: ${errText}` });
              continue;
            }

            triggered.push(pi.propertyName);
          } catch (err) {
            errors.push({ name: pi.propertyName, error: (err as Error).message });
          }
        }

        report.phase4 = {
          needed: piNeedsSynthesis.length,
          triggered: triggered.length,
          errors: errors.length > 0 ? errors : undefined,
        };
      }
    }

    return NextResponse.json({ success: true, ...report });
  } catch (error) {
    console.error('[backfill-google-data] Error:', error);
    return NextResponse.json(
      { error: 'Backfill failed', details: (error as Error).message },
      { status: 500 },
    );
  }
}
