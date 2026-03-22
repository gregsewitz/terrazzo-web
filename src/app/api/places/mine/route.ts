import { NextRequest } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { apiHandler } from '@/lib/api-handler';
import { resolveExplanationLabels } from '@/lib/resolve-explanation-labels';

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

  // Resolve current display labels for any stored matchExplanation data.
  // Labels may be stale if clusters were relabeled after match computation.
  const resolvedPlaces = places.map((p: typeof places[number]) => {
    if (!p.matchExplanation) return p;
    return { ...p, matchExplanation: resolveExplanationLabels(p.matchExplanation as any) };
  });

  return Response.json({ places: resolvedPlaces, collections }, {
    headers: { 'Cache-Control': 'private, no-cache' },
  });
});
