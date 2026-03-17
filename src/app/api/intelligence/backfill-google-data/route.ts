/**
 * POST /api/intelligence/backfill-google-data
 *
 * Comprehensive backfill that fills in all missing fields across both
 * PlaceIntelligence and SavedPlace records. Runs five phases in order:
 *
 *   Phase 1 — Re-fetch Google Places data for SavedPlaces missing rating
 *   Phase 2 — Copy googleData from SavedPlace → PlaceIntelligence
 *   Phase 3 — Copy synthesis fields (description, whatToOrder, tips, etc.)
 *             from PlaceIntelligence → SavedPlace where PI has them but SP doesn't
 *   Phase 4 — Trigger pipeline re-enrichment for PI records still missing synthesis
 *   Phase 5 — Fetch Google Places data directly for PI records missing googleData
 *             (lightweight — only fetches Google data, no full pipeline run)
 *   Phase 6 — Generate missing taste fields (tasteNote, matchBreakdown, terrazzoInsight)
 *             for SavedPlace records via Claude taste matching
 *
 * Query params:
 *   ?dryRun=true         — report what would happen without acting
 *   ?limit=50            — max records per phase (default 50)
 *   ?phase=1,2,3,4,5,6   — run only specific phases (comma-separated, default: all)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { searchPlace, getPlaceById, priceLevelToString, getPhotoUrl } from '@/lib/places';
import { completeTasteFields } from '@/lib/taste-completion';

const PIPELINE_WORKER_URL = process.env.PIPELINE_WORKER_URL || '';

export async function POST(req: NextRequest) {
  try {
    const dryRun = req.nextUrl.searchParams.get('dryRun') === 'true';
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);
    const phaseParam = req.nextUrl.searchParams.get('phase');
    const phases = phaseParam
      ? phaseParam.split(',').map(Number)
      : [1, 2, 3, 4, 5, 6];

    const report: Record<string, unknown> = { dryRun, phases };

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 1 — Re-fetch Google data for SavedPlaces missing rating
    // ═══════════════════════════════════════════════════════════════════
    if (phases.includes(1)) {
      const allSP = await prisma.savedPlace.findMany({
        where: { deletedAt: null, googlePlaceId: { not: null } },
        select: { id: true, name: true, googlePlaceId: true, googleData: true, placeIntelligenceId: true },
      });

      const needsGoogleRefresh = allSP.filter((p: any) => {
        const gd = p.googleData as Record<string, unknown> | null;
        return !gd?.rating;
      }).slice(0, limit);

      if (dryRun) {
        report.phase1 = { needed: needsGoogleRefresh.length, places: needsGoogleRefresh.map((p: any) => p.name) };
      } else {
        const updated: string[] = [];
        const errors: { name: string; error: string }[] = [];

        for (const sp of needsGoogleRefresh) {
          try {
            const googleResult = await searchPlace(sp.name);
            if (!googleResult || googleResult.id !== sp.googlePlaceId) {
              errors.push({ name: sp.name, error: 'Google result mismatch' });
              continue;
            }

            const canonicalGoogleData = {
              ...(sp.googleData as Record<string, unknown>),
              rating: googleResult.rating || null,
              reviewCount: googleResult.userRatingCount || null,
              priceLevel: googleResult.priceLevel || null,
              hours: googleResult.regularOpeningHours?.weekdayDescriptions || null,
              category: googleResult.primaryTypeDisplayName?.text || null,
            };

            await prisma.savedPlace.updateMany({
              where: { googlePlaceId: sp.googlePlaceId },
              data: { googleData: canonicalGoogleData as any },
            });

            if (sp.placeIntelligenceId) {
              await prisma.placeIntelligence.update({
                where: { id: sp.placeIntelligenceId },
                data: { googleData: canonicalGoogleData as any },
              });
            }

            updated.push(sp.name);
            await new Promise((r: (value?: void) => void) => setTimeout(r, 250));
          } catch (err) {
            errors.push({ name: sp.name, error: (err as Error).message });
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
          places: piNeedsSynthesis.map((p: any) => ({ name: p.propertyName, googlePlaceId: p.googlePlaceId })),
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

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 5 — Fetch Google data for PI records missing googleData
    //           Lightweight: only calls Google Places API, no pipeline
    // ═══════════════════════════════════════════════════════════════════
    if (phases.includes(5)) {
      const piMissingGoogleData = await prisma.placeIntelligence.findMany({
        where: {
          OR: [
            { googleData: { equals: Prisma.JsonNull } },
            { googleData: { equals: Prisma.DbNull } },
          ],
        },
        select: { id: true, googlePlaceId: true, propertyName: true },
        take: limit,
      });

      if (dryRun) {
        // Also get total count for reporting
        const totalMissing = await prisma.placeIntelligence.count({
          where: {
            OR: [
              { googleData: { equals: Prisma.JsonNull } },
              { googleData: { equals: Prisma.DbNull } },
            ],
          },
        });
        report.phase5 = {
          needed: totalMissing,
          batch: piMissingGoogleData.length,
          places: piMissingGoogleData.slice(0, 10).map((sp: any) => sp.propertyName),
        };
      } else {
        const updated: string[] = [];
        const errors: { name: string; error: string }[] = [];

        for (const pi of piMissingGoogleData) {
          try {
            const googleResult = await getPlaceById(pi.googlePlaceId);
            if (!googleResult) {
              errors.push({ name: pi.propertyName, error: 'Not found on Google' });
              continue;
            }

            const photoUrl = googleResult.photos?.[0]?.name
              ? getPhotoUrl(googleResult.photos[0].name, 800)
              : null;

            const canonicalGoogleData = {
              address: googleResult.formattedAddress || null,
              rating: googleResult.rating || null,
              reviewCount: googleResult.userRatingCount || null,
              priceLevel: priceLevelToString(googleResult.priceLevel),
              hours: googleResult.regularOpeningHours?.weekdayDescriptions || null,
              lat: googleResult.location?.latitude || null,
              lng: googleResult.location?.longitude || null,
              category: googleResult.primaryTypeDisplayName?.text || null,
              website: (googleResult as any).websiteUri || null,
              phone: (googleResult as any).internationalPhoneNumber || null,
              photoUrl,
              placeId: pi.googlePlaceId,
            };

            await prisma.placeIntelligence.update({
              where: { id: pi.id },
              data: { googleData: canonicalGoogleData as any },
            });

            updated.push(pi.propertyName);

            // Rate limit: 250ms between Google API calls
            await new Promise<void>((resolve) => setTimeout(resolve, 250));
          } catch (err) {
            errors.push({ name: pi.propertyName, error: (err as Error).message });
          }
        }

        report.phase5 = {
          needed: piMissingGoogleData.length,
          updated: updated.length,
          errors: errors.length > 0 ? errors : undefined,
        };
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Phase 6: Generate missing taste fields (tasteNote, matchBreakdown, terrazzoInsight)
    // ═══════════════════════════════════════════════════════════════════
    if (phases.includes(6)) {
      const spsMissingTaste = await prisma.savedPlace.findMany({
        where: {
          deletedAt: null,
          placeIntelligenceId: { not: null },
          OR: [
            { tasteNote: null },
            { tasteNote: '' },
            { terrazzoInsight: { equals: Prisma.DbNull } },
            { matchBreakdown: { equals: Prisma.DbNull } },
          ],
        },
        select: {
          id: true,
          name: true,
          type: true,
          location: true,
          userId: true,
          tasteNote: true,
          terrazzoInsight: true,
          matchBreakdown: true,
        },
        take: limit,
      });

      if (dryRun) {
        const totalMissing = await prisma.savedPlace.count({
          where: {
            deletedAt: null,
            placeIntelligenceId: { not: null },
            OR: [
              { tasteNote: null },
              { tasteNote: '' },
              { terrazzoInsight: { equals: Prisma.DbNull } },
              { matchBreakdown: { equals: Prisma.DbNull } },
            ],
          },
        });
        report.phase6 = {
          needed: totalMissing,
          batch: spsMissingTaste.length,
          places: spsMissingTaste.slice(0, 10).map((p: any) => ({
            name: p.name,
            missingTasteNote: !p.tasteNote,
            missingInsight: p.terrazzoInsight === null,
            missingBreakdown: p.matchBreakdown === null,
          })),
        };
      } else {
        // Group by userId (each user needs personalized taste matching)
        const byUser = new Map<string, typeof spsMissingTaste>();
        for (const sp of spsMissingTaste) {
          const existing = byUser.get(sp.userId) || [];
          existing.push(sp);
          byUser.set(sp.userId, existing);
        }

        let totalUpdated = 0;
        const errors: { userId: string; error: string }[] = [];

        for (const [userId, userPlaces] of byUser) {
          try {
            const count = await completeTasteFields(
              userPlaces.map((p: any) => ({
                savedPlaceId: p.id,
                name: p.name,
                type: p.type,
                location: p.location || undefined,
              })),
              userId,
            );
            totalUpdated += count;
          } catch (err) {
            errors.push({ userId, error: (err as Error).message });
          }
        }

        report.phase6 = {
          needed: spsMissingTaste.length,
          updated: totalUpdated,
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
