import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { validateBody, onboardingAnalyzeSchema } from '@/lib/api-validation';
import { TASTE_ONTOLOGY_SYSTEM_PROMPT, ONBOARDING_PHASES } from '@/constants/onboarding';
import { CLAUDE_SONNET } from '@/lib/models';
import { getUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';

/**
 * Background signal extraction endpoint — runs AFTER /api/onboarding/respond
 * has already returned the conversational response.
 *
 * This does all the heavy lifting: signal extraction, certainty updates,
 * place detection, life context extraction, phase-specific data, etc.
 *
 * The client fires this as fire-and-forget (or awaits it in the background)
 * so the user never waits for it.
 *
 * Signals are persisted to the TasteNode relational table server-side,
 * which is the canonical store for all taste signals. The response still
 * returns signals to the client for in-session Zustand state.
 */

const anthropic = new Anthropic();

/**
 * Persist extracted signals to the TasteNode table.
 * Non-blocking: errors are logged but don't fail the extraction response.
 */
async function persistExtractedSignals(
  userId: string,
  phaseId: string,
  signals: Array<{ tag: string; cat: string; confidence: number }>,
): Promise<{ persisted: number; errors: number }> {
  if (!signals.length) return { persisted: 0, errors: 0 };

  const now = new Date();
  let errorCount = 0;

  const validSignals = signals.filter((s) => {
    if (!s.tag || typeof s.tag !== 'string' || !s.cat || typeof s.cat !== 'string') {
      errorCount++;
      return false;
    }
    if (typeof s.confidence !== 'number' || s.confidence < 0 || s.confidence > 1) {
      errorCount++;
      return false;
    }
    return true;
  });

  if (validSignals.length === 0) {
    console.warn(`[extract/persist] No valid signals to persist for phase "${phaseId}"`);
    return { persisted: 0, errors: errorCount };
  }

  try {
    const createData = validSignals.map((sig) => ({
      userId,
      domain: sig.cat,
      signal: sig.tag,
      confidence: sig.confidence,
      source: 'onboarding',
      category: sig.cat,
      isActive: true,
      extractedAt: now,
      sourcePhaseId: phaseId,
      sourceModality: 'VOICE',
      updatedAt: now,
    }));

    const result = await prisma.tasteNode.createMany({ data: createData });
    console.log(`[extract/persist] Persisted ${result.count} TasteNodes for phase "${phaseId}" (user: ${userId})`);
    return { persisted: result.count, errors: errorCount };
  } catch (err) {
    console.error(`[extract/persist] Failed to persist TasteNodes for phase "${phaseId}":`, err instanceof Error ? err.message : err);
    return { persisted: 0, errors: errorCount + validSignals.length };
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip + ':extract', { maxRequests: 20, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  // Auth is optional — persist TasteNodes only if we have a user.
  // Extract still works without auth for resilience during onboarding.
  const user = await getUser(req).catch(() => null);

  try {
    const validation = await validateBody(req, onboardingAnalyzeSchema);
    if ('error' in validation) {
      return validation.error;
    }
    const { userText, conversationHistory, phaseId, certainties, userMessageCount } = validation.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const crossPhaseContext = validation.data.crossPhaseContext as any;

    const phase = ONBOARDING_PHASES.find((p) => p.id === phaseId);
    const phaseIndex = phase ? ONBOARDING_PHASES.indexOf(phase) : -1;
    const isLastPhase = phaseIndex === ONBOARDING_PHASES.length - 1;

    // Full extraction prompt — same signal extraction logic as the old analyze endpoint
    // but WITHOUT the conversational response generation
    const contextMessage = `
CURRENT PHASE: "${phase?.title || phaseId}"
PHASE PURPOSE: ${phase?.subtitle || 'General taste profiling'}
${isLastPhase ? 'This is the final phase.' : ''}

Current certainties: ${JSON.stringify(certainties)}
USER MESSAGE COUNT: ${userMessageCount || 0}
${crossPhaseContext?.completedPhases?.length > 0 ? `
CROSS-PHASE CONTEXT:
${crossPhaseContext.lifeContext ? `- Life context: ${JSON.stringify(crossPhaseContext.lifeContext)}` : ''}
${crossPhaseContext.keySignals?.length ? `- Key signals: ${crossPhaseContext.keySignals.join(', ')}` : ''}
${crossPhaseContext.trustedSources?.length ? `- Trusted sources: ${crossPhaseContext.trustedSources.join(', ')}` : ''}
${crossPhaseContext.goBackPlace ? `- Go-back place: ${crossPhaseContext.goBackPlace}` : ''}` : ''}
Conversation (this phase): ${JSON.stringify(conversationHistory.slice(-10))}

User's latest: "${userText}"

SPEECH-TO-TEXT: The user is speaking and words are transcribed by browser speech recognition. Proper nouns may be garbled (e.g., "I'm on Geary" → "Amangiri"). Use your knowledge to interpret correctly.

EXTRACT the following from the user's response:

1. TASTE SIGNALS: Specific, matchable preferences. Tag format: "vernacular-modern" not "likes nice design". Confidence: 0.9-1.0 explicit, 0.7-0.89 strong, 0.5-0.69 moderate. Anti-signals prefixed with "anti-".

2. CERTAINTY UPDATES: Update scores (0-100) for domains where you gained confidence.

3. CONTRADICTIONS: Stated vs revealed, abstract ideal vs specific memory.

4. MENTIONED PLACES: Any specific hotel, restaurant, bar, café, spa, experience, or destination by name.
   Each: { name, location?, placeType, sentiment: "love"|"like"|"visited"|"dislike", confidence, context? }

5. LIFE CONTEXT: firstName, homeCity, partnerName, relationshipStatus, hasKids, kidAges, primaryCompanions, travelFrequency — only fields explicitly mentioned.

PHASE-SPECIFIC EXTRACTION:
${phaseId === 'trusted-sources' ? '- Extract trustedSource/trustedSources: { type, name, context?, relationship? }' : ''}
${phaseId === 'go-back-place' ? '- Extract goBackPlace: { placeName, location?, reason }' : ''}
${phaseId === 'companion-context' || phaseId === 'memorable-stays' ? '- Extract contextModifiers: [{ companion, preferences }], partnerTravelDynamic?, soloTravelIdentity?' : ''}
${phaseId === 'emotional-core' ? '- Extract emotionalDriverPrimary (freeform — e.g., "Controlled surrender", "Narrative accumulation", "Quiet recalibration"), emotionalDriverSecondary (a secondary driver creating productive tension)' : ''}
${phaseId === 'dream-destinations' ? `- Extract dreamDestinations: array of places the user dreams of visiting.
  Each: { name: string, location?: string (country/region), placeType?: "city"|"country"|"hotel"|"restaurant"|"region", appeal: string (1-2 sentences why they want to go), confidence: 0-1 }
  Include ALL destinations mentioned, even brief mentions. Confidence: 0.9+ explicit dream, 0.7-0.89 strong interest, 0.5-0.69 passing mention.` : ''}

Return valid JSON:
{
  "signals": [{ "tag": "string", "cat": "Design|Atmosphere|Character|Service|FoodDrink|Setting|Wellness|Sustainability|Rejection|Context|Emotion|Core", "confidence": 0.0-1.0 }],
  "sustainabilitySignals": [],
  "emotionalDriverHint": null,
  "certainties": {},
  "contradictions": [],
  "mentionedPlaces": [],
  "lifeContext": {},
  ${phaseId === 'dream-destinations' ? '"dreamDestinations": [],' : ''}
  ... (phase-specific fields as applicable)
}`;

    const response = await anthropic.messages.create({
      model: CLAUDE_SONNET,
      max_tokens: 800,
      system: [{ type: 'text', text: TASTE_ONTOLOGY_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: contextMessage }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[onboarding/extract] Failed to extract JSON. Raw:', text.slice(0, 500));
      return NextResponse.json({
        signals: [],
        sustainabilitySignals: [],
        emotionalDriverHint: null,
        certainties: {},
        contradictions: [],
        mentionedPlaces: [],
      });
    }

    let result;
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('[onboarding/extract] JSON parse failed:', jsonMatch[0].slice(0, 500), parseError);
      return NextResponse.json({
        signals: [],
        sustainabilitySignals: [],
        emotionalDriverHint: null,
        certainties: {},
        contradictions: [],
        mentionedPlaces: [],
      });
    }

    // Normalize
    if (!result.sustainabilitySignals) result.sustainabilitySignals = [];
    if (!result.emotionalDriverHint) result.emotionalDriverHint = null;
    if (!result.mentionedPlaces) result.mentionedPlaces = [];

    // ── Persist signals to TasteNode table ──
    // This is the canonical write path — signals are persisted as they're
    // extracted, with full provenance (phaseId, modality, extractedAt).
    // We await persistence so the client knows TasteNodes are committed
    // before triggering compute-vectors (which reads from TasteNode).
    let persistence: { persisted: number; errors: number } | null = null;
    if (user?.id && result.signals?.length) {
      try {
        persistence = await persistExtractedSignals(user.id, phaseId, result.signals);
      } catch (err) {
        console.error('[onboarding/extract] TasteNode persistence failed:', err);
        persistence = { persisted: 0, errors: result.signals.length };
      }
    } else if (!user?.id && result.signals?.length) {
      console.warn(`[onboarding/extract] No authenticated user — ${result.signals.length} signals extracted but not persisted to TasteNode`);
    }

    return NextResponse.json({ ...result, ...(persistence && { persistence }) });
  } catch (error) {
    console.error('[onboarding/extract] Error:', error instanceof Error ? error.message : error);
    return NextResponse.json({
      signals: [],
      sustainabilitySignals: [],
      emotionalDriverHint: null,
      certainties: {},
      contradictions: [],
      mentionedPlaces: [],
    });
  }
}
