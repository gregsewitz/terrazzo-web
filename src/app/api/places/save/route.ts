import { NextRequest } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const body = await req.json();
  // Accept flat body or nested { place: {...} }
  const place = body.place || body;

  if (!place?.name || !place?.type) {
    return Response.json({ error: 'Place name and type required' }, { status: 400 });
  }

  const commonData = {
    name: place.name,
    type: place.type,
    location: place.location || null,
    source: place.source || null,
    ghostSource: place.ghostSource || null,
    friendAttribution: place.friendAttribution || null,
    userContext: place.userContext || null,
    timing: place.timing || null,
    travelWith: place.travelWith || null,
    intentStatus: place.intentStatus || null,
    savedDate: place.savedDate || null,
    importBatchId: place.importBatchId || null,
    rating: place.rating || null,
    isShortlisted: place.isShortlisted || false,
    matchScore: place.matchScore || null,
    matchBreakdown: place.matchBreakdown || null,
    tasteNote: place.tasteNote || null,
    terrazzoInsight: place.terrazzoInsight || null,
    enrichment: place.enrichment || null,
    whatToOrder: place.whatToOrder || null,
    tips: place.tips || null,
    alsoKnownAs: place.alsoKnownAs || null,
    googleData: place.googleData || null,
  };

  // Upsert: if same googlePlaceId exists for this user, update; otherwise create
  const savedPlace = place.googlePlaceId
    ? await prisma.savedPlace.upsert({
        where: {
          userId_googlePlaceId: { userId: user.id, googlePlaceId: place.googlePlaceId },
        },
        create: {
          userId: user.id,
          googlePlaceId: place.googlePlaceId,
          ...commonData,
        },
        update: commonData,
      })
    : await prisma.savedPlace.create({
        data: {
          userId: user.id,
          ...commonData,
        },
      });

  return Response.json({ place: savedPlace });
}
