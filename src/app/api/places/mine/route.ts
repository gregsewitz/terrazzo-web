import { NextRequest } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const [places, shortlists] = await Promise.all([
    prisma.savedPlace.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.shortlist.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return Response.json({ places, shortlists });
}
