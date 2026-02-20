import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTripAccess, logTripActivity } from '@/lib/trip-access';

/**
 * GET /api/trips/[id]/collaborators — List all collaborators for a trip.
 * Accessible by owner or any accepted collaborator.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const { user, role } = await getTripAccess(req, tripId);
  if (!user || !role) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const collaborators = await prisma.tripCollaborator.findMany({
    where: { tripId },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Also include the owner
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  return Response.json({
    owner: trip?.user,
    myRole: role,
    collaborators: collaborators.map((c: any) => ({
      id: c.id,
      userId: c.userId,
      email: c.user.email,
      name: c.user.name,
      role: c.role,
      status: c.status,
      invitedAt: c.invitedAt,
      acceptedAt: c.acceptedAt,
    })),
  });
}

/**
 * POST /api/trips/[id]/collaborators — Invite a user by email.
 * Owner only.
 * Body: { email: string, role?: "viewer" | "suggester" }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const { user, role } = await getTripAccess(req, tripId);
  if (!user || role !== 'owner') {
    return Response.json({ error: 'Only the trip owner can invite collaborators' }, { status: 403 });
  }

  const body = await req.json();
  const { email, role: inviteRole = 'suggester' } = body;

  if (!email) {
    return Response.json({ error: 'Email is required' }, { status: 400 });
  }

  // Find or create the invited user
  let invitedUser = await prisma.user.findUnique({ where: { email } });

  if (!invitedUser) {
    // Create a placeholder user — they'll link to their real auth on first login
    invitedUser = await prisma.user.create({
      data: {
        email,
        supabaseId: `pending-${email}`, // Will be updated on first login
        authProvider: 'invited',
      },
    });
  }

  // Check if already a collaborator
  const existing = await prisma.tripCollaborator.findUnique({
    where: { tripId_userId: { tripId, userId: invitedUser.id } },
  });

  if (existing) {
    return Response.json({
      collaborator: existing,
      message: existing.status === 'pending' ? 'Already invited' : 'Already a collaborator',
    });
  }

  const collaborator = await prisma.tripCollaborator.create({
    data: {
      tripId,
      userId: invitedUser.id,
      role: inviteRole,
      invitedBy: user.id,
    },
  });

  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { name: true } });

  logTripActivity(
    tripId,
    user.id,
    'collaborator_invited',
    `${user.name || user.email} invited ${email} to ${trip?.name || 'trip'}`,
    { collaboratorId: collaborator.id, email, role: inviteRole },
  );

  return Response.json({
    collaborator,
    inviteUrl: `/trips/${tripId}/join?token=${collaborator.inviteToken}`,
  });
}
