import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

const CHAT_SYSTEM_PROMPT = `You are Terrazzo's trip companion — a taste-aware AI that knows the user's full taste profile and their current trip itinerary. You give specific, actionable advice grounded in their actual schedule and preferences.

RESPONSE RULES:
- Keep responses to 1-3 sentences maximum. Be concise and specific.
- Use **place names** in double asterisks for bold formatting.
- Reference the actual itinerary: "Moving **Tsukiji** to breakfast (best before 9am)..."
- Base ALL suggestions on their profile and TODAY's itinerary, not generic travel advice.
- If suggesting a swap or change, explain WHY based on their taste axes.
- If they ask about something not in their itinerary, suggest something that matches their profile.
- Be honest about mismatches — "That's a 62% match for you because..."
- Never be generic. Every response should feel like it comes from someone who knows them.

COMMON REQUEST PATTERNS:
- "Rearrange my day" → Suggest specific swaps with timing reasoning
- "Find a late-night spot" → Recommend based on neighborhood + profile
- "What should I skip?" → Be honest about low-match items
- "Suggest something like..." → Match by taste axes, not just category

Return valid JSON only:
{
  "response": "Your concise, specific response with **bold place names**"
}`;

export async function POST(req: NextRequest) {
  try {
    const { userMessage, conversationHistory, tripContext, userProfile } = await req.json();

    const profileSummary = userProfile
      ? `USER'S TASTE PROFILE:
- Archetype: ${userProfile.overallArchetype}
- Key axes: ${(userProfile.radarData || []).map((r: { axis: string; value: number }) => `${r.axis}: ${Math.round(r.value * 100)}%`).join(', ')}
- Signals: ${Object.entries(userProfile.microTasteSignals || {}).map(([domain, signals]) => `${domain}: ${(signals as string[]).slice(0, 2).join(', ')}`).join(' | ')}
- Contradictions: ${(userProfile.contradictions || []).map((c: { stated: string; revealed: string }) => `${c.stated} vs ${c.revealed}`).join('; ') || 'None'}`
      : 'No taste profile available.';

    // Format the current day's itinerary
    const dayInfo = tripContext?.currentDay
      ? `CURRENT TRIP: ${tripContext.name || 'Untitled'}
Day ${tripContext.currentDay.dayNumber}/${tripContext.totalDays} in ${tripContext.currentDay.destination || tripContext.destinations?.[0] || 'unknown'}

TODAY'S ITINERARY:
${(tripContext.currentDay.slots || []).map((slot: { label: string; place?: { name: string; type?: string; matchScore?: number } }) =>
  `- ${slot.label}: ${slot.place ? `${slot.place.name}${slot.place.matchScore ? ` (${slot.place.matchScore}% match)` : ''}` : '(empty)'}`
).join('\n')}
${tripContext.currentDay.hotel ? `- Hotel: ${tripContext.currentDay.hotel}` : ''}`
      : `TRIP: ${tripContext?.name || 'Untitled'} — ${tripContext?.destinations?.join(', ') || 'Unknown destination'}`;

    const contextMessage = `${profileSummary}

${dayInfo}

CONVERSATION HISTORY:
${(conversationHistory || []).slice(-6).map((m: { role: string; content: string }) => `${m.role === 'user' ? 'User' : 'Terrazzo'}: ${m.content}`).join('\n')}

User's message: "${userMessage}"

Return valid JSON only.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      system: [{ type: 'text', text: CHAT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: contextMessage }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ response: "Let me think about that — could you rephrase?" });
    }

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Trip chat error:', error);
    return NextResponse.json({
      response: "Having trouble connecting right now — try again in a moment.",
    });
  }
}
