import { NextRequest } from 'next/server';
import { createOrGetShareLink, revokeShareLinks, getShareStatus } from '@/lib/share-helpers';
import { authHandler } from '@/lib/api-auth-handler';
import { verifyOwnership } from '@/lib/ownership';
import type { User } from '@prisma/client';

/** POST /api/trips/[id]/share — Generate a share link for a trip */
export const POST = authHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, user: User) => {
  const { id } = await params;

  // Verify ownership
  if (!(await verifyOwnership('trip', id, user.id))) {
    return Response.json({ error: 'Trip not found' }, { status: 404 });
  }

  return Response.json(await createOrGetShareLink(user.id, 'trip', id));
});

/** DELETE /api/trips/[id]/share — Revoke sharing */
export const DELETE = authHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, user: User) => {
  const { id } = await params;

  await revokeShareLinks(user.id, 'trip', id);
  return Response.json({ success: true });
});

/** GET /api/trips/[id]/share — Check share status */
export const GET = authHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, user: User) => {
  const { id } = await params;

  return Response.json(await getShareStatus(user.id, 'trip', id));
});
