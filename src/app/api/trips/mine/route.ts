import { NextRequest } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const trips = await prisma.trip.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
  });

  return Response.json({ trips });
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const body = await req.json();

  const trip = await prisma.trip.create({
    data: {
      userId: user.id,
      name: body.name || 'Untitled Trip',
      location: body.location || body.destinations?.[0] || '',
      destinations: body.destinations || [],
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      groupSize: body.groupSize || null,
      groupType: body.groupType || null,
      vibe: body.vibe || null,
      days: body.days || [],
      pool: body.pool || [],
      conversationHistory: body.conversationHistory || null,
      status: body.status || 'planning',
    },
  });

  return Response.json({ trip });
}
