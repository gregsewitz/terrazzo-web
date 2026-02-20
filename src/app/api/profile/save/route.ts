import { NextRequest } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const body = await req.json();

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(body.tasteProfile !== undefined && { tasteProfile: body.tasteProfile }),
      ...(body.lifeContext !== undefined && { lifeContext: body.lifeContext }),
      ...(body.allSignals !== undefined && { allSignals: body.allSignals }),
      ...(body.allContradictions !== undefined && { allContradictions: body.allContradictions }),
      ...(body.seedTrips !== undefined && { seedTrips: body.seedTrips }),
      ...(body.trustedSources !== undefined && { trustedSources: body.trustedSources }),
      ...(body.isOnboardingComplete !== undefined && { isOnboardingComplete: body.isOnboardingComplete }),
      ...(body.onboardingDepth !== undefined && { onboardingDepth: body.onboardingDepth }),
    },
  });

  return Response.json({ user: updated });
}
