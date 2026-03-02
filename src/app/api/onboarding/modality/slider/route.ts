/**
 * POST /api/onboarding/modality/slider
 *
 * Slider signal extraction: continuous 0–1 values per domain.
 * Directly maps slider position to signal confidence.
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import {
  extractSliderSignals,
  persistSignals,
  type SliderValuesInput,
} from '@/lib/modality-signals';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip + ':modality:slider', { maxRequests: 60, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  try {
    const body = (await req.json()) as SliderValuesInput;

    if (!body.phaseId || !body.userId || !body.values) {
      return NextResponse.json(
        { error: 'phaseId, userId, and values are required' },
        { status: 400 },
      );
    }

    const signals = extractSliderSignals(body);
    const result = await persistSignals(signals, body.userId, body.phaseId, 'SLIDER');
    return NextResponse.json(result);
  } catch (error) {
    console.error('[modality/slider] Error:', error);
    return NextResponse.json({ error: 'Failed to process slider values' }, { status: 500 });
  }
}
