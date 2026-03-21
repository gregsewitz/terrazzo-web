/**
 * @deprecated Not called by any frontend component. See /api/onboarding/modality/route.ts.
 *
 * POST /api/onboarding/modality/spectrum
 *
 * Spectrum signal extraction: bipolar axis positions.
 * Position 0.0 = left pole (confidence = 1 - position)
 * Position 1.0 = right pole (confidence = position)
 * Fires both poles simultaneously when position is mid-range (0.3–0.7).
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import {
  extractSpectrumSignals,
  persistSignals,
  type SpectrumValuesInput,
} from '@/lib/modality-signals';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip + ':modality:spectrum', { maxRequests: 60, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  try {
    const body = (await req.json()) as SpectrumValuesInput;

    if (!body.phaseId || !body.userId || !body.axes || !Array.isArray(body.axes)) {
      return NextResponse.json(
        { error: 'phaseId, userId, and axes array are required' },
        { status: 400 },
      );
    }

    const signals = extractSpectrumSignals(body);
    const result = await persistSignals(signals, body.userId, body.phaseId, 'SPECTRUM');
    return NextResponse.json(result);
  } catch (error) {
    console.error('[modality/spectrum] Error:', error);
    return NextResponse.json({ error: 'Failed to process spectrum values' }, { status: 500 });
  }
}
