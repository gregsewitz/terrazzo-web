import { NextRequest } from 'next/server';
import { getUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';

export type TripRole = 'owner' | 'suggester' | 'viewer' | null;

interface TripAccess {
  user: { id: string; email: string; name: string | null } | null;
  role: TripRole;
}

/**
 * Get the authenticated user's access level for a trip.
 * Returns { user, role } where role is 'owner' | 'suggester' | 'viewer' | null.
 */
export async function getTripAccess(req: NextRequest, tripId: string): Promise<TripAccess> {
  const user = await getUser(req);
  if (!user) return { user: null, role: null };

  // Check if owner
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { userId: true },
  });

  if (!trip) return { user, role: null };
  if (trip.userId === user.id) return { user, role: 'owner' };

  // Check if collaborator
  const collaborator = await prisma.tripCollaborator.findUnique({
    where: { tripId_userId: { tripId, userId: user.id } },
    select: { role: true, status: true },
  });

  if (!collaborator || collaborator.status !== 'accepted') {
    return { user, role: null };
  }

  return { user, role: collaborator.role as TripRole };
}

/**
 * Helper to log a TripActivity event (fire-and-forget).
 */
export function logTripActivity(
  tripId: string,
  userId: string | null,
  type: string,
  summary: string,
  data?: Record<string, unknown>,
) {
  // Fire and forget — don't await
  prisma.tripActivity.create({
    data: { tripId, userId, type, summary, data: data || undefined },
  }).catch(() => {}); // Silently ignore errors
}
