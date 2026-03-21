import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/admin/clean-user-context
 *
 * One-off cleanup: strips reservation confirmation numbers and flight codes
 * from SavedPlace.userContext fields that were populated by the email
 * reservation import pipeline. Keeps useful context (party size, time,
 * nights, activity details) while removing internal booking references
 * that shouldn't appear on place cards.
 *
 * Also cleans matching entries in Trip.pool JSON.
 *
 * Auth: requires ADMIN_SECRET in Authorization header.
 *
 * Optional body:
 *   { dryRun?: boolean }
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const dryRun = body.dryRun === true;

  // ── 1. Clean SavedPlace.userContext ───────────────────────────────────────

  const places = await prisma.savedPlace.findMany({
    where: {
      userContext: { not: null },
    },
    select: { id: true, userContext: true },
  });

  let placesUpdated = 0;
  let placesSkipped = 0;
  const placeChanges: Array<{ id: string; before: string; after: string }> = [];

  for (const place of places) {
    const original = place.userContext;
    if (!original) continue;

    const cleaned = cleanContext(original);
    if (cleaned === original) {
      placesSkipped++;
      continue;
    }

    placeChanges.push({ id: place.id, before: original, after: cleaned });

    if (!dryRun) {
      await prisma.savedPlace.update({
        where: { id: place.id },
        data: { userContext: cleaned || null },
      });
    }
    placesUpdated++;
  }

  // ── 2. Clean Trip.pool JSON ──────────────────────────────────────────────

  const trips = await prisma.trip.findMany({
    where: { pool: { not: { equals: [] } } },
    select: { id: true, pool: true },
  });

  let tripsUpdated = 0;

  for (const trip of trips) {
    const pool = (trip.pool as unknown[] || []) as Array<Record<string, unknown>>;
    let anyChanged = false;

    const cleanedPool = pool.map((item) => {
      const ctx = item.userContext as string | undefined;
      if (!ctx) return item;

      const cleaned = cleanContext(ctx);
      if (cleaned === ctx) return item;

      anyChanged = true;
      return { ...item, userContext: cleaned || undefined };
    });

    if (anyChanged) {
      tripsUpdated++;
      if (!dryRun) {
        await prisma.trip.update({
          where: { id: trip.id },
          data: { pool: cleanedPool as unknown as import('@prisma/client').Prisma.InputJsonValue },
        });
      }
    }
  }

  return NextResponse.json({
    dryRun,
    savedPlaces: {
      total: places.length,
      updated: placesUpdated,
      skipped: placesSkipped,
      changes: dryRun ? placeChanges : undefined,
    },
    trips: {
      total: trips.length,
      updated: tripsUpdated,
    },
  });
}

/**
 * Strip reservation-specific details from a userContext string while
 * keeping useful travel context (party size, time, nights, etc).
 *
 * Removes:
 *   - "Confirmation: XXXXX" segments
 *   - "Flight XXXX" segments (the flight number itself; route is kept)
 *
 * Keeps:
 *   - "Party of N"
 *   - "Time: HH:MM"
 *   - "N nights"
 *   - Airport routes like "DUB → EWR"
 *   - Activity details
 */
function cleanContext(ctx: string): string {
  const parts = ctx.split(' · ');
  const cleaned = parts.filter((part) => {
    // Remove confirmation numbers
    if (/^Confirmation:\s/i.test(part)) return false;
    // Remove standalone flight numbers (but keep airport routes)
    if (/^Flight\s+\w+$/i.test(part)) return false;
    return true;
  });
  return cleaned.join(' · ');
}
