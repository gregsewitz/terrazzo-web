import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { validateBody, onboardingSynthesizeSchema } from '@/lib/api-validation';
import { getUser } from '@/lib/supabase-server';
import { searchPlace } from '@/lib/places';
import { ensureEnrichment } from '@/lib/ensure-enrichment';
import { PROFILE_SYNTHESIS_PROMPT } from '@/constants/onboarding';

const anthropic = new Anthropic();

/**
 * Fire-and-forget: resolve each matched property via Google Places API
 * and trigger the enrichment pipeline so data is ready when users click.
 */
async function enrichMatchedProperties(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties: Array<{ name: string; location: string; [key: string]: any }>,
  userId: string,
) {
  const results: Array<{ name: string; googlePlaceId?: string; intelligenceId?: string | null; error?: string }> = [];

  for (const prop of properties) {
    try {
      const query = prop.location ? `${prop.name} ${prop.location}` : prop.name;
      const googleResult = await searchPlace(query);
      if (!googleResult) {
        results.push({ name: prop.name, error: 'Not found on Google Places' });
        continue;
      }
      const googlePlaceId = googleResult.id;
      const resolvedName = googleResult.displayName?.text || prop.name;
      const intelligenceId = await ensureEnrichment(googlePlaceId, resolvedName, userId, 'onboarding_synthesis');
      results.push({ name: prop.name, googlePlaceId, intelligenceId });
    } catch (err) {
      results.push({ name: prop.name, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  const enriched = results.filter(r => r.intelligenceId);
  const failed = results.filter(r => r.error);
  if (failed.length > 0) {
    console.warn(`[synthesis-enrichment] ${enriched.length}/${results.length} matched properties enriched, ${failed.length} failed:`,
      failed.map(f => `${f.name}: ${f.error}`));
  } else {
    console.log(`[synthesis-enrichment] All ${enriched.length} matched properties resolved and enrichment triggered`);
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip + ':ai', { maxRequests: 10, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  // Optional auth — onboarding happens before sign-in, but re-synthesis
  // from the profile page sends a token. Use it for enrichment if available.
  const user = await getUser(req).catch(() => null);

  try {
    const validation = await validateBody(req, onboardingSynthesizeSchema);
    if ('error' in validation) {
      return validation.error;
    }
    const { signals, contradictions, certainties } = validation.data;
    // messages is a loosely-typed array from the client — cast for template access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages = validation.data.messages as any[];

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

    // Fire-and-forget: resolve matched properties + trigger enrichment pipeline
    // Only runs when authenticated (re-synthesis from profile page, not initial onboarding)
    if (user) {
      const matchedProps = profile.matchedProperties || [];
      if (matchedProps.length > 0) {
        enrichMatchedProperties(matchedProps, user.id).catch(err =>
          console.error('[synthesis-enrichment] Background enrichment failed:', err)
        );
      }
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Profile synthesis error:', error);
    return NextResponse.json({ error: 'Synthesis failed' }, { status: 500 });
  }
}
