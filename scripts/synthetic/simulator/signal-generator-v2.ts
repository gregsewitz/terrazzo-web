/**
 * Signal Generator v2 — Vector-Only Pipeline
 *
 * Each A/B choice emits ONLY the chosen side as positive.
 * The rejected side emits rejection signals (cat='Rejection', original tag text).
 * This creates genuinely different signal sets between archetypes.
 *
 * No API calls — pure deterministic signal computation.
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

export interface SignalGenerationResult {
  signals: TasteSignal[];
  breakdown: {
    experienceElo: TasteSignal[];
    imagePairs: TasteSignal[];
    designerSelections: TasteSignal[];
    diagnostics: TasteSignal[];
    sliders: TasteSignal[];
    sustainabilityScale: TasteSignal[];
  };
  stats: {
    total: number;
    positive: number;
    rejection: number;
    uniqueTags: number;
    domainDistribution: Record<string, number>;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function positive(tag: string, cat: string, confidence: number): TasteSignal {
  return { tag, cat: cat as TasteDomain, confidence };
}

function rejection(tag: string, confidence: number): TasteSignal {
  return { tag, cat: 'Rejection' as TasteDomain, confidence };
}

function computeStats(signals: TasteSignal[]) {
  const positive = signals.filter(s => s.cat !== 'Rejection').length;
  const rejectionCount = signals.length - positive;
  const tags = new Set(signals.map(s => s.tag));
  const domainDistribution: Record<string, number> = {};
  for (const s of signals) {
    domainDistribution[s.cat] = (domainDistribution[s.cat] || 0) + 1;
  }
  return {
    total: signals.length,
    positive,
    rejection: rejectionCount,
    uniqueTags: tags.size,
    domainDistribution,
  };
}

// ─── Experience Elo (8 dimensions, binary A/B) ───────────────────────────────

const DIMENSION_KEY_TO_LABEL: Record<string, string> = {
  'morning-ritual': 'Morning Ritual',
  'pool-energy': 'Pool Energy',
  'day-pace': 'Day Pace',
  'what-matters-more': 'What Matters More',
  'landscape-pull': 'Landscape Pull',
  'location-feel': 'Location Feel',
  'after-dark': 'After Dark',
  'scale-intimacy': 'Scale & Intimacy',
};

function generateExperienceSignals(
  preferences: Record<string, 'a' | 'b'>,
): TasteSignal[] {
  const signals: TasteSignal[] = [];

  for (const [dimKey, choice] of Object.entries(preferences)) {
    const dimLabel = DIMENSION_KEY_TO_LABEL[dimKey] || dimKey;
    const items = EXPERIENCE_POOL.filter(e => e.dimension === dimLabel);
    if (items.length < 2) continue;

    // Find paired items: "a" is the item with pairWith, "b" is its partner
    const itemA = items.find(e => e.pairWith && items.some(p => p.id === e.pairWith));
    const itemB = itemA ? items.find(e => e.id === itemA.pairWith) : undefined;
    if (!itemA || !itemB) continue;

    const chosen = choice === 'a' ? itemA : itemB;
    const rejected_ = choice === 'a' ? itemB : itemA;

    // Chosen side → positive signals
    for (const tag of chosen.signals) {
      signals.push(positive(tag, chosen.category || 'Design', 0.70));
    }
    // Rejected side → rejection signals (original tag text, NOT Anti- prefix)
    for (const tag of rejected_.signals) {
      signals.push(rejection(tag, 0.70));
    }
  }

  return signals;
}

// ─── Image Pairs (8 pairs, binary A/B visual choice) ─────────────────────────

function generateImagePairSignals(
  choices: Record<string, 'a' | 'b'>,
): TasteSignal[] {
  const signals: TasteSignal[] = [];

  for (const [pairIdStr, choice] of Object.entries(choices)) {
    const pairId = parseInt(pairIdStr, 10);
    const pair = IMAGE_PAIRS.find(p => p.id === pairId);
    if (!pair) continue;

    const domain = pair.domain || 'Design';
    const winnerSigs = choice === 'a' ? pair.aSignals : pair.bSignals;
    const loserSigs = choice === 'a' ? pair.bSignals : pair.aSignals;

    for (const tag of winnerSigs) {
      signals.push(positive(tag, domain, 0.70));
    }
    for (const tag of loserSigs) {
      signals.push(rejection(tag, 0.70));
    }
  }

  return signals;
}

// ─── Designer Selections (unary positive, no rejection) ──────────────────────

function generateDesignerSignals(
  selections: string[],
): TasteSignal[] {
  const signals: TasteSignal[] = [];

  for (const designerId of selections) {
    const designer = DESIGNER_POOL.find(d => d.id === designerId);
    if (!designer) continue;

    for (const tag of designer.signals) {
      signals.push(positive(tag, 'Design', 0.75));
    }
    // Cluster membership signal
    signals.push(positive(`cluster-${designer.cluster}`, 'Design', 0.65));
  }

  return signals;
}

// ─── Diagnostic Questions (7 questions, binary A/B) ──────────────────────────

function generateDiagnosticSignals(
  choices: Record<string, 'a' | 'b'>,
): TasteSignal[] {
  const signals: TasteSignal[] = [];

  for (const [qIdStr, choice] of Object.entries(choices)) {
    const qIdx = parseInt(qIdStr, 10) - 1; // 1-indexed → 0-indexed
    const question = DIAGNOSTIC_QUESTIONS[qIdx];
    if (!question) continue;

    const winnerSigs = choice === 'a' ? question.aSignals : question.bSignals;
    const loserSigs = choice === 'a' ? question.bSignals : question.aSignals;
    const winnerDomain = choice === 'a'
      ? (question.aDomain || 'Design')
      : (question.bDomain || question.aDomain || 'Design');

    for (const tag of winnerSigs) {
      signals.push(positive(tag, winnerDomain, 0.65));
    }
    for (const tag of loserSigs) {
      signals.push(rejection(tag, 0.65));
    }
  }

  return signals;
}

// ─── Service Sliders (4 sliders, 0-100 continuous) ───────────────────────────

interface SliderDef {
  id: string;
  leftSignals: string[];
  rightSignals: string[];
  domain: string;
}

function generateSliderSignals(
  positions: Record<string, number>,
): TasteSignal[] {
  const signals: TasteSignal[] = [];

  const servicePhase = ONBOARDING_PHASES.find(p => p.id === 'service-style');
  if (!servicePhase?.sliderDefs) return signals;
  const defs = servicePhase.sliderDefs as SliderDef[];

  for (const [sliderId, rawPosition] of Object.entries(positions)) {
    const def = defs.find(s => s.id === sliderId);
    if (!def) continue;

    const pos = Math.max(0, Math.min(100, rawPosition)) / 100; // 0-1
    const domain = def.domain || 'Service';

    if (pos < 0.30) {
      // Strong left preference
      const conf = 0.60 + (0.30 - pos); // 0.60 to 0.90
      for (const tag of def.leftSignals) {
        signals.push(positive(tag, domain, Math.min(conf, 0.85)));
      }
      for (const tag of def.rightSignals) {
        signals.push(rejection(tag, 0.60));
      }
    } else if (pos > 0.70) {
      // Strong right preference
      const conf = 0.60 + (pos - 0.70); // 0.60 to 0.90
      for (const tag of def.rightSignals) {
        signals.push(positive(tag, domain, Math.min(conf, 0.85)));
      }
      for (const tag of def.leftSignals) {
        signals.push(rejection(tag, 0.60));
      }
    } else {
      // Moderate zone — only emit the leaning side at reduced confidence
      const leftWeight = 1 - pos; // 0.30-0.70 → 0.70-0.30
      const rightWeight = pos;    // 0.30-0.70 → 0.30-0.70

      if (leftWeight > rightWeight) {
        for (const tag of def.leftSignals) {
          signals.push(positive(tag, domain, 0.50));
        }
      } else {
        for (const tag of def.rightSignals) {
          signals.push(positive(tag, domain, 0.50));
        }
      }
      // No rejection signals in moderate zone
    }
  }

  return signals;
}

// ─── Sustainability Scale (single 0-100) ─────────────────────────────────────

function generateSustainabilitySignals(
  scaleValue: number,
): TasteSignal[] {
  const signals: TasteSignal[] = [];
  const normalized = Math.max(0, Math.min(100, scaleValue)) / 100;
  const domain = 'Sustainability';

  if (normalized >= 0.80) {
    signals.push(positive('Sustainability-priority', domain, 0.90));
    signals.push(positive('Eco-conscious-traveler', domain, 0.85));
    signals.push(positive('Greenwashing-detector', domain, 0.75));
  } else if (normalized >= 0.55) {
    signals.push(positive('Sustainability-conscious', domain, 0.70));
    signals.push(positive('Prefers-responsible', domain, 0.60));
  } else if (normalized >= 0.30) {
    signals.push(positive('Sustainability-neutral', domain, 0.50));
  } else {
    signals.push(positive('Sustainability-indifferent', domain, 0.40));
  }

  return signals;
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

export function generateSignalsV2(archetype: TasteArchetype): SignalGenerationResult {
  const inputs = archetype.onboardingInputs;

  const experienceElo = inputs?.experiencePreferences
    ? generateExperienceSignals(inputs.experiencePreferences)
    : [];

  const imagePairs = inputs?.imagePairChoices
    ? generateImagePairSignals(inputs.imagePairChoices)
    : [];

  const designerSelections = inputs?.designerSelections
    ? generateDesignerSignals(inputs.designerSelections)
    : [];

  const diagnostics = inputs?.diagnosticChoices
    ? generateDiagnosticSignals(inputs.diagnosticChoices)
    : [];

  const sliders = inputs?.sliderPositions
    ? generateSliderSignals(inputs.sliderPositions)
    : [];

  const sustainabilityScale = typeof inputs?.sustainabilityScale === 'number'
    ? generateSustainabilitySignals(inputs.sustainabilityScale)
    : [];

  const allSignals = [
    ...experienceElo,
    ...imagePairs,
    ...designerSelections,
    ...diagnostics,
    ...sliders,
    ...sustainabilityScale,
  ];

  return {
    signals: allSignals,
    breakdown: {
      experienceElo,
      imagePairs,
      designerSelections,
      diagnostics,
      sliders,
      sustainabilityScale,
    },
    stats: computeStats(allSignals),
  };
}
