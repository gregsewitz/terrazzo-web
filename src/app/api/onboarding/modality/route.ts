/**
 * POST /api/onboarding/modality
 *
 * Modality-specific signal processing for non-voice onboarding interactions.
 * Processes card-choice, slider-values, swipe-choice, and spectrum-values
 * locally without AI calls — signals are deterministic from user input.
 *
 * Each modality maps user gestures to taste signals with appropriate confidence levels:
 * - CARD: binary A/B choice → winner signals at 0.7, loser implicit rejection at 0.3
 * - SLIDER: continuous 0-1 values per domain → direct mapping
 * - SWIPE: right(like)/left(pass) → signal at 0.8/0.2
 * - SPECTRUM: position on a bipolar axis → proportional confidence to both poles
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { prisma } from '@/lib/prisma';
import type { SignalModality, TasteSignal, TasteDomain } from '@/types';
import { ALL_TASTE_DOMAINS } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CardChoiceInput {
  modality: 'CARD';
  phaseId: string;
  userId: string;
  /** The card the user chose (winner) */
  chosen: { id: string; signals: string[]; domain: TasteDomain };
  /** The card the user rejected */
  rejected: { id: string; signals: string[]; domain: TasteDomain };
}

interface SliderValuesInput {
  modality: 'SLIDER';
  phaseId: string;
  userId: string;
  /** Map of domain → slider value (0.0–1.0) */
  values: Partial<Record<TasteDomain, number>>;
}

interface SwipeChoiceInput {
  modality: 'SWIPE';
  phaseId: string;
  userId: string;
  /** The item swiped on */
  item: { id: string; signals: string[]; domain: TasteDomain };
  /** Direction: right = like, left = pass */
  direction: 'right' | 'left';
}

interface SpectrumValuesInput {
  modality: 'SPECTRUM';
  phaseId: string;
  userId: string;
  /** Array of spectrum axis positions */
  axes: {
    axisName: string;
    domain: TasteDomain;
    value: number; // 0.0 = left pole, 1.0 = right pole
    leftLabel: string;
    rightLabel: string;
  }[];
}

type ModalityInput = CardChoiceInput | SliderValuesInput | SwipeChoiceInput | SpectrumValuesInput;

interface ModalityResult {
  signals: TasteSignal[];
  sourceModality: SignalModality;
  phaseId: string;
  /** Signals persisted to TasteNode (count) */
  persisted: number;
}

// ─── Signal Extraction per Modality ─────────────────────────────────────────

function extractCardSignals(input: CardChoiceInput): TasteSignal[] {
  const signals: TasteSignal[] = [];

  // Winner signals — higher confidence for chosen card
  for (const tag of input.chosen.signals) {
    signals.push({ tag, cat: input.chosen.domain, confidence: 0.7 });
  }

  // Loser signals — lower confidence as implicit rejection
  for (const tag of input.rejected.signals) {
    signals.push({ tag, cat: input.rejected.domain, confidence: 0.3 });
  }

  return signals;
}

function extractSliderSignals(input: SliderValuesInput): TasteSignal[] {
  const signals: TasteSignal[] = [];

  for (const [domain, value] of Object.entries(input.values)) {
    if (typeof value !== 'number' || !ALL_TASTE_DOMAINS.includes(domain as TasteDomain)) continue;
    const clampedValue = Math.max(0, Math.min(1, value));
    signals.push({
      tag: `${domain.toLowerCase()}_preference`,
      cat: domain,
      confidence: clampedValue,
    });
  }

  return signals;
}

function extractSwipeSignals(input: SwipeChoiceInput): TasteSignal[] {
  const confidence = input.direction === 'right' ? 0.8 : 0.2;
  return input.item.signals.map((tag) => ({
    tag,
    cat: input.item.domain,
    confidence,
  }));
}

function extractSpectrumSignals(input: SpectrumValuesInput): TasteSignal[] {
  const signals: TasteSignal[] = [];

  for (const axis of input.axes) {
    const clampedValue = Math.max(0, Math.min(1, axis.value));

    // Left pole signal — stronger when value is closer to 0
    if (clampedValue < 0.7) {
      signals.push({
        tag: axis.leftLabel.toLowerCase().replace(/\s+/g, '_'),
        cat: axis.domain,
        confidence: Math.round((1 - clampedValue) * 100) / 100,
      });
    }

    // Right pole signal — stronger when value is closer to 1
    if (clampedValue > 0.3) {
      signals.push({
        tag: axis.rightLabel.toLowerCase().replace(/\s+/g, '_'),
        cat: axis.domain,
        confidence: Math.round(clampedValue * 100) / 100,
      });
    }
  }

  return signals;
}

// ─── Route Handler ──────────────────────────────────────────────────────────

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

    // Extract signals based on modality type
    let signals: TasteSignal[];
    let sourceModality: SignalModality;

    switch (body.modality) {
      case 'CARD':
        signals = extractCardSignals(body);
        sourceModality = 'CARD';
        break;
      case 'SLIDER':
        signals = extractSliderSignals(body);
        sourceModality = 'SLIDER';
        break;
      case 'SWIPE':
        signals = extractSwipeSignals(body);
        sourceModality = 'SWIPE';
        break;
      case 'SPECTRUM':
        signals = extractSpectrumSignals(body);
        sourceModality = 'SPECTRUM';
        break;
      default:
        return NextResponse.json({ error: `Unknown modality: ${(body as { modality: string }).modality}` }, { status: 400 });
    }

    // Persist signals to TasteNode with modality metadata
    const now = new Date();
    const createData = signals.map((sig) => ({
      id: `tn_${body.userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId: body.userId,
      domain: sig.cat,
      signal: sig.tag,
      confidence: sig.confidence,
      source: 'onboarding',
      isActive: true,
      extractedAt: now,
      sourcePhaseId: body.phaseId,
      sourceModality: sourceModality,
      updatedAt: now,
    }));

    if (createData.length > 0) {
      await prisma.tasteNode.createMany({ data: createData });
    }

    const result: ModalityResult = {
      signals,
      sourceModality,
      phaseId: body.phaseId,
      persisted: createData.length,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[modality] Error processing modality input:', error);
    return NextResponse.json(
      { error: 'Failed to process modality input' },
      { status: 500 },
    );
  }
}
