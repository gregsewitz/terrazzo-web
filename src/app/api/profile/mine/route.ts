import { NextRequest } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  // Cast to access mosaicData (may not exist in generated Prisma client yet)
  const userData = user as Record<string, unknown>;

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      tasteProfile: user.tasteProfile,
      lifeContext: user.lifeContext,
      allSignals: user.allSignals,
      allContradictions: user.allContradictions,
      seedTrips: user.seedTrips,
      trustedSources: user.trustedSources,
      mosaicData: userData.mosaicData ?? null,
      isOnboardingComplete: user.isOnboardingComplete,
      onboardingDepth: user.onboardingDepth,
    },
  });
}
