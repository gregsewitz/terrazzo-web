/**
 * POST /api/onboarding/modality
 *
 * Unified modality-specific signal processing for non-voice onboarding interactions.
 * Accepts { modality: 'CARD' | 'SLIDER' | 'SWIPE' | 'SPECTRUM', ... } and routes
 * to the appropriate extraction logic.
 *
 * For per-modality endpoints, see:
 *   POST /api/onboarding/modality/card
 *   POST /api/onboarding/modality/slider
 *   POST /api/onboarding/modality/swipe
 *   POST /api/onboarding/modality/spectrum
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import type { TasteDomain } from '@/types';
import {
  extractCardSignals,
  extractSliderSignals,
  extractSwipeSignals,
  extractSpectrumSignals,
  persistSignals,
  type CardChoiceInput,
  type SliderValuesInput,
  type SwipeChoiceInput,
  type SpectrumValuesInput,
} from '@/lib/modality-signals';

type ModalityInput =
  | (CardChoiceInput & { modality: 'CARD' })
  | (SliderValuesInput & { modality: 'SLIDER' })
  | (SwipeChoiceInput & { modality: 'SWIPE' })
  | (SpectrumValuesInput & { modality: 'SPECTRUM' });

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip + ':modality', { maxRequests: 60, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  try {
    const body = (await req.json()) as ModalityInput;

    if (!body.modality || !body.phaseId || !body.userId) {
      return NextResponse.json(
        { error: 'modality, phaseId, and userId are required' },
        { status: 400 },
      );
    }

    let signals;
    switch (body.modality) {
      case 'CARD':
        signals = extractCardSignals(body);
        break;
      case 'SLIDER':
        signals = extractSliderSignals(body);
        break;
      case 'SWIPE':
        signals = extractSwipeSignals(body);
        break;
      case 'SPECTRUM':
        signals = extractSpectrumSignals(body);
        break;
      default:
        return NextResponse.json({ error: `Unknown modality: ${(body as { modality: string }).modality}` }, { status: 400 });
    }

    const result = await persistSignals(signals, body.userId, body.phaseId, body.modality);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[modality] Error processing modality input:', error);
    return NextResponse.json(
      { error: 'Failed to process modality input' },
      { status: 500 },
    );
  }
}
