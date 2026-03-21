import { NextRequest } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { apiHandler } from '@/lib/api-handler';

/**
 * GET /api/signals/mine
 *
 * Returns the authenticated user's TasteNode signals in the same
 * { tag, cat, confidence } shape the client expects for Zustand hydration.
 *
 * This replaces reading User.allSignals — TasteNode is now the canonical store.
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const nodes = await prisma.tasteNode.findMany({
    where: { userId: user.id, isActive: true },
    select: {
      signal: true,
      domain: true,
      confidence: true,
      sourcePhaseId: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const signals = nodes.map((n: { signal: string; domain: string; confidence: number; sourcePhaseId: string | null }) => ({
    tag: n.signal,
    cat: n.domain,
    confidence: n.confidence,
    ...(n.sourcePhaseId && { sourcePhaseId: n.sourcePhaseId }),
  }));

  return Response.json({ signals, count: signals.length });
});
