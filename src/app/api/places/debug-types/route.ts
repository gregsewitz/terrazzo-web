import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/places/debug-types
 *
 * Temporary diagnostic: shows places typed as 'activity' that have a googlePlaceId
 * (meaning they were resolved but still typed as activity).
 * Also shows places with null googlePlaceId.
 *
 * No auth — temporary debug endpoint. Delete after investigation.
 */
export async function GET(_req: NextRequest) {
  // Places that WERE resolved (have googlePlaceId) but still typed as activity
  const resolvedButActivity = await prisma.savedPlace.findMany({
    where: {
      type: 'activity',
      googlePlaceId: { not: null },
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      type: true,
      googlePlaceId: true,
      googleData: true,
    },
    take: 50,
    orderBy: { createdAt: 'desc' },
  });

  // Places still without googlePlaceId
  const noGoogleId = await prisma.savedPlace.findMany({
    where: {
      googlePlaceId: null,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      type: true,
      googleData: true,
    },
    take: 20,
    orderBy: { createdAt: 'desc' },
  });

  // Type distribution across all places
  const typeCounts = await prisma.savedPlace.groupBy({
    by: ['type'],
    where: { deletedAt: null },
    _count: true,
  });

  return Response.json({
    typeCounts,
    resolvedButActivity: resolvedButActivity.map(p => ({
      name: p.name,
      type: p.type,
      googlePlaceId: p.googlePlaceId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      category: (p.googleData as any)?.category,
    })),
    noGoogleId: noGoogleId.map(p => ({
      name: p.name,
      type: p.type,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      category: (p.googleData as any)?.category,
    })),
  });
}
