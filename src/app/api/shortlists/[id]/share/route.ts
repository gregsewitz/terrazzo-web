import { NextRequest } from 'next/server';
import { createOrGetShareLink, revokeShareLinks, getShareStatus } from '@/lib/share-helpers';
import { authHandler } from '@/lib/api-auth-handler';
import { verifyOwnership } from '@/lib/ownership';
import type { User } from '@prisma/client';

/** POST /api/shortlists/[id]/share — Generate a share link for a shortlist */
export const POST = authHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, user: User) => {
  const { id } = await params;

  // Verify ownership
  if (!(await verifyOwnership('shortlist', id, user.id))) {
    return Response.json({ error: 'Shortlist not found' }, { status: 404 });
  }

  return Response.json(await createOrGetShareLink(user.id, 'shortlist', id));
});

/** DELETE /api/shortlists/[id]/share — Revoke sharing for a shortlist */
export const DELETE = authHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, user: User) => {
  const { id } = await params;

  await revokeShareLinks(user.id, 'shortlist', id);
  return Response.json({ success: true });
});

/** GET /api/shortlists/[id]/share — Check if shortlist is currently shared */
export const GET = authHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, user: User) => {
  const { id } = await params;

  return Response.json(await getShareStatus(user.id, 'shortlist', id));
});
