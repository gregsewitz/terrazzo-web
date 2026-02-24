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
    return Response.json({ error: 'Shortlist not found' }, { status: 404 });
  }

  const shortlist = await prisma.shortlist.update({
    where: { id },
    data: {
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.emoji !== undefined && { emoji: updates.emoji }),
      ...(updates.placeIds !== undefined && { placeIds: updates.placeIds }),
      ...(updates.filterTags !== undefined && { filterTags: updates.filterTags }),
    },
  });

  return Response.json({ shortlist });
});

export const DELETE = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { id } = await params;

  const existing = await prisma.shortlist.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return Response.json({ error: 'Shortlist not found' }, { status: 404 });
  }

  await prisma.shortlist.delete({ where: { id } });
  return Response.json({ success: true });
});
