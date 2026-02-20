import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { logTripActivity } from '@/lib/trip-access';

/**
 * PATCH /api/trips/[id]/collaborators/[collaboratorId] — Accept/decline invite.
 * Body: { status: "accepted" | "declined" }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; collaboratorId: string }> },
) {
  const { id: tripId, collaboratorId } = await params;
  const user = await getUser(req);
  if (!user) return unauthorized();

  const collaborator = await prisma.tripCollaborator.findUnique({
    where: { id: collaboratorId },
    include: { trip: { select: { name: true } } },
  });

  if (!collaborator || collaborator.tripId !== tripId) {
    return Response.json({ error: 'Collaborator not found' }, { status: 404 });
  }

  // Only the invited user can accept/decline
  if (collaborator.userId !== user.id) {
    return Response.json({ error: 'Not your invitation' }, { status: 403 });
  }

  const body = await req.json();
  const { status } = body;

  if (!['accepted', 'declined'].includes(status)) {
    return Response.json({ error: 'Status must be accepted or declined' }, { status: 400 });
  }

  const updated = await prisma.tripCollaborator.update({
    where: { id: collaboratorId },
    data: {
      status,
      acceptedAt: status === 'accepted' ? new Date() : undefined,
    },
  });

  if (status === 'accepted') {
    logTripActivity(
      tripId,
      user.id,
      'collaborator_joined',
      `${user.name || user.email} joined ${collaborator.trip.name}`,
      { collaboratorId, role: updated.role },
    );
  }

  return Response.json({ collaborator: updated });
}

/**
 * DELETE /api/trips/[id]/collaborators/[collaboratorId] — Remove collaborator.
 * Owner only.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; collaboratorId: string }> },
) {
  const { id: tripId, collaboratorId } = await params;
  const user = await getUser(req);
  if (!user) return unauthorized();

  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { userId: true } });
  if (!trip || trip.userId !== user.id) {
    return Response.json({ error: 'Only the trip owner can remove collaborators' }, { status: 403 });
  }

  await prisma.tripCollaborator.delete({ where: { id: collaboratorId } });
  return Response.json({ success: true });
}
