import { NextRequest } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { apiHandler } from '@/lib/api-handler';

export const PATCH = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const updates = await req.json();

  const existing = await prisma.trip.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return Response.json({ error: 'Trip not found' }, { status: 404 });
  }

  const trip = await prisma.trip.update({
    where: { id },
    data: {
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.days !== undefined && { days: updates.days }),
      ...(updates.pool !== undefined && { pool: updates.pool }),
      ...(updates.conversationHistory !== undefined && { conversationHistory: updates.conversationHistory }),
      ...(updates.status !== undefined && { status: updates.status }),
      ...(updates.destinations !== undefined && { destinations: updates.destinations }),
      ...(updates.endDate !== undefined && { endDate: new Date(updates.endDate) }),
      ...(updates.startDate !== undefined && { startDate: new Date(updates.startDate) }),
      ...(updates.location !== undefined && { location: updates.location }),
    },
  });

  return Response.json({ trip });
});

export const DELETE = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { id } = await params;

  const existing = await prisma.trip.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return Response.json({ error: 'Trip not found' }, { status: 404 });
  }

  await prisma.trip.delete({ where: { id } });
  return Response.json({ success: true });
});
