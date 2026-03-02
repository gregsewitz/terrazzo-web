/**
 * TG-07: Real Taste Neighbors API
 *
 * Returns computed taste neighbors for a user based on actual vector similarity,
 * replacing LLM-fabricated neighbor archetypes with real data.
 */

import { NextRequest } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { apiHandler } from '@/lib/api-handler';
import {
  findTasteNeighbors,
  findContradictionNeighbors,
} from '@/lib/taste-intelligence';

export const GET = apiHandler(async (req: NextRequest) => {
  const user = await getUser(req);
  if (!user) return unauthorized();

  // Get real taste neighbors from pgvector
  const vectorNeighbors = await findTasteNeighbors(user.id, 10);

  // Get contradiction-based neighbors (different signal — shared tensions)
  const contradictionNeighbors = await findContradictionNeighbors(user.id, 5);

  // Compute rarity: how distinctive is this user's taste?
  // If nearest neighbor similarity is low, they're more unique.
  const topSimilarity = vectorNeighbors[0]?.similarity ?? 0;
  const rarityPercentile = Math.round((1 - topSimilarity) * 100);

  return Response.json({
    vectorNeighbors: vectorNeighbors.map((n) => ({
      id: n.id,
      name: n.name,
      similarity: Math.round(n.similarity * 100), // 0-100 scale
    })),
    contradictionNeighbors: contradictionNeighbors.map((n) => ({
      userId: n.userId,
      sharedContradictions: n.sharedContradictions,
      similarity: Math.round(n.similarity * 100),
    })),
    stats: {
      neighborCount: vectorNeighbors.length,
      nearestSimilarity: Math.round(topSimilarity * 100),
      rarityPercentile,
      hasContradictionNeighbors: contradictionNeighbors.length > 0,
    },
  });
});
