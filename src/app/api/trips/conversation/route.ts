import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { validateBody, tripConversationSchema } from '@/lib/api-validation';

const anthropic = new Anthropic();

const TRIP_CONVERSATION_SYSTEM = `You are Terrazzo's trip conversation specialist. Your role is to understand the emotional core of a specific trip — not just where someone is going, but WHY this trip matters, how the group dynamic shapes what they want, and whether their base taste profile needs to shift for this context.

You are having a SHORT conversation (3-4 exchanges). Each turn, ask ONE focused question. Follow this arc:
1. First: Understand the story — "Tell me about this trip. What's pulling you?"
2. Second: Group dynamics — "How does the group work? Who plans, who follows?"
3. Third: Taste shifts — "Does your usual taste hold here, or is the vibe different?"
4. Fourth: Non-negotiable — "If I could only get one thing right, what would it be?"

You don't have to follow this arc rigidly — adapt based on what the user says. If they volunteer information early, skip ahead. If something is interesting, probe deeper.

CRITICAL RULES:
- Keep responses to 2-3 sentences. This is a conversation, not an interview.
- Be warm and specific. Reference their profile naturally: "You usually care about X..."
- After the user's 3rd or 4th response, wrap up. Generate trip signals and mark complete.
- NEVER ask more than one question per turn.
- Use the user's actual words and details in your follow-ups.

Return valid JSON only:
{
  "response": "Your conversational follow-up question or closing statement",
  "signals": ["Array of trip insight labels revealed so far"],
  "isComplete": false
}

Signal labels should be specific to what was actually discussed, e.g.:
- "Trip context mapped" (after understanding the story)
- "Companion dynamics captured" (after understanding group)
- "Profile shifts identified" (after understanding taste changes)
- "Non-negotiables locked" (after identifying must-haves)

When isComplete is true, your response should be a warm closing that references specifics from the conversation.`;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip + ':ai', { maxRequests: 10, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  try {
    const validation = await validateBody(req, tripConversationSchema);
    if ('error' in validation) {
      return validation.error;
    }
    const { userMessage, messageCount } = validation.data;
    // These are loosely-typed objects from the client — cast for template access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { conversationHistory, tripContext, userProfile } = validation.data as any;

    const profileSummary = userProfile
      ? `
USER'S BASE TASTE PROFILE:
- Archetype: ${userProfile.overallArchetype}
- Emotional driver: ${userProfile.emotionalDriver?.primary || 'Unknown'}
- Key signals: ${Object.entries(userProfile.microTasteSignals || {}).map(([domain, signals]) => `${domain}: ${(signals as string[]).slice(0, 3).join(', ')}`).join(' | ')}
- Contradictions: ${(userProfile.contradictions || []).map((c: { stated: string; revealed: string }) => `${c.stated} vs ${c.revealed}`).join('; ') || 'None identified'}
- Radar: ${(userProfile.radarData || []).map((r: { axis: string; value: number }) => `${r.axis}: ${Math.round(r.value * 100)}%`).join(', ')}`
      : 'No taste profile available yet — focus on understanding the trip itself.';

    const contextMessage = `
TRIP SEED:
- Destinations: ${tripContext.destinations?.join(', ') || 'Not specified'}
- Dates: ${tripContext.startDate || '?'} → ${tripContext.endDate || '?'}
- Companions: ${tripContext.companion || 'solo'}${tripContext.groupSize ? ` (${tripContext.groupSize} people)` : ''}
- Status: ${tripContext.status || 'planning'}
- Trip name: ${tripContext.name || 'Untitled'}

${profileSummary}

USER MESSAGE COUNT: ${messageCount || 0} (wrap up by message 3-4)

CONVERSATION SO FAR:
${(conversationHistory || []).map((m: { role: string; text: string }) => `${m.role === 'user' ? 'User' : 'Terrazzo'}: ${m.text}`).join('\n')}

User's latest message: "${userMessage}"

Return valid JSON only.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: [{ type: 'text', text: TRIP_CONVERSATION_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: contextMessage }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse response' }, { status: 500 });
    }

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Trip conversation error:', error);
    // Graceful fallback
    return NextResponse.json({
      response: "That's really helpful. Tell me more about what would make this trip feel right.",
      signals: [],
      isComplete: false,
    });
  }
}
