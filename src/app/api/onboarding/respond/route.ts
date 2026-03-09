import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { validateBody, onboardingAnalyzeSchema } from '@/lib/api-validation';
import { ONBOARDING_PHASES } from '@/constants/onboarding';

/**
 * Streaming conversational endpoint — generates ONLY the followUp response.
 * Signal extraction happens in /api/onboarding/extract (fire-and-forget).
 *
 * Returns a text/event-stream (SSE) with two event types:
 *   event: token     → data: {"text": "partial token"}
 *   event: done      → data: {"followUp": "full text", "phaseComplete": false, ...}
 *
 * The client starts TTS on the first complete sentence while later sentences stream.
 */

const anthropic = new Anthropic();

const CONVERSATION_SYSTEM_PROMPT = `You are a warm, perceptive travel taste profiler for Terrazzo. You're having a natural conversation to understand someone's travel preferences.

YOUR ONLY JOB: Generate a natural, contextual follow-up response to the user. You are NOT extracting signals or doing analysis — that happens elsewhere.

RULES:
- DIRECTLY RESPOND to what the user just said. Reference their specific words, places, and details.
- If they mentioned specific hotels or places, reference them by name.
- If they asked you a question, ANSWER it before asking yours.
- Stay on the current phase's topic. Don't wander.
- Be warm and conversational — like a perceptive friend, not a quiz.
- Keep responses concise: 1-3 sentences max.
- Never say "you gravitate toward" or use clinical language.
- Never repeat questions that have already been asked (check conversation history).
- If the user asks for clarification, rephrase in different words with a concrete example.
- If the user says "nothing comes to mind", "I don't know", "not really", "I can't think of anything", or anything similar — ACCEPT IT GRACEFULLY. Don't rephrase the same question or try to extract an answer. Set phaseComplete to true and give a warm wrap-up. Not every phase will resonate with every person, and that's fine.

SPEECH-TO-TEXT AWARENESS:
The user is speaking aloud and their words are transcribed by browser speech recognition. Proper nouns (hotel names, city names) may be garbled. Use your knowledge to interpret what they likely mean (e.g., "I'm on Geary" → "Amangiri", "pasta aqua" → "Passalacqua"). Use the correct spelling in your response.

PHASE COMPLETION:
When the phase is complete, your response should be a warm 1-2 sentence acknowledgment of what was shared. NO questions. NO previewing the next topic.

OUTPUT FORMAT:
You MUST output a JSON object with exactly these fields, and NOTHING else (no markdown, no explanations):
{
  "followUp": "your conversational response",
  "phaseComplete": boolean,
  "userRequestedSkip": boolean (optional, true if user said skip/move on/next OR if they clearly have nothing to share for this phase — e.g., "nothing comes to mind", "I can't think of anything", "not really"),
  "correctedTranscript": "cleaned transcript if you corrected garbled speech" (optional)
}`;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip + ':respond', { maxRequests: 20, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  try {
    const validation = await validateBody(req, onboardingAnalyzeSchema);
    if ('error' in validation) {
      return validation.error;
    }
    const { userText, conversationHistory, phaseId, userMessageCount } = validation.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const crossPhaseContext = validation.data.crossPhaseContext as any;

    const phase = ONBOARDING_PHASES.find((p) => p.id === phaseId);
    const phaseIndex = phase ? ONBOARDING_PHASES.indexOf(phase) : -1;
    const isLastPhase = phaseIndex === ONBOARDING_PHASES.length - 1;

    const contextMessage = `
CURRENT PHASE: "${phase?.title || phaseId}"
PHASE PURPOSE: ${phase?.subtitle || 'General taste profiling'}
OPENING QUESTION FOR THIS PHASE: ${phase?.aiPrompt || ''}
${isLastPhase ? 'This is the final phase.' : ''}

SCRIPTED FOLLOW-UP TOPICS (use as guides for WHAT to explore — never use verbatim):
${phase?.followUps?.map((f, i) => `${i + 1}. ${f}`).join('\n') || 'None'}

USER MESSAGE COUNT: ${userMessageCount || 0} (phaseComplete MUST be false if < 3, wrap up by 4-5)
${crossPhaseContext?.completedPhases?.length > 0 ? `
CONTEXT FROM PREVIOUS PHASES:
${crossPhaseContext.lifeContext ? `- Life context: ${JSON.stringify(crossPhaseContext.lifeContext)}` : ''}
${crossPhaseContext.keySignals?.length ? `- Key taste signals: ${crossPhaseContext.keySignals.join(', ')}` : ''}
${crossPhaseContext.trustedSources?.length ? `- Trusted sources: ${crossPhaseContext.trustedSources.join(', ')}` : ''}
${crossPhaseContext.goBackPlace ? `- Go-back place: ${crossPhaseContext.goBackPlace}` : ''}
${crossPhaseContext.priorUserMessages?.length ? `- PRIOR USER MESSAGES:\n${crossPhaseContext.priorUserMessages.map((m: string) => `  "${m}"`).join('\n')}` : ''}
${crossPhaseContext.priorAiQuestions?.length ? `- QUESTIONS ALREADY ASKED:\n${crossPhaseContext.priorAiQuestions.map((m: string) => `  "${m}"`).join('\n')}` : ''}
${crossPhaseContext.currentPhaseAiQuestions?.length ? `- CURRENT PHASE QUESTIONS:\n${crossPhaseContext.currentPhaseAiQuestions.map((m: string) => `  "${m}"`).join('\n')}` : ''}` : ''}
Recent conversation: ${JSON.stringify(conversationHistory.slice(-6))}

User's latest: "${userText}"

Return valid JSON only.`;

    // Stream from Anthropic — we forward tokens to the client as SSE
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      system: [{ type: 'text', text: CONVERSATION_SYSTEM_PROMPT }],
      messages: [{ role: 'user', content: contextMessage }],
    });

    // Create a TransformStream to convert Anthropic tokens into SSE
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let fullText = '';
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              const token = event.delta.text;
              fullText += token;

              // Send each token as an SSE event
              controller.enqueue(
                encoder.encode(`event: token\ndata: ${JSON.stringify({ text: token })}\n\n`)
              );
            }
          }

          // Parse the final result
          const jsonMatch = fullText.match(/\{[\s\S]*\}/);
          let result = { followUp: null as string | null, phaseComplete: false, userRequestedSkip: false, correctedTranscript: undefined as string | undefined };
          if (jsonMatch) {
            try {
              result = JSON.parse(jsonMatch[0]);
            } catch {
              console.error('[onboarding/respond] JSON parse failed:', jsonMatch[0].slice(0, 300));
            }
          } else {
            console.error('[onboarding/respond] No JSON found. Raw:', fullText.slice(0, 300));
          }

          // Send the final parsed result
          controller.enqueue(
            encoder.encode(`event: done\ndata: ${JSON.stringify(result)}\n\n`)
          );
        } catch (err) {
          console.error('[onboarding/respond] Stream error:', err);
          controller.enqueue(
            encoder.encode(`event: done\ndata: ${JSON.stringify({ followUp: null, phaseComplete: false })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[onboarding/respond] Error:', error instanceof Error ? error.message : error);
    return Response.json({
      followUp: null,
      phaseComplete: false,
    });
  }
}
