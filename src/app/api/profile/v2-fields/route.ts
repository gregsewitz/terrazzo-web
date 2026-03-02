import { NextRequest } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/profile/v2-fields
 * Returns the user's v2 enrichment fields for gap detection in /profile/refine.
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      sustainabilitySensitivity: true,
      sustainabilityPriorities: true,
      sustainabilityDealbreakers: true,
      sustainabilityWillingnessToPayPremium: true,
      tasteTrajectoryDirection: true,
      tasteTrajectoryDescription: true,
    },
  });

  if (!record) return unauthorized();

  return Response.json({
    sustainabilitySensitivity: record.sustainabilitySensitivity,
    sustainabilityPriorities: record.sustainabilityPriorities ?? [],
    sustainabilityDealbreakers: record.sustainabilityDealbreakers ?? [],
    sustainabilityWillingnessToPayPremium: record.sustainabilityWillingnessToPayPremium,
    tasteTrajectoryDirection: record.tasteTrajectoryDirection,
    tasteTrajectoryDescription: record.tasteTrajectoryDescription,
  });
});
