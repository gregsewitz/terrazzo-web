/**
 * POST /api/onboarding/modality/swipe
 *
 * Swipe signal extraction: right (like) → confidence 0.8, left (pass) → confidence 0.2.
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import {
  extractSwipeSignals,
  persistSignals,
  type SwipeChoiceInput,
} from '@/lib/modality-signals';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip + ':modality:swipe', { maxRequests: 60, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  try {
    const body = (await req.json()) as SwipeChoiceInput;

    if (!body.phaseId || !body.userId || !body.item || !body.direction) {
      return NextResponse.json(
        { error: 'phaseId, userId, item, and direction are required' },
        { status: 400 },
      );
    }

    const signals = extractSwipeSignals(body);
    const result = await persistSignals(signals, body.userId, body.phaseId, 'SWIPE');
    return NextResponse.json(result);
  } catch (error) {
    console.error('[modality/swipe] Error:', error);
    return NextResponse.json({ error: 'Failed to process swipe choice' }, { status: 500 });
  }
}
