import { NextRequest } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { apiHandler } from '@/lib/api-handler';

export const PATCH = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const updates = await req.json();

  const existing = await prisma.shortlist.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return Response.json({ error: 'Collection not found' }, { status: 404 });
  }

  const collection = await prisma.shortlist.update({
    where: { id },
    data: {
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.emoji !== undefined && { emoji: updates.emoji }),
      ...(updates.placeIds !== undefined && { placeIds: updates.placeIds }),
      ...(updates.filterTags !== undefined && { filterTags: updates.filterTags }),
    },
  });

  return Response.json({ collection });
});

/**
 * DELETE /api/collections/[id]
 *
 * Deletes a collection. Places inside stay in the library (they just
 * become "uncollected"). Also deactivates any active share links
 * for this collection.
 */
export const DELETE = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { id } = await params;

  const existing = await prisma.shortlist.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return Response.json({ error: 'Collection not found' }, { status: 404 });
  }

  // Prevent deleting the default "Favorites" collection
  if (existing.isDefault) {
    return Response.json(
      { error: 'Cannot delete the default Favorites collection' },
      { status: 400 },
    );
  }

  // Deactivate share links + delete collection in a transaction
  await prisma.$transaction([
    prisma.shareLink.updateMany({
      where: {
        userId: user.id,
        resourceType: 'shortlist',
        resourceId: id,
        isActive: true,
      },
      data: { isActive: false },
    }),
    prisma.shortlist.delete({ where: { id } }),
  ]);

  return Response.json({
    success: true,
    placeCount: (existing.placeIds as string[]).length,
  });
});
