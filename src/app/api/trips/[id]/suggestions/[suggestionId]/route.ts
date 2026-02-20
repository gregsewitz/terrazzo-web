import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTripAccess, logTripActivity } from '@/lib/trip-access';

/**
 * PATCH /api/trips/[id]/suggestions/[suggestionId] — Accept or reject a suggestion.
 * Owner only.
 * Body: { status: "accepted" | "rejected" }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; suggestionId: string }> },
) {
  const { id: tripId, suggestionId } = await params;
  const { user, role } = await getTripAccess(req, tripId);

  if (!user || role !== 'owner') {
    return Response.json({ error: 'Only the trip owner can respond to suggestions' }, { status: 403 });
  }

  const body = await req.json();
  const { status } = body;

  if (!['accepted', 'rejected'].includes(status)) {
    return Response.json({ error: 'Status must be accepted or rejected' }, { status: 400 });
  }

  const suggestion = await prisma.tripSuggestion.findUnique({
    where: { id: suggestionId },
    include: { user: { select: { name: true, email: true } } },
  });

  if (!suggestion || suggestion.tripId !== tripId) {
    return Response.json({ error: 'Suggestion not found' }, { status: 404 });
  }

  const updated = await prisma.tripSuggestion.update({
    where: { id: suggestionId },
    data: { status, respondedAt: new Date() },
  });

  const suggestedBy = suggestion.user.name || suggestion.user.email;
  logTripActivity(
    tripId,
    user.id,
    status === 'accepted' ? 'suggestion_accepted' : 'suggestion_rejected',
    `${user.name || user.email} ${status} ${suggestedBy}'s suggestion of ${suggestion.placeName}`,
    { suggestionId, placeName: suggestion.placeName, status },
  );

  return Response.json({ suggestion: updated });
}
