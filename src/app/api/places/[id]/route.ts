import { NextRequest } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { apiHandler } from '@/lib/api-handler';

export const PATCH = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const updates = await req.json();

  // Verify ownership (exclude soft-deleted)
  const existing = await prisma.savedPlace.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  });
  if (!existing) {
    return Response.json({ error: 'Place not found' }, { status: 404 });
  }

  const place = await prisma.savedPlace.update({
    where: { id },
    data: {
      ...(updates.rating !== undefined && { rating: updates.rating }),
      /** @deprecated isFavorited — curation now happens at import time */
      ...(updates.isFavorited !== undefined && { isFavorited: updates.isFavorited }),
      ...(updates.userContext !== undefined && { userContext: updates.userContext }),
      ...(updates.matchScore !== undefined && { matchScore: updates.matchScore }),
      ...(updates.matchBreakdown !== undefined && { matchBreakdown: updates.matchBreakdown }),
      ...(updates.tasteNote !== undefined && { tasteNote: updates.tasteNote }),
    },
  });

  return Response.json({ place });
});

/**
 * DELETE /api/places/[id]
 *
 * Soft-deletes a place from the user's library.
 * This is the only truly destructive action — it cascades:
 *   1. Removes place from all collections (Shortlist.placeIds)
 *   2. Nulls out libraryPlaceId on all trip Place refs (Prisma onDelete: SetNull handles this)
 *   3. Sets deletedAt for 30-day recovery window
 *
 * The UI should call GET /api/places/[id]/deletion-impact first
 * to show the user what will be affected.
 */
export const DELETE = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { id } = await params;

  // Verify ownership (exclude already soft-deleted)
  const existing = await prisma.savedPlace.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  });
  if (!existing) {
    return Response.json({ error: 'Place not found' }, { status: 404 });
  }

  // 1. Remove from all collections (Shortlist.placeIds is a JSON array)
  const collections = await prisma.shortlist.findMany({
    where: { userId: user.id },
    select: { id: true, placeIds: true },
  });

  const collectionUpdates = collections
    .filter((c) => {
      const ids = c.placeIds as string[];
      return ids.includes(id);
    })
    .map((c) => {
      const filtered = (c.placeIds as string[]).filter((pid) => pid !== id);
      return prisma.shortlist.update({
        where: { id: c.id },
        data: { placeIds: filtered },
      });
    });

  // 2. Soft-delete the place (Prisma onDelete: SetNull on Place.libraryPlaceId
  //    will NOT fire for soft delete, so we null those refs manually)
  const softDelete = prisma.savedPlace.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  const nullTripRefs = prisma.place.updateMany({
    where: { libraryPlaceId: id },
    data: { libraryPlaceId: null },
  });

  // Execute all in a transaction
  await prisma.$transaction([
    ...collectionUpdates,
    softDelete,
    nullTripRefs,
  ]);

  return Response.json({ success: true, deletedAt: new Date().toISOString() });
});
