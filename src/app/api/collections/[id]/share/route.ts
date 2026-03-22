import { NextRequest } from 'next/server';
import { createOrGetShareLink, revokeShareLinks, getShareStatus } from '@/lib/share-helpers';
import { authHandler } from '@/lib/api-auth-handler';
import { verifyOwnership } from '@/lib/ownership';
import type { User } from '@prisma/client';

/** POST /api/collections/[id]/share — Generate a share link for a collection */
export const POST = authHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, user: User) => {
  const { id } = await params;

  // Verify ownership
  if (!(await verifyOwnership('collection', id, user.id))) {
    return Response.json({ error: 'Collection not found' }, { status: 404 });
  }

  return Response.json(await createOrGetShareLink(user.id, 'collection', id));
});

/** DELETE /api/collections/[id]/share — Revoke sharing for a collection */
export const DELETE = authHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, user: User) => {
  const { id } = await params;

  await revokeShareLinks(user.id, 'collection', id);
  return Response.json({ success: true });
});

/** GET /api/collections/[id]/share — Check if collection is currently shared */
export const GET = authHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, user: User) => {
  const { id } = await params;

  return Response.json(await getShareStatus(user.id, 'collection', id));
});
