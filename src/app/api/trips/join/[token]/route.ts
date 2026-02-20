import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/trips/join/[token] — Get invite details (public, no auth required).
 * Used by the join page to display trip info before accepting.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const collaborator = await prisma.tripCollaborator.findUnique({
    where: { inviteToken: token },
    include: {
      trip: { select: { id: true, name: true, location: true, destinations: true } },
      user: { select: { email: true } }, // The invited user
    },
  });

  if (!collaborator) {
    return Response.json({ error: 'Invite not found' }, { status: 404 });
  }

  if (collaborator.status !== 'pending') {
    return Response.json({
      error: collaborator.status === 'accepted' ? 'Already accepted' : 'Invite was declined',
      tripId: collaborator.tripId,
      status: collaborator.status,
    }, { status: 410 });
  }

  // Get inviter's name
  const inviter = await prisma.user.findUnique({
    where: { id: collaborator.invitedBy },
    select: { name: true, email: true },
  });

  return Response.json({
    tripId: collaborator.tripId,
    tripName: collaborator.trip.name,
    tripLocation: collaborator.trip.location,
    tripDestinations: collaborator.trip.destinations,
    invitedBy: inviter?.name || inviter?.email?.split('@')[0] || 'Someone',
    invitedEmail: collaborator.user.email,
    role: collaborator.role,
    collaboratorId: collaborator.id,
  });
}
