/**
 * POST /api/onboarding/modality/card
 *
 * Card-choice signal extraction: binary A/B choice between two options.
 * Winner signals receive confidence 0.7, loser signals receive 0.3 (implicit rejection).
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import {
  extractCardSignals,
  persistSignals,
  type CardChoiceInput,
} from '@/lib/modality-signals';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip + ':modality:card', { maxRequests: 60, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  try {
    const body = (await req.json()) as CardChoiceInput;

    if (!body.phaseId || !body.userId || !body.chosen || !body.rejected) {
      return NextResponse.json(
        { error: 'phaseId, userId, chosen, and rejected are required' },
        { status: 400 },
      );
    }

    const signals = extractCardSignals(body);
    const result = await persistSignals(signals, body.userId, body.phaseId, 'CARD');
    return NextResponse.json(result);
  } catch (error) {
    console.error('[modality/card] Error:', error);
    return NextResponse.json({ error: 'Failed to process card choice' }, { status: 500 });
  }
}
