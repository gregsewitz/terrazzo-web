import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTripAccess } from '@/lib/trip-access';

/**
 * GET /api/trips/[id]/activity — Poll for recent activity.
 * Query params:
 *   ?since=[ISO timestamp] — Only return activities after this time
 *   ?limit=[number] — Max activities to return (default 50)
 *
 * Returns { activities, lastActivityAt }
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const { user, role } = await getTripAccess(req, tripId);
  if (!user || !role) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const since = req.nextUrl.searchParams.get('since');
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);

  const activities = await prisma.tripActivity.findMany({
    where: {
      tripId,
      ...(since ? { createdAt: { gt: new Date(since) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
  });

  const lastActivityAt = activities.length > 0
    ? activities[0].createdAt.toISOString()
    : since || null;

  return Response.json({
    activities,
    lastActivityAt,
    count: activities.length,
  });
}
