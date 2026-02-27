import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { searchPlace } from '@/lib/places';
import { ensureEnrichment } from '@/lib/ensure-enrichment';

/**
 * POST /api/admin/backfill-place-ids
 *
 * One-off backfill: walks all users with a tasteProfile, resolves
 * matchedProperties via Google Places API, and stamps googlePlaceId
 * on each property. Also clears stale discover caches client-side
 * (users will need to clear localStorage themselves or we rely on
 * new archetype keys).
 *
 * Auth: requires ADMIN_SECRET in Authorization header.
 *
 * Optional body:
 *   { dryRun?: boolean, userIds?: string[] }
 *
 *   dryRun=true  — resolve but don't write to DB (preview mode)
 *   userIds      — limit to specific users (useful for testing)
 */
export async function POST(req: NextRequest) {
  // Simple secret-based auth for admin endpoints
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const dryRun = body.dryRun === true;
  const force = body.force === true; // Re-resolve even if googlePlaceId already exists
  const filterUserIds: string[] | undefined = body.userIds;

  // Fetch all users with a tasteProfile
  const where: Record<string, unknown> = { tasteProfile: { not: null } };
  if (filterUserIds?.length) {
    where.id = { in: filterUserIds };
  }

  const users = await prisma.user.findMany({
    where: where as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    select: { id: true, tasteProfile: true },
  });

  const results: Array<{
    userId: string;
    total: number;
    resolved: number;
    alreadyResolved: number;
    failed: string[];
    updated: boolean;
  }> = [];

  for (const user of users) {
    const profile = user.tasteProfile as Record<string, unknown> | null;
    if (!profile) continue;

    const matchedProps = (profile.matchedProperties || []) as Array<{
      name: string;
      location: string;
      googlePlaceId?: string;
      [key: string]: unknown;
    }>;

    if (matchedProps.length === 0) {
      results.push({
        userId: user.id,
        total: 0,
        resolved: 0,
        alreadyResolved: 0,
        failed: [],
        updated: false,
      });
      continue;
    }

    let resolved = 0;
    let alreadyResolved = 0;
    const failed: string[] = [];

    // Resolve concurrently
    await Promise.allSettled(
      matchedProps.map(async (prop) => {
        // Skip if already has a googlePlaceId (unless force=true)
        if (prop.googlePlaceId && !force) {
          alreadyResolved++;
          return;
        }

        try {
          const query = prop.location
            ? `${prop.name}, ${prop.location}`
            : prop.name;
          const googleResult = await searchPlace(query);
          if (!googleResult) {
            failed.push(`${prop.name}: not found`);
            return;
          }

          prop.googlePlaceId = googleResult.id;
          resolved++;

          // Fire-and-forget enrichment
          const resolvedName = googleResult.displayName?.text || prop.name;
          ensureEnrichment(googleResult.id, resolvedName, user.id, 'backfill').catch(() => {});
        } catch (err) {
          failed.push(`${prop.name}: ${err instanceof Error ? err.message : 'error'}`);
        }
      }),
    );

    // Write back to DB if anything changed
    let updated = false;
    if (resolved > 0 && !dryRun) {
      await prisma.user.update({
        where: { id: user.id },
        data: { tasteProfile: JSON.parse(JSON.stringify({ ...profile, matchedProperties: matchedProps })) },
      });
      updated = true;
    }

    results.push({
      userId: user.id,
      total: matchedProps.length,
      resolved,
      alreadyResolved,
      failed,
      updated,
    });
  }

  const summary = {
    dryRun,
    totalUsers: results.length,
    usersUpdated: results.filter((r) => r.updated).length,
    totalProperties: results.reduce((s, r) => s + r.total, 0),
    totalResolved: results.reduce((s, r) => s + r.resolved, 0),
    totalAlreadyResolved: results.reduce((s, r) => s + r.alreadyResolved, 0),
    totalFailed: results.reduce((s, r) => s + r.failed.length, 0),
    details: results,
  };

  console.log('[backfill-place-ids]', JSON.stringify(summary, null, 2));
  return NextResponse.json(summary);
}
