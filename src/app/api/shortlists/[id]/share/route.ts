import { NextRequest } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/shortlists/[id]/share — Generate a share link for a shortlist
 * Returns existing active link or creates a new one.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { id } = await params;

  // Verify ownership
  const shortlist = await prisma.shortlist.findFirst({
    where: { id, userId: user.id },
  });
  if (!shortlist) {
    return Response.json({ error: 'Shortlist not found' }, { status: 404 });
  }

  // Check for existing active link
  const existing = await prisma.shareLink.findFirst({
    where: { resourceType: 'shortlist', resourceId: id, userId: user.id, isActive: true },
  });

  if (existing) {
    return Response.json({
      shareLink: existing,
      url: `/shared/${existing.token}`,
    });
  }

  // Create new share link
  const shareLink = await prisma.shareLink.create({
    data: {
      userId: user.id,
      resourceType: 'shortlist',
      resourceId: id,
    },
  });

  return Response.json({
    shareLink,
    url: `/shared/${shareLink.token}`,
  });
}

/**
 * DELETE /api/shortlists/[id]/share — Revoke sharing for a shortlist
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { id } = await params;

  // Deactivate all share links for this shortlist
  await prisma.shareLink.updateMany({
    where: { resourceType: 'shortlist', resourceId: id, userId: user.id },
    data: { isActive: false },
  });

  return Response.json({ success: true });
}

/**
 * GET /api/shortlists/[id]/share — Check if shortlist is currently shared
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { id } = await params;

  const shareLink = await prisma.shareLink.findFirst({
    where: { resourceType: 'shortlist', resourceId: id, userId: user.id, isActive: true },
  });

  return Response.json({
    isShared: !!shareLink,
    shareLink: shareLink || null,
    url: shareLink ? `/shared/${shareLink.token}` : null,
  });
}
