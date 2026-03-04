/**
 * Structured Input Injector
 *
 * For the hybrid approach: structured modalities (image pairs, Elo experience
 * comparisons, designer selections) produce deterministic signals — no extraction
 * ambiguity. We skip the API and compute signals directly using the same functions
 * the frontend uses.
 *
 * This is the cheap, fast half of the hybrid. Voice phases test extraction quality;
 * structured inputs just need the signal math to be correct.
 */

import type { TasteArchetype } from '../archetypes';
import type { TasteSignal, TasteDomain } from '../../../src/types';
import {
  EXPERIENCE_POOL,
  DESIGNER_POOL,
  IMAGE_PAIRS,
  DIAGNOSTIC_QUESTIONS,
} from '../../../src/constants/onboarding';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StructuredInputResult {
  /** All signals produced by structured modalities */
  signals: TasteSignal[];
  /** Breakdown by source for debugging */
  breakdown: {
    experienceElo: TasteSignal[];
    imagePairs: TasteSignal[];
    designerSelections: TasteSignal[];
    diagnostics: TasteSignal[];
  };
}

// ─── Experience Elo (Phase 8) ─────────────────────────────────────────────────
// Each experience preference is a binary A/B choice within a dimension.
// The archetype provides choices as { "morning-ritual": "a", "pool-energy": "b", ... }

function extractExperienceSignals(
  preferences: Record<string, 'a' | 'b'>,
): TasteSignal[] {
  const signals: TasteSignal[] = [];

  for (const [dimension, choice] of Object.entries(preferences)) {
    // Find the matching experience items for this dimension
    const dimensionLabel = dimensionKeyToLabel(dimension);
    const items = EXPERIENCE_POOL.filter(e => e.dimension === dimensionLabel);

    if (items.length < 2) continue;

    // Items are paired: first is "a", its pairWith is "b"
    const itemA = items.find(e => e.pairWith && items.find(p => p.id === e.pairWith));
    const itemB = itemA ? items.find(e => e.id === itemA.pairWith) : undefined;

    if (!itemA || !itemB) continue;

    const chosen = choice === 'a' ? itemA : itemB;
    const rejected = choice === 'a' ? itemB : itemA;

    // Winner signals at 0.7 confidence, loser at 0.3
    for (const sig of chosen.signals) {
      signals.push({
        tag: sig,
        cat: (chosen.category || 'Design') as TasteDomain,
        confidence: 0.7,
      });
    }
    for (const sig of rejected.signals) {
      signals.push({
        tag: sig,
        cat: (rejected.category || 'Design') as TasteDomain,
        confidence: 0.3,
      });
    }
  }

  return signals;
}

/** Map archetype dimension keys to EXPERIENCE_POOL dimension labels */
function dimensionKeyToLabel(key: string): string {
  const map: Record<string, string> = {
    'morning-ritual': 'Morning Ritual',
    'pool-energy': 'Pool Energy',
    'day-pace': 'Day Pace',
    'what-matters-more': 'What Matters More',
    'landscape-pull': 'Landscape Pull',
    'location-feel': 'Location Feel',
    'after-dark': 'After Dark',
    'scale-intimacy': 'Scale & Intimacy',
  };
  return map[key] || key;
}

// ─── Image Pairs (Phase 9) ───────────────────────────────────────────────────
// Binary A/B visual choice. Same card signal logic: winner at 0.7, loser at 0.3.

function extractImagePairSignals(
  choices: Record<string, 'a' | 'b'>,
): TasteSignal[] {
  const signals: TasteSignal[] = [];

  for (const [pairIdStr, choice] of Object.entries(choices)) {
    const pairId = parseInt(pairIdStr, 10);
    const pair = IMAGE_PAIRS.find(p => p.id === pairId);
    if (!pair) continue;

    const winnerSignals = choice === 'a' ? pair.aSignals : pair.bSignals;
    const loserSignals = choice === 'a' ? pair.bSignals : pair.aSignals;

    for (const tag of winnerSignals) {
      signals.push({ tag, cat: 'Design' as TasteDomain, confidence: 0.7 });
    }
    for (const tag of loserSignals) {
      signals.push({ tag, cat: 'Design' as TasteDomain, confidence: 0.3 });
    }
  }

  return signals;
}

// ─── Designer Pool (Phase 9) ────────────────────────────────────────────────
// Elo-ranked selection. Selected designers get full confidence (0.8),
// their cluster signals propagate.

function extractDesignerSignals(
  selections: string[],
): TasteSignal[] {
  const signals: TasteSignal[] = [];

  for (const designerId of selections) {
    const designer = DESIGNER_POOL.find(d => d.id === designerId);
    if (!designer) continue;

    // Each selected designer contributes their signals at 0.8 confidence
    for (const tag of designer.signals) {
      signals.push({ tag, cat: 'Design' as TasteDomain, confidence: 0.8 });
    }

    // Cluster membership is also a signal
    signals.push({
      tag: `cluster-${designer.cluster}`,
      cat: 'Design' as TasteDomain,
      confidence: 0.7,
    });
  }

  // Non-selected designers from the pool implicitly have lower scores,
  // but we don't generate anti-signals for them since they weren't actively rejected

  return signals;
}

// ─── Diagnostic Questions (Legacy Phase 8) ──────────────────────────────────

function extractDiagnosticSignals(
  choices: Record<string, 'a' | 'b'>,
): TasteSignal[] {
  const signals: TasteSignal[] = [];

  for (const [qIdStr, choice] of Object.entries(choices)) {
    const qIdx = parseInt(qIdStr, 10) - 1; // 1-indexed in archetype → 0-indexed
    const question = DIAGNOSTIC_QUESTIONS[qIdx];
    if (!question) continue;

    const winnerSignals = choice === 'a' ? question.aSignals : question.bSignals;
    const loserSignals = choice === 'a' ? question.bSignals : question.aSignals;

    for (const tag of winnerSignals) {
      signals.push({ tag, cat: 'Design' as TasteDomain, confidence: 0.7 });
    }
    for (const tag of loserSignals) {
      signals.push({ tag, cat: 'Design' as TasteDomain, confidence: 0.3 });
    }
  }

  return signals;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Compute all signals from structured onboarding inputs.
 * No API calls — pure deterministic signal extraction.
 */
export function computeStructuredSignals(archetype: TasteArchetype): StructuredInputResult {
  const inputs = archetype.onboardingInputs;

  const experienceElo = inputs?.experiencePreferences
    ? extractExperienceSignals(inputs.experiencePreferences)
    : [];

  const imagePairs = inputs?.imagePairChoices
    ? extractImagePairSignals(inputs.imagePairChoices)
    : [];

  const designerSelections = inputs?.designerSelections
    ? extractDesignerSignals(inputs.designerSelections)
    : [];

  const diagnostics = inputs?.diagnosticChoices
    ? extractDiagnosticSignals(inputs.diagnosticChoices)
    : [];

  return {
    signals: [...experienceElo, ...imagePairs, ...designerSelections, ...diagnostics],
    breakdown: {
      experienceElo,
      imagePairs,
      designerSelections,
      diagnostics,
    },
  };
}
