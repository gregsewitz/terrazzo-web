import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/shared/[token] — Public endpoint to fetch shared content
 * No auth required — anyone with the link can view.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const shareLink = await prisma.shareLink.findUnique({
    where: { token },
    include: { user: { select: { name: true, email: true } } },
  });

  if (!shareLink || !shareLink.isActive) {
    return Response.json({ error: 'Share link not found or expired' }, { status: 404 });
  }

  // Check expiry
  if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
    return Response.json({ error: 'Share link has expired' }, { status: 410 });
  }

  // Increment view count (fire-and-forget)
  prisma.shareLink.update({
    where: { id: shareLink.id },
    data: { viewCount: { increment: 1 } },
  }).catch(() => {});

  const ownerName = shareLink.user.name
    || shareLink.user.email.split('@')[0]
    || 'Someone';

  if (shareLink.resourceType === 'shortlist') {
    const shortlist = await prisma.shortlist.findUnique({
      where: { id: shareLink.resourceId },
    });

    if (!shortlist) {
      return Response.json({ error: 'Shortlist no longer exists' }, { status: 404 });
    }

    // Fetch the places in this shortlist
    const placeIds = (shortlist.placeIds as string[]) || [];
    const places = placeIds.length > 0
      ? await prisma.savedPlace.findMany({
          where: { id: { in: placeIds } },
          select: {
            id: true,
            name: true,
            type: true,
            location: true,
            matchScore: true,
            tasteNote: true,
            enrichment: true,
            whatToOrder: true,
            tips: true,
            googleData: true,
            ghostSource: true,
            friendAttribution: true,
            rating: true,
            terrazzoInsight: true,
          },
        })
      : [];

    return Response.json({
      type: 'shortlist',
      ownerName,
      permission: shareLink.permission,
      data: {
        shortlist: {
          id: shortlist.id,
          name: shortlist.name,
          description: shortlist.description,
          emoji: shortlist.emoji,
          placeCount: placeIds.length,
        },
        places,
      },
    });
  }

  if (shareLink.resourceType === 'trip') {
    const trip = await prisma.trip.findUnique({
      where: { id: shareLink.resourceId },
    });

    if (!trip) {
      return Response.json({ error: 'Trip no longer exists' }, { status: 404 });
    }

    return Response.json({
      type: 'trip',
      ownerName,
      permission: shareLink.permission,
      data: {
        trip: {
          id: trip.id,
          name: trip.name,
          location: trip.location,
          destinations: trip.destinations,
          startDate: trip.startDate,
          endDate: trip.endDate,
          groupSize: trip.groupSize,
          groupType: trip.groupType,
          days: trip.days,
          status: trip.status,
        },
      },
    });
  }

  return Response.json({ error: 'Unknown resource type' }, { status: 400 });
}
