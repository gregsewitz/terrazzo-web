/**
 * Onboarding Orchestrator
 *
 * Drives a synthetic user through the complete onboarding flow:
 *   1. Voice phases → real /api/onboarding/analyze (tests extraction fidelity)
 *   2. Structured inputs → direct signal computation (deterministic, no API)
 *   3. Synthesis → real /api/onboarding/synthesize (tests profile generation)
 *
 * This is the hybrid approach: spend API budget on the parts that can fail
 * interestingly (voice extraction), skip it on deterministic parts (card/slider).
 */

import type { TasteArchetype } from '../archetypes';
import type { SyntheticConfig } from '../config';
import { runVoicePhase, isVoicePhase, VOICE_PHASE_IDS } from './voice-phase';
import { computeStructuredSignals } from './structured-inputs';
import { ONBOARDING_PHASES } from '../../../src/constants/onboarding';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SyntheticUserResult {
  /** Archetype this user was generated from */
  archetypeId: string;
  /** Variation seed and degree */
  variation: { seed: number; degree: number };
  /** All accumulated signals (voice + structured) */
  allSignals: Array<{ tag: string; cat: string; confidence: number }>;
  /** Sustainability signals from voice phases */
  sustainabilitySignals: Array<{ tag: string; dimension: string; confidence: number }>;
  /** All conversation messages (voice phases only) */
  allMessages: Array<{ role: string; text: string }>;
  /** Detected contradictions */
  contradictions: Array<{ stated: string; revealed: string }>;
  /** Final certainties */
  certainties: Record<string, number>;
  /** Extracted life context */
  lifeContext: Record<string, unknown>;
  /** The synthesized taste profile (output of /api/onboarding/synthesize) */
  synthesizedProfile: Record<string, unknown> | null;
  /** Per-phase results for debugging */
  phaseResults: Record<string, unknown>;
  /** Structured input breakdown */
  structuredBreakdown: Record<string, unknown>;
  /** Timing data */
  timing: {
    totalMs: number;
    voiceMs: number;
    synthesisMs: number;
    phases: Record<string, number>;
  };
  /** Cost estimate (Claude API calls) */
  estimatedCost: {
    voiceGenerationCalls: number;
    analyzeApiCalls: number;
    synthesizeApiCalls: number;
  };
}

// ─── Initial State ────────────────────────────────────────────────────────────

const INITIAL_CERTAINTIES: Record<string, number> = {
  Design: 5, Atmosphere: 5, Character: 5, Service: 5, FoodDrink: 5, Setting: 5,
  Wellness: 10, Sustainability: 10,
};

// ─── Synthesis API Call ───────────────────────────────────────────────────────

async function callSynthesizeEndpoint(
  apiBaseUrl: string,
  payload: {
    signals: Array<{ tag: string; cat: string; confidence: number }>;
    messages: Array<{ role: string; text: string }>;
    contradictions: Array<{ stated: string; revealed: string }>;
    certainties: Record<string, number>;
  },
): Promise<Record<string, unknown>> {
  const res = await fetch(`${apiBaseUrl}/api/onboarding/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Synthesize API returned ${res.status}: ${text}`);
  }

  return res.json();
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

/**
 * Run a single synthetic user through the complete onboarding flow.
 */
export async function runSyntheticUser(
  archetype: TasteArchetype,
  variationSeed: number,
  variationDegree: number,
  config: SyntheticConfig,
): Promise<SyntheticUserResult> {
  const startTime = Date.now();

  const result: SyntheticUserResult = {
    archetypeId: archetype.id,
    variation: { seed: variationSeed, degree: variationDegree },
    allSignals: [],
    sustainabilitySignals: [],
    allMessages: [],
    contradictions: [],
    certainties: { ...INITIAL_CERTAINTIES },
    lifeContext: {},
    synthesizedProfile: null,
    phaseResults: {},
    structuredBreakdown: {},
    timing: { totalMs: 0, voiceMs: 0, synthesisMs: 0, phases: {} },
    estimatedCost: { voiceGenerationCalls: 0, analyzeApiCalls: 0, synthesizeApiCalls: 0 },
  };

  // ─── Phase 1: Voice Phases (real API extraction) ───────────────────────────

  console.log(`    Running voice phases for ${archetype.id}...`);

  // Build cross-phase context that accumulates as we go
  const crossPhaseContext: Record<string, unknown> = {
    completedPhases: [] as string[],
    priorUserMessages: [] as string[],
    priorAiQuestions: [] as string[],
  };

  const voiceStartTime = Date.now();

  // Only run voice phases that exist in the phase definitions
  const voicePhaseDefs = ONBOARDING_PHASES.filter(p =>
    p.modality === 'voice' && p.aiPrompt
  );

  for (const phaseDef of voicePhaseDefs) {
    const phaseStart = Date.now();

    try {
      console.log(`      Phase: ${phaseDef.id} (${phaseDef.title})`);

      const phaseResult = await runVoicePhase(
        archetype,
        phaseDef.id,
        phaseDef.aiPrompt,
        {
          apiBaseUrl: config.apiBaseUrl,
          anthropicApiKey: config.anthropicApiKey,
          maxTurnsPerPhase: 5,
        },
        variationSeed,
        variationDegree,
        result.certainties,
        crossPhaseContext,
      );

      // Accumulate results
      result.allSignals.push(...phaseResult.extractedSignals);
      result.sustainabilitySignals.push(...phaseResult.sustainabilitySignals);
      result.contradictions.push(...phaseResult.contradictions);
      result.certainties = { ...result.certainties, ...phaseResult.certainties };

      // Build conversation messages
      for (let i = 0; i < phaseResult.generatedResponses.length; i++) {
        result.allMessages.push({ role: 'user', text: phaseResult.generatedResponses[i] });
        if (phaseResult.aiQuestions[i + 1]) {
          result.allMessages.push({ role: 'assistant', text: phaseResult.aiQuestions[i + 1] });
        }
      }

      // Update cross-phase context
      if (phaseResult.lifeContext) {
        result.lifeContext = { ...result.lifeContext, ...phaseResult.lifeContext };
        (crossPhaseContext as Record<string, unknown>).lifeContext = result.lifeContext;
      }
      if (phaseResult.trustedSources?.length) {
        (crossPhaseContext as Record<string, unknown>).trustedSources = phaseResult.trustedSources;
      }
      if (phaseResult.goBackPlace) {
        (crossPhaseContext as Record<string, unknown>).goBackPlace = phaseResult.goBackPlace;
      }

      (crossPhaseContext.completedPhases as string[]).push(phaseDef.id);
      (crossPhaseContext.priorUserMessages as string[]).push(...phaseResult.generatedResponses);
      (crossPhaseContext.priorAiQuestions as string[]).push(...phaseResult.aiQuestions);
      (crossPhaseContext as Record<string, unknown>).keySignals =
        result.allSignals.filter(s => s.confidence >= 0.7).map(s => s.tag).slice(-15);

      // Track costs
      result.estimatedCost.voiceGenerationCalls += phaseResult.generatedResponses.length;
      result.estimatedCost.analyzeApiCalls += phaseResult.generatedResponses.length;

      // Store phase result for debugging
      result.phaseResults[phaseDef.id] = {
        signals: phaseResult.extractedSignals.length,
        contradictions: phaseResult.contradictions.length,
        turns: phaseResult.generatedResponses.length,
      };

    } catch (err) {
      console.error(`      ⚠ Phase ${phaseDef.id} failed:`, err);
      result.phaseResults[phaseDef.id] = { error: String(err) };
    }

    result.timing.phases[phaseDef.id] = Date.now() - phaseStart;
  }

  result.timing.voiceMs = Date.now() - voiceStartTime;

  // ─── Phase 2: Structured Inputs (direct computation) ───────────────────────

  console.log(`    Computing structured input signals...`);

  const structured = computeStructuredSignals(archetype);
  result.allSignals.push(...structured.signals);
  result.structuredBreakdown = structured.breakdown;

  console.log(`      Experience Elo: ${structured.breakdown.experienceElo.length} signals`);
  console.log(`      Image Pairs: ${structured.breakdown.imagePairs.length} signals`);
  console.log(`      Designer Pool: ${structured.breakdown.designerSelections.length} signals`);
  console.log(`      Diagnostics: ${structured.breakdown.diagnostics.length} signals`);

  // ─── Phase 3: Profile Synthesis (real API) ─────────────────────────────────

  console.log(`    Synthesizing profile...`);
  const synthesisStart = Date.now();

  try {
    const profile = await callSynthesizeEndpoint(config.apiBaseUrl, {
      signals: result.allSignals,
      messages: result.allMessages,
      contradictions: result.contradictions,
      certainties: result.certainties,
    });

    result.synthesizedProfile = profile;
    result.estimatedCost.synthesizeApiCalls = 1;
    console.log(`      ✓ Profile synthesized: ${(profile as any).overallArchetype || 'unknown archetype'}`);
  } catch (err) {
    console.error(`      ⚠ Synthesis failed:`, err);
  }

  result.timing.synthesisMs = Date.now() - synthesisStart;
  result.timing.totalMs = Date.now() - startTime;

  console.log(`    Done: ${result.allSignals.length} signals, ${result.timing.totalMs}ms`);

  return result;
}

/**
 * Run all variations of an archetype through the full pipeline.
 */
export async function runArchetypeVariations(
  archetype: TasteArchetype,
  config: SyntheticConfig,
): Promise<SyntheticUserResult[]> {
  const results: SyntheticUserResult[] = [];

  for (let v = 0; v < config.variationsPerArchetype; v++) {
    const degree = config.variationDegreeRange[0] +
      (config.variationDegreeRange[1] - config.variationDegreeRange[0]) *
      (v / Math.max(config.variationsPerArchetype - 1, 1));

    console.log(`  ${archetype.id} variation ${v + 1}/${config.variationsPerArchetype} (degree: ${degree.toFixed(2)})`);

    const result = await runSyntheticUser(archetype, v, degree, config);
    results.push(result);
  }

  return results;
}
