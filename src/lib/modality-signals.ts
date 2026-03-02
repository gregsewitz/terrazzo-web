/**
 * Shared signal extraction logic for all onboarding modalities.
 *
 * Each modality maps user gestures to taste signals with appropriate confidence levels:
 * - CARD: binary A/B choice → winner signals at 0.7, loser implicit rejection at 0.3
 * - SLIDER: continuous 0-1 values per domain → direct mapping
 * - SWIPE: right(like)/left(pass) → signal at 0.8/0.2
 * - SPECTRUM: position on a bipolar axis → proportional confidence to both poles
 */

import { prisma } from '@/lib/prisma';
import type { SignalModality, TasteSignal, TasteDomain } from '@/types';
import { ALL_TASTE_DOMAINS } from '@/types';

// ─── Input Types ─────────────────────────────────────────────────────────────

export interface CardChoiceInput {
  phaseId: string;
  userId: string;
  chosen: { id: string; signals: string[]; domain: TasteDomain };
  rejected: { id: string; signals: string[]; domain: TasteDomain };
}

export interface SliderValuesInput {
  phaseId: string;
  userId: string;
  values: Partial<Record<TasteDomain, number>>;
}

export interface SwipeChoiceInput {
  phaseId: string;
  userId: string;
  item: { id: string; signals: string[]; domain: TasteDomain };
  direction: 'right' | 'left';
}

export interface SpectrumValuesInput {
  phaseId: string;
  userId: string;
  axes: {
    axisName: string;
    domain: TasteDomain;
    value: number;
    leftLabel: string;
    rightLabel: string;
  }[];
}

export interface ModalityResult {
  signals: TasteSignal[];
  sourceModality: SignalModality;
  phaseId: string;
  persisted: number;
}

// ─── Signal Extraction ───────────────────────────────────────────────────────

export function extractCardSignals(input: CardChoiceInput): TasteSignal[] {
  const signals: TasteSignal[] = [];
  for (const tag of input.chosen.signals) {
    signals.push({ tag, cat: input.chosen.domain, confidence: 0.7 });
  }
  for (const tag of input.rejected.signals) {
    signals.push({ tag, cat: input.rejected.domain, confidence: 0.3 });
  }
  return signals;
}

export function extractSliderSignals(input: SliderValuesInput): TasteSignal[] {
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

export function extractSwipeSignals(input: SwipeChoiceInput): TasteSignal[] {
  const confidence = input.direction === 'right' ? 0.8 : 0.2;
  return input.item.signals.map((tag) => ({
    tag,
    cat: input.item.domain,
    confidence,
  }));
}

export function extractSpectrumSignals(input: SpectrumValuesInput): TasteSignal[] {
  const signals: TasteSignal[] = [];
  for (const axis of input.axes) {
    const clampedValue = Math.max(0, Math.min(1, axis.value));
    if (clampedValue < 0.7) {
      signals.push({
        tag: axis.leftLabel.toLowerCase().replace(/\s+/g, '_'),
        cat: axis.domain,
        confidence: Math.round((1 - clampedValue) * 100) / 100,
      });
    }
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

// ─── Shared Persistence ──────────────────────────────────────────────────────

export async function persistSignals(
  signals: TasteSignal[],
  userId: string,
  phaseId: string,
  sourceModality: SignalModality,
): Promise<ModalityResult> {
  const now = new Date();
  const createData = signals.map((sig) => ({
    id: `tn_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    domain: sig.cat,
    signal: sig.tag,
    confidence: sig.confidence,
    source: 'onboarding',
    isActive: true,
    extractedAt: now,
    sourcePhaseId: phaseId,
    sourceModality,
    updatedAt: now,
  }));

  if (createData.length > 0) {
    await prisma.tasteNode.createMany({ data: createData });
  }

  return {
    signals,
    sourceModality,
    phaseId,
    persisted: createData.length,
  };
}
