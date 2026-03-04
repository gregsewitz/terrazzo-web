import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPlaceById, mapGoogleTypeToPlaceType } from '@/lib/places';

/**
 * POST /api/admin/backfill-place-types
 *
 * Backfills placeType on all PlaceIntelligence records that don't have one yet.
 * Looks up each googlePlaceId via Google Places API and maps primaryType
 * to internal categories (hotel, restaurant, bar, cafe, etc.).
 *
 * Auth: requires ADMIN_SECRET in Authorization header.
 *
 * Optional body:
 *   { dryRun?: boolean, limit?: number, batchSize?: number }
 *
 *   dryRun=true  — resolve but don't write to DB (preview mode)
 *   limit        — max records to process (default: all)
 *   batchSize    — concurrent lookups per batch (default: 10)
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const dryRun = body.dryRun === true;
  const limit: number | undefined = body.limit;
  const batchSize = body.batchSize || 10;

  // Find all PlaceIntelligence records missing placeType
  const records = await prisma.placeIntelligence.findMany({
    where: { placeType: null },
    select: { id: true, googlePlaceId: true, propertyName: true },
    ...(limit ? { take: limit } : {}),
    orderBy: { createdAt: 'desc' },
  });

  console.log(`[backfill-place-types] Found ${records.length} records missing placeType`);

  let resolved = 0;
  let failed = 0;
  const failures: Array<{ id: string; name: string; error: string }> = [];
  const typeCounts: Record<string, number> = {};

  // Process in batches to avoid hammering the Google API
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(async (record) => {
        try {
          const googleResult = await getPlaceById(record.googlePlaceId);
          if (!googleResult) {
            return { id: record.id, name: record.propertyName, placeType: null, error: 'not found' };
          }

          const placeType = mapGoogleTypeToPlaceType(googleResult.primaryType);
          return { id: record.id, name: record.propertyName, placeType, error: null };
        } catch (err) {
          return {
            id: record.id,
            name: record.propertyName,
            placeType: null,
            error: err instanceof Error ? err.message : 'unknown error',
          };
        }
      }),
    );

    // Process results and write to DB
    for (const result of results) {
      if (result.status === 'rejected') {
        failed++;
        failures.push({ id: 'unknown', name: 'unknown', error: String(result.reason) });
        continue;
      }

      const { id, name, placeType, error } = result.value;
      if (error || !placeType) {
        failed++;
        failures.push({ id, name: name || 'unknown', error: error || 'no type resolved' });
        continue;
      }

      // Count type distribution
      typeCounts[placeType] = (typeCounts[placeType] || 0) + 1;

      if (!dryRun) {
        await prisma.placeIntelligence.update({
          where: { id },
          data: { placeType },
        });
      }
      resolved++;
    }

    // Log progress every batch
    console.log(`[backfill-place-types] Batch ${Math.floor(i / batchSize) + 1}: ${resolved} resolved, ${failed} failed (${i + batch.length}/${records.length})`);
  }

  const summary = {
    dryRun,
    totalMissing: records.length,
    resolved,
    failed,
    typeCounts,
    failures: failures.slice(0, 50), // Cap failure details
  };

  console.log('[backfill-place-types]', JSON.stringify({ ...summary, failures: `${failures.length} total` }));
  return NextResponse.json(summary);
}
