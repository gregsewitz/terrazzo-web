/**
 * POST /api/intelligence/taste-backfill
 *
 * Runs the Taste Intelligence vector backfill pipeline:
 * - Phase 1: Extract signals → TasteNode, compute user taste vectors
 * - Phase 2: Compute property embeddings from PlaceIntelligence signals
 *
 * Modes:
 *   { mode: "full" }                     — run both phases (default)
 *   { mode: "user", userId: "..." }      — backfill a single user
 *   { mode: "properties" }               — backfill property embeddings only
 *
 * Protected by CRON_SECRET bearer token when set.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  runFullBackfill,
  backfillUser,
  backfillAllPropertyEmbeddings,
} from '@/lib/taste-intelligence';

export async function POST(req: NextRequest) {
  // Simple auth check — skip if CRON_SECRET isn't configured
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { mode = 'full', userId } = body as {
      mode?: string;
      userId?: string;
    };

    if (mode === 'user' && userId) {
      const result = await backfillUser(userId);
      return NextResponse.json({ ok: true, mode: 'user', result });
    }

    if (mode === 'properties') {
      const result = await backfillAllPropertyEmbeddings();
      return NextResponse.json({ ok: true, mode: 'properties', result });
    }

    // Default: full backfill (Phase 1 + Phase 2)
    const result = await runFullBackfill();
    return NextResponse.json({
      ok: true,
      mode: 'full',
      users: {
        processed: result.userResults.length,
        nodesCreated: result.userResults.reduce(
          (sum, r) => sum + r.nodesCreated,
          0,
        ),
        contradictionsCreated: result.userResults.reduce(
          (sum, r) => sum + r.contradictionsCreated,
          0,
        ),
        vectorsComputed: result.userResults.filter((r) => r.vectorComputed)
          .length,
      },
      properties: result.propResults,
    });
  } catch (err) {
    console.error('[taste-backfill] Error:', err);
    return NextResponse.json(
      { error: 'Taste backfill failed', details: String(err) },
      { status: 500 },
    );
  }
}
