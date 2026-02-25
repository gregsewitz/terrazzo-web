import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authHandler } from '@/lib/api-auth-handler';
import { validateBody, placeSchema } from '@/lib/api-validation';
import type { User } from '@prisma/client';

export const POST = authHandler(async (req: NextRequest, _ctx, user: User) => {
  const body = await req.json();
  // Accept flat body or nested { place: {...} }
  const placeData = body.place || body;

  const result = await validateBody(placeData, placeSchema);
  if ('error' in result) return result.error;

  const place = result.data;

  // Helper to convert undefined to null for Prisma
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toNull = (v: any) => v === undefined ? null : v;

  const commonData = {
    name: place.name,
    type: place.type,
    location: toNull(place.location),
    source: toNull(place.source),
    ghostSource: toNull(place.ghostSource),
    friendAttribution: toNull(place.friendAttribution),
    userContext: toNull(place.userContext),
    timing: toNull(place.timing),
    travelWith: toNull(place.travelWith),
    intentStatus: toNull(place.intentStatus),
    savedDate: toNull(place.savedDate),
    importBatchId: toNull(place.importBatchId),
    rating: toNull(place.rating),
    isShortlisted: place.isShortlisted || false,
    matchScore: toNull(place.matchScore),
    matchBreakdown: toNull(place.matchBreakdown),
    tasteNote: toNull(place.tasteNote),
    terrazzoInsight: toNull(place.terrazzoInsight),
    enrichment: toNull(place.enrichment),
    whatToOrder: toNull(place.whatToOrder),
    tips: toNull(place.tips),
    alsoKnownAs: toNull(place.alsoKnownAs),
    googleData: toNull(place.googleData),
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
});
