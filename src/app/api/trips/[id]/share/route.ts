import { NextRequest } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/trips/[id]/share — Generate a share link for a trip
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { id } = await params;

  const trip = await prisma.trip.findFirst({
    where: { id, userId: user.id },
  });
  if (!trip) {
    return Response.json({ error: 'Trip not found' }, { status: 404 });
  }

  // Check for existing active link
  const existing = await prisma.shareLink.findFirst({
    where: { resourceType: 'trip', resourceId: id, userId: user.id, isActive: true },
  });

  if (existing) {
    return Response.json({
      shareLink: existing,
      url: `/shared/${existing.token}`,
    });
  }

  const shareLink = await prisma.shareLink.create({
    data: {
      userId: user.id,
      resourceType: 'trip',
      resourceId: id,
    },
  });

  return Response.json({
    shareLink,
    url: `/shared/${shareLink.token}`,
  });
}

/**
 * DELETE /api/trips/[id]/share — Revoke sharing
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { id } = await params;

  await prisma.shareLink.updateMany({
    where: { resourceType: 'trip', resourceId: id, userId: user.id },
    data: { isActive: false },
  });

  return Response.json({ success: true });
}

/**
 * GET /api/trips/[id]/share — Check share status
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { id } = await params;

  const shareLink = await prisma.shareLink.findFirst({
    where: { resourceType: 'trip', resourceId: id, userId: user.id, isActive: true },
  });

  return Response.json({
    isShared: !!shareLink,
    shareLink: shareLink || null,
    url: shareLink ? `/shared/${shareLink.token}` : null,
  });
}
