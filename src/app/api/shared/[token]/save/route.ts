import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authHandler } from '@/lib/api-auth-handler';
import type { User } from '@prisma/client';

/**
 * POST /api/shared/[token]/save — Save shared places to your library
 * Requires auth (you need an account to save).
 */
export const POST = authHandler(async (req: NextRequest, { params }: { params: Promise<{ token: string }> }, user: User) => {

  const { token } = await params;
  const { placeIds, saveAll, createShortlist } = await req.json() as {
    placeIds?: string[];
    saveAll?: boolean;
    createShortlist?: boolean;
  };

  // Validate share link
  const shareLink = await prisma.shareLink.findUnique({
    where: { token },
  });

  if (!shareLink || !shareLink.isActive) {
    return Response.json({ error: 'Share link not found' }, { status: 404 });
  }

  if (shareLink.resourceType !== 'shortlist') {
    return Response.json({ error: 'Can only save from shared shortlists' }, { status: 400 });
  }

  // Get the shortlist
  const shortlist = await prisma.shortlist.findUnique({
    where: { id: shareLink.resourceId },
  });

  if (!shortlist) {
    return Response.json({ error: 'Shortlist no longer exists' }, { status: 404 });
  }

  // Determine which place IDs to save
  const allPlaceIds = (shortlist.placeIds as string[]) || [];
  const targetIds = saveAll ? allPlaceIds : (placeIds || []);

  if (targetIds.length === 0) {
    return Response.json({ error: 'No places to save' }, { status: 400 });
  }

  // Fetch source places
  const sourcePlaces = await prisma.savedPlace.findMany({
    where: { id: { in: targetIds } },
  });

  // Create copies for the recipient, skipping duplicates (same googlePlaceId)
  const existingGoogleIds = new Set(
    (await prisma.savedPlace.findMany({
      where: {
        userId: user.id,
        googlePlaceId: { in: sourcePlaces.filter(p => p.googlePlaceId).map(p => p.googlePlaceId!) },
      },
      select: { googlePlaceId: true },
    })).map(p => p.googlePlaceId)
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toJson = (v: unknown) => v === null || v === undefined ? undefined : v as any;

  const newPlaces = sourcePlaces
    .filter(p => !p.googlePlaceId || !existingGoogleIds.has(p.googlePlaceId))
    .map(p => ({
      userId: user.id,
      googlePlaceId: p.googlePlaceId,
      name: p.name,
      type: p.type,
      location: p.location || '',
      source: { type: 'shared', name: shortlist.name } as Record<string, string>,
      ghostSource: 'friend',
      matchScore: p.matchScore,
      matchBreakdown: toJson(p.matchBreakdown),
      tasteNote: p.tasteNote,
      enrichment: toJson(p.enrichment),
      whatToOrder: toJson(p.whatToOrder),
      tips: toJson(p.tips),
      googleData: toJson(p.googleData),
      terrazzoInsight: toJson(p.terrazzoInsight),
      placeIntelligenceId: p.placeIntelligenceId,
      isShortlisted: false,
    }));

  let savedCount = 0;
  const newPlaceIds: string[] = [];

  if (newPlaces.length > 0) {
    // Create in a transaction
    const created = await prisma.$transaction(
      newPlaces.map(p => prisma.savedPlace.create({ data: p }))
    );
    savedCount = created.length;
    newPlaceIds.push(...created.map(p => p.id));
  }

  // Optionally create a shortlist with these places
  let newShortlist = null;
  if (createShortlist && newPlaceIds.length > 0) {
    const ownerName = (await prisma.user.findUnique({
      where: { id: shareLink.userId },
      select: { name: true, email: true },
    }));
    const fromName = ownerName?.name || ownerName?.email?.split('@')[0] || 'a friend';

    newShortlist = await prisma.shortlist.create({
      data: {
        userId: user.id,
        name: `${shortlist.name} (from ${fromName})`,
        description: shortlist.description,
        emoji: shortlist.emoji,
        placeIds: newPlaceIds,
      },
    });
  }

  return Response.json({
    savedCount,
    skippedCount: sourcePlaces.length - newPlaces.length,
    shortlist: newShortlist,
  });
});
