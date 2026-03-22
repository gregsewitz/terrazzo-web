import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authHandler } from '@/lib/api-auth-handler';
import { validateBody, collectionCreateSchema } from '@/lib/api-validation';
import type { User } from '@prisma/client';

export const GET = authHandler(async (req: NextRequest, _ctx, user: User) => {
  const collections = await prisma.shortlist.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  return Response.json({ collections }, {
    headers: { 'Cache-Control': 'private, max-age=30' }
  });
});

export const POST = authHandler(async (req: NextRequest, _ctx, user: User) => {
  const result = await validateBody(req, collectionCreateSchema);
  if ('error' in result) return result.error;

  const { data } = result;
  const { name, description, emoji, isSmartCollection, query, filterTags, placeIds } = data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toNull = (v: any) => v === undefined ? null : v;

  const collection = await prisma.shortlist.create({
    data: {
      userId: user.id,
      name,
      description: toNull(description),
      emoji: emoji || 'sparkle',
      isSmartCollection: isSmartCollection || false,
      query: toNull(query),
      filterTags: toNull(filterTags),
      placeIds: placeIds || [],
    },
  });

  return Response.json({ collection });
});
