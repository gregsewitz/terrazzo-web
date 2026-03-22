/**
 * GET /api/cron/orphan-sweep
 *
 * Nightly cron job: find SavedPlace records that fell through the cracks
 * and ensure they have PlaceIntelligence records + enrichment triggered.
 *
 * Six passes:
 *   1. Link orphans: SavedPlace has googlePlaceId + existing PI record, but
 *      placeIntelligenceId is null (just needs linking).
 *   2. Create + enrich: SavedPlace has googlePlaceId but no PI record exists
 *      at all — create PI record and trigger enrichment.
 *   3. Resolve + enrich: SavedPlace has no googlePlaceId but has name+location —
 *      attempt Google Places resolution, then create PI + enrich.
 *   4. Retry stuck: Re-trigger enrichment for any PI records stuck in 'pending'
 *      or 'failed' status, using exponential backoff based on errorCount.
 *   5. Re-enrich empty: Re-trigger PI records marked 'complete' but with no
 *      signals, description, or embedding — these completed without producing
 *      useful data.
 *   6. Re-enrich under-enriched: Re-trigger PI records marked 'complete' but
 *      with suspiciously few signals (below MIN_ENRICHMENT_SIGNAL_COUNT).
 *      These likely had a partial pipeline failure that still produced some
 *      data. Only retries once (checks lastError to avoid re-triggering).
 *
 * Configured in vercel.json as a Vercel Cron running nightly at 3am UTC.
 * Protected by CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureEnrichment } from '@/lib/ensure-enrichment';
import { resolveGooglePlaceWithRetry, resolveGooglePlaceType } from '@/lib/places';
import { resolveBackoffDays, enrichmentBackoffHours, MIN_ENRICHMENT_SIGNAL_COUNT } from '@/lib/constants';

export const maxDuration = 300; // 5 min — may need to resolve many places via Google

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
    reEnriched: 0,
    reEnrichedUnder: 0,
    resolveFailed: 0,
    retrySkippedBackoff: 0,
  };

  try {
    const now = Date.now();

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

    // Also link Place (trip places) to intelligence records
    await prisma.$executeRaw`
      UPDATE "Place" p
      SET "placeIntelligenceId" = pi.id
      FROM "PlaceIntelligence" pi
      WHERE p."googlePlaceId" = pi."googlePlaceId"
        AND p."googlePlaceId" IS NOT NULL
        AND p."placeIntelligenceId" IS NULL
    `;

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
      LIMIT 500
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
    // Uses multi-strategy resolution (up to 5 query formats per place).
    // Tracks resolveAttempts with exponential backoff to avoid wasting
    // Google API calls on truly unresolvable places:
    //   attempts 0-2  → retry every night
    //   attempts 3-5  → retry every 3 days
    //   attempts 6-9  → retry every 7 days
    //   attempts 10+  → retry every 30 days
    //
    // Uses raw SQL for resolveAttempts/lastResolveAt since these fields
    // may not yet exist in the Prisma client (migration pending).
    const unresolved = await prisma.$queryRaw<
      { id: string; name: string; location: string | null; type: string; userId: string; resolveAttempts: number; lastResolveAt: Date | null }[]
    >`
      SELECT id, name, location, type, "userId",
        COALESCE("resolveAttempts", 0)::int as "resolveAttempts",
        "lastResolveAt"
      FROM "SavedPlace"
      WHERE "googlePlaceId" IS NULL
        AND "deletedAt" IS NULL
        AND name != ''
        AND type NOT IN ('flight', 'rental', 'car_rental')
      ORDER BY COALESCE("resolveAttempts", 0) ASC, "createdAt" DESC
      LIMIT 300
    `;

    for (const place of unresolved) {
      // Apply backoff based on previous attempts
      if (place.lastResolveAt && place.resolveAttempts > 0) {
        const backoffMs = resolveBackoffDays(place.resolveAttempts) * 24 * 60 * 60 * 1000;
        const timeSinceLastAttempt = now - new Date(place.lastResolveAt).getTime();
        if (timeSinceLastAttempt < backoffMs) {
          continue; // Not enough time since last attempt
        }
      }

      try {
        // Multi-strategy resolution: tries name+location, name+city, name-only, type+name
        const result = await resolveGooglePlaceWithRetry(
          place.name,
          place.location,
          place.type,
        );

        // Always update attempt tracking regardless of outcome (raw SQL for new fields)
        await prisma.$executeRaw`
          UPDATE "SavedPlace"
          SET "resolveAttempts" = COALESCE("resolveAttempts", 0) + 1,
              "lastResolveAt" = NOW()
          WHERE id = ${place.id}
        `;

        if (result?.id) {
          // Resolve the type from Google data
          const resolvedType = resolveGooglePlaceType(
            result.primaryType,
            result.types,
            result.displayName?.text || place.name,
          );

          // Assign googlePlaceId + Google data
          await prisma.savedPlace.update({
            where: { id: place.id },
            data: {
              googlePlaceId: result.id,
              type: resolvedType,
              location: result.formattedAddress || place.location || '',
              googleData: {
                placeId: result.id,
                rating: result.rating,
                reviewCount: result.userRatingCount,
                address: result.formattedAddress,
                lat: result.location?.latitude,
                lng: result.location?.longitude,
              },
            },
          });
          // Trigger enrichment
          await ensureEnrichment(
            result.id,
            place.name,
            place.userId,
            'orphan_sweep_resolve',
            resolvedType,
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

    // ── Pass 4: Retry stuck PI records with exponential backoff ──────────
    // Instead of hard-capping at errorCount < 3, use time-based backoff:
    //   errorCount 0-2  → retry after 1 hour   (same as before)
    //   errorCount 3-5  → retry after 24 hours  (1 day)
    //   errorCount 6-9  → retry after 72 hours  (3 days)
    //   errorCount 10+  → retry after 168 hours (1 week)
    // This ensures no place is permanently abandoned, but avoids hammering
    // places that consistently fail.
    const stuck = await prisma.placeIntelligence.findMany({
      where: {
        OR: [
          // Pending for more than 1 hour (likely trigger failed silently)
          { status: 'pending', updatedAt: { lt: new Date(now - 60 * 60 * 1000) } },
          // Failed — include ALL regardless of errorCount, we'll filter by backoff below
          { status: 'failed' },
        ],
      },
      select: {
        id: true,
        googlePlaceId: true,
        propertyName: true,
        placeType: true,
        errorCount: true,
        lastErrorAt: true,
        status: true,
      },
      take: 500, // raised from 200
    });

    for (const pi of stuck) {
      // Apply exponential backoff for failed records
      if (pi.status === 'failed' && pi.lastErrorAt) {
        const backoffMs = enrichmentBackoffHours(pi.errorCount) * 60 * 60 * 1000;
        const timeSinceLastError = now - new Date(pi.lastErrorAt).getTime();

        if (timeSinceLastError < backoffMs) {
          stats.retrySkippedBackoff++;
          continue; // Not enough time has passed, skip this one
        }
      }

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

    // ── Pass 5: Re-enrich "complete but empty" PI records ────────────────
    // These finished the pipeline but produced no useful data (empty signals,
    // no description, no embedding). Reset them to 'pending' and re-trigger.
    const emptyComplete = await prisma.$queryRaw<
      { id: string; googlePlaceId: string; propertyName: string; placeType: string | null }[]
    >`
      SELECT id, "googlePlaceId", "propertyName", "placeType"
      FROM "PlaceIntelligence"
      WHERE status = 'complete'
        AND (
          "signals" IS NULL
          OR "signals" = '[]'
          OR "signals"::text = '[]'
        )
        AND "embeddingV3" IS NULL
        AND "description" IS NULL
      LIMIT 200
    `;

    for (const pi of emptyComplete) {
      try {
        // Reset status so ensureEnrichment will re-trigger
        await prisma.placeIntelligence.update({
          where: { id: pi.id },
          data: { status: 'failed', lastError: 'Complete but empty — reset by orphan-sweep' },
        });
        await ensureEnrichment(
          pi.googlePlaceId,
          pi.propertyName,
          'system_cron',
          'orphan_sweep_empty',
          pi.placeType || undefined,
        );
        stats.reEnriched++;
      } catch (err) {
        console.error(`[orphan-sweep] re-enrich failed for ${pi.propertyName}:`, err);
      }
    }

    // ── Pass 6: Re-enrich "complete but under-enriched" PI records ──────
    // These finished the pipeline but produced suspiciously few signals,
    // likely due to a partial pipeline failure (e.g., review scraping
    // failed, some domain analyses timed out, etc.). Reset and re-trigger.
    // Only retry once — skip records already flagged by a previous sweep.
    const underEnriched = await prisma.$queryRaw<
      { id: string; googlePlaceId: string; propertyName: string; placeType: string | null; signalCount: number }[]
    >`
      SELECT id, "googlePlaceId", "propertyName", "placeType", "signalCount"
      FROM "PlaceIntelligence"
      WHERE status = 'complete'
        AND "signalCount" IS NOT NULL
        AND "signalCount" > 0
        AND "signalCount" < ${MIN_ENRICHMENT_SIGNAL_COUNT}
        AND ("lastError" IS NULL OR "lastError" NOT LIKE '%under-enriched%')
      LIMIT 50
    `;

    for (const pi of underEnriched) {
      try {
        await prisma.placeIntelligence.update({
          where: { id: pi.id },
          data: {
            status: 'failed',
            lastError: `Complete but under-enriched (${pi.signalCount} signals < ${MIN_ENRICHMENT_SIGNAL_COUNT}) — reset by orphan-sweep`,
          },
        });
        await ensureEnrichment(
          pi.googlePlaceId,
          pi.propertyName,
          'system_cron',
          'orphan_sweep_under_enriched',
          pi.placeType || undefined,
        );
        stats.reEnrichedUnder++;
        console.log(`[orphan-sweep] Re-enriching under-enriched: ${pi.propertyName} (${pi.signalCount} signals)`);
      } catch (err) {
        console.error(`[orphan-sweep] re-enrich (under) failed for ${pi.propertyName}:`, err);
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
