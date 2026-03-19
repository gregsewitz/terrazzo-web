import { NextRequest } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { apiHandler } from '@/lib/api-handler';

export const GET = apiHandler(async (req: NextRequest) => {
  const user = await getUser(req);
  if (!user) return unauthorized();

  // Re-fetch with sustainability signals relation included
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { sustainabilitySignals: true },
  });
  if (!fullUser) return unauthorized();

  // Cast to access columns that may not be in generated Prisma client yet
  const userData = fullUser as Record<string, unknown>;

  return Response.json({
    user: {
      id: fullUser.id,
      email: fullUser.email,
      name: fullUser.name,
      tasteProfile: fullUser.tasteProfile,
      lifeContext: fullUser.lifeContext,
      allSignals: fullUser.allSignals,
      allMessages: (fullUser as Record<string, unknown>).allMessages ?? null,
      allContradictions: fullUser.allContradictions,
      sustainabilitySignals: fullUser.sustainabilitySignals ?? [],
      seedTrips: fullUser.seedTrips,
      trustedSources: fullUser.trustedSources,
      mosaicData: userData.mosaicData ?? null,
      propertyAnchors: userData.propertyAnchors ?? null,
      onboardingRouting: userData.onboardingRouting ?? null,
      isOnboardingComplete: fullUser.isOnboardingComplete,
      onboardingDepth: fullUser.onboardingDepth,
      completedPhaseIds: userData.completedPhaseIds ?? [],
    },
  }, {
    headers: { 'Cache-Control': 'private, no-cache' }
  });
});
