import { prisma } from '@/lib/prisma';
import type { SavedPlace, Collection, Trip } from '@prisma/client';

/**
 * Verify ownership of a resource and return it if owned by the user.
 * Returns null if the resource doesn't exist or is not owned by the user.
 */
export async function verifyOwnership(
  model: 'trip' | 'collection' | 'savedPlace',
  id: string,
  userId: string
): Promise<SavedPlace | Collection | Trip | null> {
  if (model === 'savedPlace') {
    return await prisma.savedPlace.findFirst({
      where: { id, userId, deletedAt: null },
    });
  } else if (model === 'trip') {
    return await prisma.trip.findFirst({
      where: { id, userId },
    });
  } else if (model === 'collection') {
    return await prisma.shortlist.findFirst({
      where: { id, userId },
    });
  }
  return null;
}
