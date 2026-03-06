/**
 * Structured Input Injector
 *
 * For the hybrid approach: structured modalities (image pairs, Elo experience
 * comparisons, designer selections, sliders, scales) produce deterministic
 * signals — no extraction ambiguity. We skip the API and compute signals
 * directly using the same functions the frontend uses.
 *
 * This is the cheap, fast half of the hybrid. Voice phases test extraction quality;
 * structured inputs just need the signal math to be correct.
 *
 * v3 additions: service-style sliders, sustainability-check scale
 */

import type { TasteArchetype } from '../archetypes';
import type { TasteSignal, TasteDomain } from '../../../src/types';
import {
  EXPERIENCE_POOL,
  DESIGNER_POOL,
  IMAGE_PAIRS,
  DIAGNOSTIC_QUESTIONS,
  ONBOARDING_PHASES,
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
    sliders: TasteSignal[];
    sustainabilityScale: TasteSignal[];
  };
}

// ─── Experience Elo (instinct-round) ─────────────────────────────────────────
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

// ─── Image Pairs (visual-taste) ─────────────────────────────────────────────
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

// ─── Designer Pool (visual-taste) ────────────────────────────────────────────
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

// ─── Diagnostic Questions (instinct-round) ──────────────────────────────────

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

// ─── Service Sliders (service-style phase) ──────────────────────────────────
// v3: Each slider is a continuous 0-100 position that interpolates between
// left signals and right signals. Position < 30 → left dominant, > 70 → right
// dominant, 30-70 → blend with lower confidence.

function extractSliderSignals(
  positions: Record<string, number>,
): TasteSignal[] {
  const signals: TasteSignal[] = [];

  // Find the service-style phase to get slider definitions
  const servicePhase = ONBOARDING_PHASES.find(p => p.id === 'service-style');
  if (!servicePhase?.sliderDefs) return signals;

  for (const [sliderId, position] of Object.entries(positions)) {
    const sliderDef = (servicePhase.sliderDefs as Array<{
      id: string;
      leftSignals: string[];
      rightSignals: string[];
      domain: string;
    }>).find(s => s.id === sliderId);

    if (!sliderDef) continue;

    const normalized = Math.max(0, Math.min(100, position)) / 100;
    const domain = (sliderDef.domain || 'Service') as TasteDomain;

    if (normalized < 0.3) {
      // Strong left preference
      const conf = 0.6 + (0.3 - normalized) * 1.0; // 0.6 to 0.9
      for (const tag of sliderDef.leftSignals) {
        signals.push({ tag, cat: domain, confidence: Math.min(conf, 0.9) });
      }
      // Weak right anti-preference
      for (const tag of sliderDef.rightSignals) {
        signals.push({ tag, cat: domain, confidence: 0.2 });
      }
    } else if (normalized > 0.7) {
      // Strong right preference
      const conf = 0.6 + (normalized - 0.7) * 1.0; // 0.6 to 0.9
      for (const tag of sliderDef.rightSignals) {
        signals.push({ tag, cat: domain, confidence: Math.min(conf, 0.9) });
      }
      // Weak left anti-preference
      for (const tag of sliderDef.leftSignals) {
        signals.push({ tag, cat: domain, confidence: 0.2 });
      }
    } else {
      // Moderate zone — both sides at medium confidence
      const leftConf = 0.3 + (0.5 - normalized) * 0.5;
      const rightConf = 0.3 + (normalized - 0.5) * 0.5;
      for (const tag of sliderDef.leftSignals) {
        signals.push({ tag, cat: domain, confidence: Math.max(0.25, leftConf) });
      }
      for (const tag of sliderDef.rightSignals) {
        signals.push({ tag, cat: domain, confidence: Math.max(0.25, rightConf) });
      }
    }
  }

  return signals;
}

// ─── Sustainability Scale (sustainability-check phase) ──────────────────────
// v3: Single 0-100 scale. Maps to sustainability sensitivity signals.

function extractSustainabilityScaleSignals(
  scaleValue: number,
): TasteSignal[] {
  const signals: TasteSignal[] = [];
  const normalized = Math.max(0, Math.min(100, scaleValue)) / 100;
  const domain = 'Sustainability' as TasteDomain;

  if (normalized >= 0.8) {
    // Passionate about sustainability
    signals.push({ tag: 'Sustainability-priority', cat: domain, confidence: 0.9 });
    signals.push({ tag: 'Eco-conscious-traveler', cat: domain, confidence: 0.85 });
    signals.push({ tag: 'Greenwashing-detector', cat: domain, confidence: 0.75 });
  } else if (normalized >= 0.55) {
    // Conscious but not dealbreaker
    signals.push({ tag: 'Sustainability-conscious', cat: domain, confidence: 0.7 });
    signals.push({ tag: 'Prefers-responsible', cat: domain, confidence: 0.6 });
  } else if (normalized >= 0.3) {
    // Nice-to-have
    signals.push({ tag: 'Sustainability-neutral', cat: domain, confidence: 0.5 });
  } else {
    // Not a factor
    signals.push({ tag: 'Sustainability-indifferent', cat: domain, confidence: 0.4 });
  }

  return signals;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Compute all signals from structured onboarding inputs.
 * No API calls — pure deterministic signal extraction.
 *
 * v3 update: Now handles service-style sliders and sustainability scale
 * in addition to the original experience Elo, image pairs, designers, and diagnostics.
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

  const sliders = inputs?.sliderPositions
    ? extractSliderSignals(inputs.sliderPositions)
    : [];

  const sustainabilityScale = typeof inputs?.sustainabilityScale === 'number'
    ? extractSustainabilityScaleSignals(inputs.sustainabilityScale)
    : [];

  return {
    signals: [
      ...experienceElo,
      ...imagePairs,
      ...designerSelections,
      ...diagnostics,
      ...sliders,
      ...sustainabilityScale,
    ],
    breakdown: {
      experienceElo,
      imagePairs,
      designerSelections,
      diagnostics,
      sliders,
      sustainabilityScale,
    },
  };
}
