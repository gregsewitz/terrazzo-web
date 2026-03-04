import { NextRequest } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { apiHandler } from '@/lib/api-handler';

export const GET = apiHandler(async (req: NextRequest) => {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const [places, collections] = await Promise.all([
    prisma.savedPlace.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        intelligence: {
          select: {
            description: true,
            whatToOrder: true,
            tips: true,
            alsoKnownAs: true,
            googleData: true,
            formalityLevel: true,
            cuisineStyle: true,
            status: true,
          },
        },
      },
    }),
    prisma.shortlist.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return Response.json({ places, collections }, {
    headers: { 'Cache-Control': 'private, no-cache' },
  });
});
