import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authHandler } from '@/lib/api-auth-handler';
import { completeTasteFields } from '@/lib/taste-completion';
import { ensureEnrichment } from '@/lib/ensure-enrichment';
import type { User, SavedPlace } from '@prisma/client';

/**
 * POST /api/shared/[token]/save — Save shared places to your library
 * Requires auth (you need an account to save).
 */
export const POST = authHandler(async (req: NextRequest, { params }: { params: Promise<{ token: string }> }, user: User) => {

  const { token } = await params;
  const { placeIds, saveAll, createCollection } = await req.json() as {
    placeIds?: string[];
    saveAll?: boolean;
    createCollection?: boolean;
  };

  // Validate share link
  const shareLink = await prisma.shareLink.findUnique({
    where: { token },
  });

  if (!shareLink || !shareLink.isActive) {
    return Response.json({ error: 'Share link not found' }, { status: 404 });
  }

  if (shareLink.resourceType !== 'collection') {
    return Response.json({ error: 'Can only save from shared collections' }, { status: 400 });
  }

  // Get the collection
  const collection = await prisma.shortlist.findUnique({
    where: { id: shareLink.resourceId },
  });

  if (!collection) {
    return Response.json({ error: 'Collection no longer exists' }, { status: 404 });
  }

  // Determine which place IDs to save
  const allPlaceIds = (collection.placeIds as string[]) || [];
  const targetIds = saveAll ? allPlaceIds : (placeIds || []);

  if (targetIds.length === 0) {
    return Response.json({ error: 'No places to save' }, { status: 400 });
  }

  // Fetch source places, then restore curated order.
  // findMany with `id: { in: [...] }` does not preserve array order, so we
  // re-sort into the targetIds sequence so that newPlaces (and ultimately
  // newPlaceIds) reflect the original editorial ordering.
  const targetIdOrder = new Map(targetIds.map((id, i) => [id, i]));
  const rawSourcePlaces = await prisma.savedPlace.findMany({
    where: { id: { in: targetIds } },
  });
  const sourcePlaces = rawSourcePlaces.sort(
    (a: SavedPlace, b: SavedPlace) => (targetIdOrder.get(a.id) ?? 0) - (targetIdOrder.get(b.id) ?? 0),
  );

  // Create copies for the recipient, skipping duplicates (same googlePlaceId)
  const existingGoogleIds = new Set(
    (await prisma.savedPlace.findMany({
      where: {
        userId: user.id,
        googlePlaceId: { in: sourcePlaces.filter((p: any) => p.googlePlaceId).map((p: any) => p.googlePlaceId!) },
      },
      select: { googlePlaceId: true },
    })).map((p: any) => p.googlePlaceId)
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toJson = (v: unknown) => v === null || v === undefined ? undefined : v as any;

  const newPlaces = sourcePlaces
    .filter((p: any) => !p.googlePlaceId || !existingGoogleIds.has(p.googlePlaceId))
    .map((p: any) => ({
      userId: user.id,
      googlePlaceId: p.googlePlaceId,
      name: p.name,
      type: p.type,
      location: p.location || '',
      source: { type: 'shared', name: collection.name } as Record<string, string>,
      ghostSource: 'friend',
      matchScore: p.matchScore,
      matchBreakdown: toJson(p.matchBreakdown),
      tasteNote: p.tasteNote,
      enrichment: toJson(p.enrichment),
      whatToOrder: toJson(p.whatToOrder),
      tips: toJson(p.tips),
      googleData: toJson(p.googleData),
      terrazzoInsight: toJson(p.terrazzoInsight),
      alsoKnownAs: p.alsoKnownAs || undefined,
      placeIntelligenceId: p.placeIntelligenceId,
    }));

  let savedCount = 0;
  const newPlaceIds: string[] = [];

  if (newPlaces.length > 0) {
    // Create in a transaction
    const created = await prisma.$transaction(
      newPlaces.map((p: any) => prisma.savedPlace.create({ data: p }))
    ) as Array<{ id: string }>;
    savedCount = created.length;
    newPlaceIds.push(...created.map((p: { id: string }) => p.id));
  }

  // Ensure enrichment for any shared places with googlePlaceId (fire-and-forget)
  // The source may have had a PI record, but if it didn't, this creates one
  if (newPlaces.length > 0) {
    for (const p of newPlaces) {
      if (p.googlePlaceId) {
        ensureEnrichment(p.googlePlaceId, p.name, user.id, 'shared_save', p.type || undefined)
          .catch(err => console.error('[shared-save] enrichment error:', err));
      }
    }
  }

  // Re-personalize taste fields for the recipient (fire-and-forget)
  if (newPlaces.length > 0) {
    const createdPlaces = await prisma.savedPlace.findMany({
      where: { id: { in: newPlaceIds } },
      select: { id: true, name: true, type: true, location: true },
    });

    completeTasteFields(
      createdPlaces.map((p: any) => ({
        savedPlaceId: p.id,
        name: p.name,
        type: p.type,
        location: p.location || undefined,
      })),
      user.id,
    ).catch(err => console.error('[shared-save] taste completion error:', err));
  }

  // Optionally create a collection with these places.
  // newPlaceIds is already in curated order: sourcePlaces was sorted by
  // targetIds above, newPlaces is filtered from that, and prisma.$transaction
  // preserves array order — so newPlaceIds reflects the original sequence.
  let newCollection = null;
  if (createCollection && newPlaceIds.length > 0) {
    const ownerName = (await prisma.user.findUnique({
      where: { id: shareLink.userId },
      select: { name: true, email: true },
    }));
    const fromName = ownerName?.name || ownerName?.email?.split('@')[0] || 'a friend';

    newCollection = await prisma.shortlist.create({
      data: {
        userId: user.id,
        name: `${collection.name} (from ${fromName})`,
        description: collection.description,
        emoji: collection.emoji,
        placeIds: newPlaceIds,
      },
    });
  }

  return Response.json({
    savedCount,
    skippedCount: sourcePlaces.length - newPlaces.length,
    collection: newCollection,
  });
});
