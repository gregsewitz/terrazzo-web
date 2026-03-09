/**
 * GET /api/cron/orphan-sweep
 *
 * Nightly cron job: find SavedPlace records that fell through the cracks
 * and ensure they have PlaceIntelligence records + enrichment triggered.
 *
 * Three passes:
 *   1. Link orphans: SavedPlace has googlePlaceId + existing PI record, but
 *      placeIntelligenceId is null (just needs linking).
 *   2. Create + enrich: SavedPlace has googlePlaceId but no PI record exists
 *      at all — create PI record and trigger enrichment.
 *   3. Resolve + enrich: SavedPlace has no googlePlaceId but has name+location —
 *      attempt Google Places resolution, then create PI + enrich.
 *
 * Also re-triggers enrichment for any PI records stuck in 'pending' or 'failed'
 * status for more than 1 hour.
 *
 * Configured in vercel.json as a Vercel Cron running nightly at 3am UTC.
 * Protected by CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureEnrichment } from '@/lib/ensure-enrichment';
import { searchPlace } from '@/lib/places';

export const maxDuration = 120; // 2 min — may need to resolve places via Google

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats = {
    linked: 0,
    created: 0,
    resolved: 0,
    retried: 0,
    resolveFailed: 0,
  };

  try {
    // ── Pass 1: Link orphans that already have a matching PI record ──────
    const linkResult = await prisma.$executeRaw`
      UPDATE "SavedPlace" sp
      SET "placeIntelligenceId" = pi.id
      FROM "PlaceIntelligence" pi
      WHERE sp."googlePlaceId" = pi."googlePlaceId"
        AND sp."googlePlaceId" IS NOT NULL
        AND sp."deletedAt" IS NULL
        AND sp."placeIntelligenceId" IS NULL
    `;
    stats.linked = linkResult;

    // ── Pass 2: Create PI records for places with googlePlaceId but no PI ─
    const unenriched = await prisma.$queryRaw<
      { googlePlaceId: string; name: string; type: string | null }[]
    >`
      SELECT DISTINCT ON (sp."googlePlaceId")
        sp."googlePlaceId", sp."name", sp."type"
      FROM "SavedPlace" sp
      LEFT JOIN "PlaceIntelligence" pi ON sp."googlePlaceId" = pi."googlePlaceId"
      WHERE sp."googlePlaceId" IS NOT NULL
        AND sp."deletedAt" IS NULL
        AND sp."placeIntelligenceId" IS NULL
        AND pi.id IS NULL
      LIMIT 200
    `;

    for (const place of unenriched) {
      try {
        await ensureEnrichment(
          place.googlePlaceId,
          place.name,
          'system_cron',
          'orphan_sweep',
          place.type || undefined,
        );
        stats.created++;
      } catch (err) {
        console.error(`[orphan-sweep] ensureEnrichment failed for ${place.name}:`, err);
      }
    }

    // ── Pass 3: Resolve places with no googlePlaceId ────────────────────
    const unresolved = await prisma.savedPlace.findMany({
      where: {
        googlePlaceId: null,
        deletedAt: null,
        name: { not: '' },
        // Skip flights/rentals — they don't have Google Place IDs
        type: { notIn: ['flight', 'rental', 'car_rental'] },
      },
      select: { id: true, name: true, location: true, type: true, userId: true },
      take: 50, // cap per run to avoid rate limiting Google
    });

    for (const place of unresolved) {
      try {
        const query = `${place.name} ${place.location || ''}`.trim();
        const result = await searchPlace(query);
        if (result?.id) {
          // Assign googlePlaceId
          await prisma.savedPlace.update({
            where: { id: place.id },
            data: { googlePlaceId: result.id },
          });
          // Trigger enrichment
          await ensureEnrichment(
            result.id,
            place.name,
            place.userId,
            'orphan_sweep_resolve',
            place.type || undefined,
          );
          stats.resolved++;
        } else {
          stats.resolveFailed++;
        }
      } catch (err) {
        console.error(`[orphan-sweep] resolve failed for ${place.name}:`, err);
        stats.resolveFailed++;
      }
    }

    // ── Pass 4: Retry stuck PI records ──────────────────────────────────
    const stuck = await prisma.placeIntelligence.findMany({
      where: {
        OR: [
          { status: 'pending', updatedAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } },
          { status: 'failed', errorCount: { lt: 3 } },
        ],
      },
      select: { id: true, googlePlaceId: true, propertyName: true, placeType: true },
      take: 200,
    });

    for (const pi of stuck) {
      try {
        await ensureEnrichment(
          pi.googlePlaceId,
          pi.propertyName,
          'system_cron',
          'orphan_sweep_retry',
          pi.placeType || undefined,
        );
        stats.retried++;
      } catch (err) {
        console.error(`[orphan-sweep] retry failed for ${pi.propertyName}:`, err);
      }
    }

    console.log(`[orphan-sweep] Complete:`, stats);
    return NextResponse.json({ ok: true, stats });
  } catch (error) {
    console.error('[orphan-sweep] Fatal error:', error);
    return NextResponse.json(
      { error: 'Orphan sweep failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
