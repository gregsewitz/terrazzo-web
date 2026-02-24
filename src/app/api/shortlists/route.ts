import { NextRequest } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { apiHandler } from '@/lib/api-handler';

export const POST = apiHandler(async (req: NextRequest) => {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const body = await req.json();
  const { name, description, emoji, isSmartCollection, query, filterTags, placeIds } = body;

  if (!name) {
    return Response.json({ error: 'Name required' }, { status: 400 });
  }

  const shortlist = await prisma.shortlist.create({
    data: {
      userId: user.id,
      name,
      description: description || null,
      emoji: emoji || 'sparkle',
      isSmartCollection: isSmartCollection || false,
      query: query || null,
      filterTags: filterTags || null,
      placeIds: placeIds || [],
    },
  });

  return Response.json({ shortlist });
});
