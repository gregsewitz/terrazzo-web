import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { validateBody, onboardingSynthesizeSchema } from '@/lib/api-validation';
import { PROFILE_SYNTHESIS_PROMPT } from '@/constants/onboarding';

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip + ':ai', { maxRequests: 10, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  try {
    const validation = await validateBody(req, onboardingSynthesizeSchema);
    if ('error' in validation) {
      return validation.error;
    }
    const { signals, messages, contradictions, certainties } = validation.data;

    const contextMessage = `
Synthesize a complete taste profile from the following onboarding data:

SIGNALS (${signals.length} total):
${JSON.stringify(signals, null, 2)}

KEY CONVERSATION HIGHLIGHTS:
${messages.filter((m: { role: string }) => m.role === 'user').slice(0, 12).map((m: { text: string }) => `- "${m.text}"`).join('\n')}

DETECTED CONTRADICTIONS:
${JSON.stringify(contradictions, null, 2)}

FINAL CERTAINTIES:
${JSON.stringify(certainties)}

Return valid JSON only matching the specified schema.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: [{ type: 'text', text: PROFILE_SYNTHESIS_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: contextMessage }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to synthesize profile' }, { status: 500 });
    }

    const profile = JSON.parse(jsonMatch[0]);
    return NextResponse.json(profile);
  } catch (error) {
    console.error('Profile synthesis error:', error);
    return NextResponse.json({ error: 'Synthesis failed' }, { status: 500 });
  }
}
