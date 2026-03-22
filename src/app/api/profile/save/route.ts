import { NextRequest } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { apiHandler } from '@/lib/api-handler';

export const POST = apiHandler(async (req: NextRequest) => {
  const user = await getUser(req);
  if (!user) return unauthorized();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = await req.json();

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(body.tasteProfile !== undefined && { tasteProfile: body.tasteProfile }),
      ...(body.lifeContext !== undefined && { lifeContext: body.lifeContext }),
      // allSignals still written for backward compat during transition.
      // TasteNode (written by /api/onboarding/extract) is now the canonical store.
      ...(body.allSignals !== undefined && { allSignals: body.allSignals }),
      ...(body.allMessages !== undefined && { allMessages: body.allMessages }),
      ...(body.allContradictions !== undefined && { allContradictions: body.allContradictions }),
      ...(body.seedTrips !== undefined && { seedTrips: body.seedTrips }),
      ...(body.trustedSources !== undefined && { trustedSources: body.trustedSources }),
      ...(body.mosaicData !== undefined && { mosaicData: body.mosaicData }),
      ...(body.isOnboardingComplete !== undefined && { isOnboardingComplete: body.isOnboardingComplete }),
      ...(body.onboardingDepth !== undefined && { onboardingDepth: body.onboardingDepth }),
      ...(body.completedPhaseIds !== undefined && { completedPhaseIds: body.completedPhaseIds }),
      ...(body.propertyAnchors !== undefined && { propertyAnchors: body.propertyAnchors }),
      ...(body.tasteStructure !== undefined && { tasteStructure: body.tasteStructure }),
      // Sustainability signals — relation, so use deleteMany + createMany
      ...(body.sustainabilitySignals !== undefined && {
        sustainabilitySignals: {
          deleteMany: {},
          createMany: {
            data: (body.sustainabilitySignals as Array<{ tag: string; confidence: number; dimension: string }>).map(
              (s) => ({
                tag: s.tag,
                confidence: s.confidence,
                dimension: s.dimension,
              }),
            ),
          },
        },
      }),
      // V3 act-routing state — pack into single JSON column for cross-device resume
      ...((body.currentAct !== undefined || body.skippedPhaseIds !== undefined) && {
        onboardingRouting: {
          currentAct: body.currentAct ?? 1,
          skippedPhaseIds: body.skippedPhaseIds ?? [],
          act1GapResult: body.act1GapResult ?? null,
          act2GapResult: body.act2GapResult ?? null,
        },
      }),
    },
  });

  return Response.json({ user: updated });
});
