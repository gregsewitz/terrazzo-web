/**
 * Voice Phase Simulator
 *
 * Generates realistic voice responses for conversation phases using Claude,
 * then feeds them through the real /api/onboarding/analyze endpoint to test
 * extraction fidelity.
 *
 * This is the core of the hybrid approach — voice phases hit real APIs because
 * that's where extraction can fail in interesting ways. Structured inputs
 * (image pairs, Elo, designers) are injected directly since they're deterministic.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { TasteArchetype } from '../archetypes';

export interface VoicePhaseResult {
  phaseId: string;
  /** The persona's generated voice responses (what they "said") */
  generatedResponses: string[];
  /** Claude's follow-up questions from /api/onboarding/analyze */
  aiQuestions: string[];
  /** Signals extracted by the real extraction pipeline */
  extractedSignals: Array<{ tag: string; cat: string; confidence: number }>;
  /** Sustainability signals extracted */
  sustainabilitySignals: Array<{ tag: string; dimension: string; confidence: number }>;
  /** Contradictions detected */
  contradictions: Array<{ stated: string; revealed: string }>;
  /** Updated certainties after this phase */
  certainties: Record<string, number>;
  /** Life context extracted (welcome phase) */
  lifeContext?: Record<string, unknown>;
  /** Trusted source extracted (trusted-sources phase) */
  trustedSources?: Array<Record<string, unknown>>;
  /** Go-back place extracted */
  goBackPlace?: Record<string, unknown>;
  /** Raw API responses for debugging */
  rawResponses: unknown[];
}

interface VoicePhaseConfig {
  /** Base URL for the Terrazzo API (e.g., http://localhost:3000) */
  apiBaseUrl: string;
  /** Anthropic API key for persona generation */
  anthropicApiKey: string;
  /** Max conversation turns per phase before force-completing */
  maxTurnsPerPhase: number;
}

const VOICE_PHASE_IDS = [
  'memorable-stays',
  'anti-stay',
  'adaptive-conversation',
  'details-matter',
  'emotional-core',
] as const;

// ─── Persona Response Generator ───────────────────────────────────────────────

const PERSONA_VOICE_SYSTEM = `You are roleplaying as a specific traveler persona during an onboarding conversation for a travel app. You must respond AS this person — using their vocabulary, references, emotional tone, and level of detail.

CRITICAL RULES:
1. NEVER speak in taste-ontology language. Real people don't say "I value atmosphere and character." They say "I love places where you can feel the history."
2. Use specific, concrete details from the persona's guidance — hotel names, cities, sensory memories.
3. Match the persona's verbosity level: terse people give 1-2 sentences, expansive people tell stories.
4. Include natural speech patterns: hesitations, self-corrections, tangents that reveal personality.
5. Stay internally consistent with the persona's values even when answering unexpected follow-ups.
6. If the AI interviewer asks something not covered in your guidance, improvise in-character based on the persona's core emotional driver.

You are responding to a question from an AI interviewer. Respond naturally as if speaking aloud (this simulates voice-to-text input).`;

function buildPersonaVoicePrompt(
  archetype: TasteArchetype,
  phaseId: string,
  aiQuestion: string,
  conversationSoFar: Array<{ role: string; text: string }>,
  variationSeed: number,
  variationDegree: number,
): string {
  // Map phase IDs to the voice answer guidance keys
  const guidanceMap: Record<string, string> = {
    'welcome': 'life-context',
    'memorable-stays': 'memorable-stays',
    'companion-context': 'companion-context',
    'anti-stay': 'anti-stay',
    'trusted-sources': 'trusted-sources',
    'go-back-place': 'go-back-place',
    'cultural-engagement': 'cultural-engagement',
    'food-drink-values': 'food-drink-values',
    'sustainability-pulse': 'sustainability-pulse',
    'emotional-core': 'emotional-core',
  };

  const guidanceKey = guidanceMap[phaseId] || phaseId;
  const guidance = archetype.voiceAnswerGuidance?.[guidanceKey] || '';

  return `PERSONA: ${archetype.name}
DESCRIPTION: ${archetype.description}

EXPECTED TASTE PROFILE (DO NOT reference these directly — they inform your character, not your words):
${JSON.stringify(archetype.expectedProfile, null, 2)}

KNOWN CONTRADICTIONS (embody these naturally — say one thing but reveal another through your stories):
${archetype.contradictions?.map(c => `- States: "${c.stated}" / Reveals: "${c.revealed}"`).join('\n') || 'None'}

ONBOARDING BEHAVIOR:
- Verbosity: ${archetype.onboardingBehavior?.verbosity || 'moderate'}
- Specificity: ${archetype.onboardingBehavior?.specificity || 'mixed'}
- Consistency: ${archetype.onboardingBehavior?.consistency || 0.8}

VOICE ANSWER GUIDANCE FOR THIS PHASE:
${guidance || `No specific guidance for "${phaseId}". Improvise in-character based on the persona description.`}

VARIATION: seed=${variationSeed}, degree=${variationDegree.toFixed(2)}
${variationDegree > 0.5 ? 'Apply moderate personality variation: slightly different word choice, maybe reference different specific places while keeping the same underlying taste profile.' : 'Stay close to the archetype template.'}

CONVERSATION SO FAR THIS PHASE:
${conversationSoFar.map(m => `${m.role === 'user' ? 'YOU' : 'INTERVIEWER'}: ${m.text}`).join('\n') || '[Start of phase]'}

INTERVIEWER'S QUESTION:
"${aiQuestion}"

Respond naturally as this persona. Keep it to ${archetype.onboardingBehavior?.verbosity === 'terse' ? '1-2 sentences' : archetype.onboardingBehavior?.verbosity === 'expansive' ? '3-5 sentences, storytelling style' : '2-3 sentences'}.`;
}

// ─── API Caller ───────────────────────────────────────────────────────────────

async function callAnalyzeEndpoint(
  apiBaseUrl: string,
  payload: {
    userText: string;
    conversationHistory: Array<{ role: string; text: string }>;
    phaseId: string;
    certainties: Record<string, number>;
    userMessageCount: number;
    crossPhaseContext?: Record<string, unknown>;
  },
): Promise<{
  signals: Array<{ tag: string; cat: string; confidence: number }>;
  sustainabilitySignals: Array<{ tag: string; dimension: string; confidence: number }>;
  certainties: Record<string, number>;
  followUp: string | null;
  contradictions: Array<{ stated: string; revealed: string }>;
  phaseComplete: boolean;
  lifeContext?: Record<string, unknown>;
  trustedSource?: Record<string, unknown>;
  trustedSources?: Array<Record<string, unknown>>;
  goBackPlace?: Record<string, unknown>;
  correctedTranscript?: string;
  emotionalDriverHint?: string | null;
}> {
  const res = await fetch(`${apiBaseUrl}/api/onboarding/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Analyze API returned ${res.status}: ${text}`);
  }

  return res.json();
}

// ─── Main Voice Phase Runner ─────────────────────────────────────────────────

export async function runVoicePhase(
  archetype: TasteArchetype,
  phaseId: string,
  initialAiPrompt: string,
  config: VoicePhaseConfig,
  variationSeed: number = 0,
  variationDegree: number = 0,
  currentCertainties: Record<string, number> = {},
  crossPhaseContext: Record<string, unknown> = {},
): Promise<VoicePhaseResult> {
  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

  const result: VoicePhaseResult = {
    phaseId,
    generatedResponses: [],
    aiQuestions: [initialAiPrompt],
    extractedSignals: [],
    sustainabilitySignals: [],
    contradictions: [],
    certainties: { ...currentCertainties },
    rawResponses: [],
  };

  const conversationHistory: Array<{ role: string; text: string }> = [];
  let currentQuestion = initialAiPrompt;
  let phaseComplete = false;
  let turnCount = 0;

  while (!phaseComplete && turnCount < config.maxTurnsPerPhase) {
    turnCount++;

    // Step 1: Generate persona response via Claude
    const personaPrompt = buildPersonaVoicePrompt(
      archetype,
      phaseId,
      currentQuestion,
      conversationHistory,
      variationSeed,
      variationDegree,
    );

    const personaResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: PERSONA_VOICE_SYSTEM,
      messages: [{ role: 'user', content: personaPrompt }],
    });

    const userText = personaResponse.content[0].type === 'text'
      ? personaResponse.content[0].text
      : '';

    result.generatedResponses.push(userText);
    conversationHistory.push({ role: 'user', text: userText });

    // Step 2: Feed through real /api/onboarding/analyze
    const analyzeResult = await callAnalyzeEndpoint(config.apiBaseUrl, {
      userText,
      conversationHistory,
      phaseId,
      certainties: result.certainties,
      userMessageCount: turnCount,
      crossPhaseContext,
    });

    result.rawResponses.push(analyzeResult);

    // Accumulate results
    if (analyzeResult.signals?.length) {
      result.extractedSignals.push(...analyzeResult.signals);
    }
    if (analyzeResult.sustainabilitySignals?.length) {
      result.sustainabilitySignals.push(...analyzeResult.sustainabilitySignals);
    }
    if (analyzeResult.contradictions?.length) {
      result.contradictions.push(...analyzeResult.contradictions);
    }
    if (analyzeResult.certainties) {
      result.certainties = { ...result.certainties, ...analyzeResult.certainties };
    }
    if (analyzeResult.lifeContext) {
      result.lifeContext = { ...result.lifeContext, ...analyzeResult.lifeContext };
    }
    if (analyzeResult.trustedSource) {
      result.trustedSources = [...(result.trustedSources || []), analyzeResult.trustedSource];
    }
    if (analyzeResult.trustedSources) {
      result.trustedSources = [...(result.trustedSources || []), ...analyzeResult.trustedSources];
    }
    if (analyzeResult.goBackPlace) {
      result.goBackPlace = analyzeResult.goBackPlace;
    }

    // Track conversation
    if (analyzeResult.followUp) {
      conversationHistory.push({ role: 'assistant', text: analyzeResult.followUp });
      result.aiQuestions.push(analyzeResult.followUp);
      currentQuestion = analyzeResult.followUp;
    }

    phaseComplete = analyzeResult.phaseComplete || !analyzeResult.followUp;
  }

  return result;
}

/**
 * Check if a phase ID is a voice phase (needs real API extraction)
 */
export function isVoicePhase(phaseId: string): boolean {
  return (VOICE_PHASE_IDS as readonly string[]).includes(phaseId);
}

export { VOICE_PHASE_IDS };
