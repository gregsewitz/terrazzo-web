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
 * Pre-resolve matched properties via Google Places API and attach googlePlaceIds.
 * Also triggers enrichment pipeline as a side effect so data is ready when users click.
 * Runs before response so the client gets usable googlePlaceIds immediately.
 */
async function resolveMatchedProperties(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties: Array<{ name: string; location: string; googlePlaceId?: string; [key: string]: any }>,
  userId: string | null,
) {
  const results = await Promise.allSettled(
    properties.map(async (prop) => {
      const query = prop.location ? `${prop.name}, ${prop.location}` : prop.name;
      const googleResult = await searchPlace(query);
      if (!googleResult) return null;

      const googlePlaceId = googleResult.id;
      prop.googlePlaceId = googlePlaceId;

      // Fire-and-forget enrichment (non-blocking)
      if (userId) {
        const resolvedName = googleResult.displayName?.text || prop.name;
        ensureEnrichment(googlePlaceId, resolvedName, userId, 'onboarding_synthesis').catch(() => {});
      }
      return googlePlaceId;
    })
  );

  const resolved = results.filter(r => r.status === 'fulfilled' && r.value).length;
  const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value)).length;
  if (failed > 0) {
    console.warn(`[synthesis-resolve] ${resolved}/${properties.length} matched properties resolved, ${failed} failed`);
  } else {
    console.log(`[synthesis-resolve] All ${resolved} matched properties resolved`);
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

    // Separate sustainability signals if present
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sustainabilitySignals = (signals as any[]).filter((s) => s.cat === 'Sustainability');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tasteSignals = (signals as any[]).filter((s) => s.cat !== 'Sustainability');

    const contextMessage = `
Synthesize a complete taste profile from the following onboarding data.

TASTE SIGNALS (${tasteSignals.length} total across 8 dimensions):
${JSON.stringify(tasteSignals, null, 2)}

SUSTAINABILITY SIGNALS (${sustainabilitySignals.length} total):
${JSON.stringify(sustainabilitySignals, null, 2)}

KEY CONVERSATION HIGHLIGHTS:
${messages.filter((m: { role: string }) => m.role === 'user').slice(0, 12).map((m: { text: string }) => `- "${m.text}"`).join('\n')}

DETECTED CONTRADICTIONS:
${JSON.stringify(contradictions, null, 2)}

FINAL CERTAINTIES (8 dimensions):
${JSON.stringify(certainties)}

IMPORTANT: Generate the profile using all 8 taste dimensions (Design, Character, Service, Food, Location, Wellness, Rhythm, CulturalEngagement) plus sustainability. Include radarData with 8 axes. Classify the user into one of the 7 emotional driver archetypes. Include sustainabilityProfile and tasteTrajectory in your response.

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

    // Pre-resolve matched properties: attach googlePlaceIds before responding
    // so the client can link directly to place detail pages.
    const matchedProps = profile.matchedProperties || [];
    if (matchedProps.length > 0) {
      try {
        await resolveMatchedProperties(matchedProps, user?.id || null);
      } catch (err) {
        console.error('[synthesis-resolve] Pre-resolution failed (non-blocking):', err);
      }
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Profile synthesis error:', error);
    return NextResponse.json({ error: 'Synthesis failed' }, { status: 500 });
  }
}
