import { NextRequest } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const updates = await req.json();

  // Verify ownership
  const existing = await prisma.savedPlace.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return Response.json({ error: 'Place not found' }, { status: 404 });
  }

  const place = await prisma.savedPlace.update({
    where: { id },
    data: {
      ...(updates.rating !== undefined && { rating: updates.rating }),
      ...(updates.isShortlisted !== undefined && { isShortlisted: updates.isShortlisted }),
      ...(updates.userContext !== undefined && { userContext: updates.userContext }),
      ...(updates.matchScore !== undefined && { matchScore: updates.matchScore }),
      ...(updates.matchBreakdown !== undefined && { matchBreakdown: updates.matchBreakdown }),
      ...(updates.tasteNote !== undefined && { tasteNote: updates.tasteNote }),
    },
  });

  return Response.json({ place });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { id } = await params;

  // Verify ownership
  const existing = await prisma.savedPlace.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return Response.json({ error: 'Place not found' }, { status: 404 });
  }

  await prisma.savedPlace.delete({ where: { id } });
  return Response.json({ success: true });
}
