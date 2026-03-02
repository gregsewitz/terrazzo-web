import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { validateBody, onboardingAnalyzeSchema } from '@/lib/api-validation';
import { TASTE_ONTOLOGY_SYSTEM_PROMPT, ONBOARDING_PHASES } from '@/constants/onboarding';

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip + ':ai', { maxRequests: 10, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  try {
    const validation = await validateBody(req, onboardingAnalyzeSchema);
    if ('error' in validation) {
      return validation.error;
    }
    const { userText, conversationHistory, phaseId, certainties, userMessageCount } = validation.data;
    // crossPhaseContext is a loosely-typed bag from the client — cast for template access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const crossPhaseContext = validation.data.crossPhaseContext as any;

    // Look up the phase definition so Claude knows the purpose and scripted follow-ups
    const phase = ONBOARDING_PHASES.find((p) => p.id === phaseId);
    const phaseIndex = phase ? ONBOARDING_PHASES.indexOf(phase) : -1;
    const isLastPhase = phaseIndex === ONBOARDING_PHASES.length - 1;

    const contextMessage = `
CURRENT PHASE: "${phase?.title || phaseId}"
PHASE PURPOSE: ${phase?.subtitle || 'General taste profiling'}
OPENING QUESTION FOR THIS PHASE: ${phase?.aiPrompt || ''}
${isLastPhase ? 'This is the final phase.' : ''}

SCRIPTED FOLLOW-UPS (use these as your guide for what to ask next — rephrase naturally based on what the user actually said, but stay on topic and don't invent tangential questions):
${phase?.followUps?.map((f, i) => `${i + 1}. ${f}`).join('\n') || 'None'}

Current certainties: ${JSON.stringify(certainties)}
USER MESSAGE COUNT SO FAR: ${userMessageCount || 0} (phaseComplete MUST be false if < 3, and you SHOULD wrap up by 4-5 — the system will force-complete at 6)
${crossPhaseContext?.completedPhases?.length > 0 ? `
WHAT YOU ALREADY KNOW ABOUT THIS USER (from previous phases — reference this naturally when relevant):
${crossPhaseContext.lifeContext ? `- Life context: ${JSON.stringify(crossPhaseContext.lifeContext)}` : ''}
${crossPhaseContext.keySignals?.length ? `- Key taste signals so far: ${crossPhaseContext.keySignals.join(', ')}` : ''}
${crossPhaseContext.trustedSources?.length ? `- Their trusted sources: ${crossPhaseContext.trustedSources.join(', ')}` : ''}
${crossPhaseContext.goBackPlace ? `- Their go-back place: ${crossPhaseContext.goBackPlace}` : ''}
${crossPhaseContext.priorUserMessages?.length ? `- WHAT THE USER SAID IN EARLIER PHASES (these are their actual words — you should recognize hotels, places, and details they've already mentioned and NOT act surprised or unfamiliar when they come up again):
${crossPhaseContext.priorUserMessages.map((m: string) => `  "${m}"`).join('\n')}` : ''}
${crossPhaseContext.priorAiQuestions?.length ? `- QUESTIONS ALREADY ASKED IN EARLIER PHASES (DO NOT re-ask these or ask similar questions — the user has already answered them):
${crossPhaseContext.priorAiQuestions.map((m: string) => `  "${m}"`).join('\n')}` : ''}
${crossPhaseContext.currentPhaseAiQuestions?.length ? `- QUESTIONS YOU ALREADY ASKED IN THIS PHASE (DO NOT repeat these — each follow-up must be genuinely new):
${crossPhaseContext.currentPhaseAiQuestions.map((m: string) => `  "${m}"`).join('\n')}` : ''}
Use this context to make the conversation feel CONNECTED and CONTINUOUS. If the user mentions a hotel or place they've already discussed in a previous phase, acknowledge that you remember it — e.g., "Forestis again — that place clearly left an impression" or "You mentioned that one earlier." NEVER react to a previously discussed place as if hearing about it for the first time.` : ''}
Conversation so far (this phase): ${JSON.stringify(conversationHistory.slice(-10))}

User's latest response: "${userText}"

IMPORTANT — SPEECH-TO-TEXT INPUT:
The user is speaking out loud and their words are transcribed by browser speech recognition. This means:
- Proper nouns (hotel names, city names, people's names) may be BADLY garbled
- Examples: "Amangiri" → "I'm on Geary" or "a mon giri", "Passalacqua" → "pasta aqua" or "pasa laqua", "Aman Tokyo" → "a man Tokyo", "masseria" → "Masaria" or "mass area"
- Use your knowledge of luxury hotels, travel destinations, and context to INTELLIGENTLY INTERPRET what the user likely means
- If you're fairly confident you know the correct name, use the correct spelling in your response and in extracted signals (e.g., respond with "Amangiri" not "I'm on Geary")
- If you can't figure out what they mean, ask them to clarify naturally — e.g., "That sounds amazing — can you spell the name of that hotel for me? Speech recognition can be tricky with these names."
- Also include a "correctedTranscript" field in your JSON if you've corrected any garbled proper nouns — this is the cleaned-up version of what the user said. Only include this field if corrections were made.

Extract taste signals, update certainties, generate a follow-up question that STAYS ON THIS PHASE'S TOPIC (do NOT make small talk or ask about unrelated details), detect contradictions, and determine if this phase is complete.

ALSO: If the user mentions ANY personal/life details, extract them into a "lifeContext" object. This includes:
- firstName: their first name
- homeCity: where they live
- partnerName: their partner/spouse name (use EXACT spelling the user provides — if they correct a spelling, use the corrected version)
- relationshipStatus: "married" | "partnered" | "single" | "not_specified"
- hasKids: boolean
- kidAges: array of "baby" | "toddler" | "school_age" | "teen"
- primaryCompanions: array of "solo" | "partner" | "friends" | "family"
- travelFrequency: "frequent" | "occasional" | "rare" (infer from conversation)
Only include fields that are explicitly mentioned. If the user corrects something (e.g. corrects a name spelling), include the corrected value.

PHASE-SPECIFIC EXTRACTION:

If this is the "trusted-sources" phase (Phase 5), also extract a "trustedSource" object if the user mentions anyone or any publication:
- type: "friend" | "publication" | "instagram" | "newsletter"
- name: the person or publication name
- context: optional relationship/location context (e.g. "lives in Paris")
- relationship: optional relationship to user (e.g. "college friend")
If they mention BOTH a friend AND a publication, return an array "trustedSources" with both.

If this is the "go-back-place" phase (Phase 6), also extract a "goBackPlace" object:
- placeName: name of the place/hotel/city
- reason: why they love it (extracted from their natural language)

If this is the "companion-context" phase (Phase 3), also extract "contextModifiers" — an array of companion × preference mappings like:
- { companion: "partner", preferences: ["romance", "design-forward"] }
- { companion: "solo", preferences: ["total solitude", "nature"] }
- { companion: "friends", preferences: ["walkable", "restaurant proximity"] }
Also extract if mentioned:
- partnerTravelDynamic: who's the planner, who's pickier, what they disagree on (free text)
- soloTravelIdentity: how they see themselves as a solo traveler (e.g. "escapist", "explorer")

If this is the "emotional-core" phase (Phase 10), also extract:
- emotionalDriverPrimary: their primary emotional driver for travel (e.g. "Aesthetic expansion")
- emotionalDriverSecondary: secondary driver (e.g. "Partner connection")

Return valid JSON only.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: [{ type: 'text', text: TASTE_ONTOLOGY_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: contextMessage }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse analysis' }, { status: 500 });
    }

    const result = JSON.parse(jsonMatch[0]);

    // Normalize: ensure new fields exist even if Claude omits them
    if (!result.sustainabilitySignals) result.sustainabilitySignals = [];
    if (!result.emotionalDriverHint) result.emotionalDriverHint = null;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Onboarding analysis error:', error);
    // Return a graceful fallback
    return NextResponse.json({
      signals: [],
      sustainabilitySignals: [],
      emotionalDriverHint: null,
      certainties: {},
      followUp: null,
      contradictions: [],
      phaseComplete: false,
    });
  }
}
