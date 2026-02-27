import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { authHandler } from '@/lib/api-auth-handler';
import { searchPlace } from '@/lib/places';
import { ensureEnrichment } from '@/lib/ensure-enrichment';
import type { User } from '@prisma/client';

const anthropic = new Anthropic();

/**
 * Continuation prompt for generating NEW feed sections that differ from the initial load.
 * Each page index generates a different combination of section types so the feed
 * feels editorially fresh rather than repetitive.
 */
const PAGE_CONFIGS: Record<number, { sections: string; instructions: string }> = {
  1: {
    sections: 'signalThread, moodBoards, weeklyCollection',
    instructions: `Generate:
- 1 signalThread: Pick a DIFFERENT signal than what's been used. Show how it connects 3 completely different place types (e.g., a bookshop, a bathhouse, a rooftop bar).
- 2 moodBoards: New moods — think "When you need to be anonymous" or "When the city owes you a sunset". 3 places each.
- 1 weeklyCollection: A thematic grouping with a compelling editorial title (not generic). 5 places.`,
  },
  2: {
    sections: 'tasteTension, becauseYouCards, deepMatch',
    instructions: `Generate:
- 1 tasteTension: Find a DIFFERENT contradiction in their profile. Go deeper psychologically — why do they hold both preferences at once?
- 3 becauseYouCards: New signals, new places. Pick signals from domains not yet explored.
- 1 deepMatch: A different property than before, with a full signal breakdown. This should feel like discovering a soulmate hotel/restaurant.`,
  },
  3: {
    sections: 'signalThread, contextRecs, weeklyCollection, stretchPick',
    instructions: `Generate:
- 1 signalThread: Pick their most subtle, unexpected signal. Thread it through 3 places that would surprise them.
- 3 contextRecs: Match their current context (season/companion) but with places in regions they might not have considered.
- 1 weeklyCollection: Theme it around a specific city or region that would resonate with their profile. 5 places.
- 1 stretchPick: A place that deliberately breaks one of their stated preferences but might expand their taste vocabulary.`,
  },
  4: {
    sections: 'moodBoards, becauseYouCards, tasteTension',
    instructions: `Generate:
- 2 moodBoards: Explore nighttime/evening moods — "When the lobby bar is your living room" or "When silence is the amenity". 3 places each.
- 3 becauseYouCards: Focus on their most niche, specific signals. Pair them with lesser-known places that true insiders would know.
- 1 tasteTension: Explore how their taste changes based on context — what they want traveling solo vs. with others, or summer vs. winter.`,
  },
  5: {
    sections: 'deepMatch, signalThread, weeklyCollection',
    instructions: `Generate:
- 1 deepMatch: Their dream neighborhood — not a hotel, but a place to live for a month. Full signal breakdown.
- 1 signalThread: Thread their food/drink signals across 3 very different dining experiences.
- 1 weeklyCollection: "If You Loved X, Try Y" — 5 places that share DNA with places they've already saved or rated highly. Title should reference a specific place type or signal.`,
  },
};

const CONTINUATION_SYSTEM_PROMPT = `You are Terrazzo's editorial intelligence — a deeply tasteful, well-traveled curator who writes like the best travel magazines but thinks like a data scientist.

You are generating CONTINUATION content for a user's discover feed. They've already seen the initial feed and are scrolling for more. The content must feel fresh — new signals, new places, new angles.

CRITICAL: You must AVOID recommending any places from the "already shown" list. Every place must be new.

Return valid JSON with ONLY the requested section types. Use the exact same JSON structure as the main feed for each section type:

signalThread: { signal, domain, thread, places: [{ name, location, type, connection, score }] }
becauseYouCards: [{ signal, signalDomain, place, location, score, why, bg }]
tasteTension: { title, stated, revealed, editorial, resolvedBy: { name, location, how } }
weeklyCollection: { title, subtitle, places: [{ name, location, score, signals, signalDomain, note }] }
moodBoards: [{ mood, description, color, places: [{ name, location, vibe, score }] }]
deepMatch: { name, location, score, headline, signalBreakdown: [{ signal, domain, strength, note }], tensionResolved }
stretchPick: { name, location, score, type, strongAxis, strongScore, weakAxis, weakScore, why, tension }
contextRecs: [{ name, location, score, whyFits }]

RULES:
- Use REAL places that exist. Hotels, restaurants, cafes well-known in the design/boutique world.
- Scores reflect genuine alignment with the profile.
- bg colors: dark, muted earth tones: #2d3a2d, #3a2d2d, #2d2d3a, #3a3a2d, #2d3a3a.
- moodBoard colors: muted, editorial: #4a6b8b, #8b4a4a, #6b6b4a, #4a6741, #8b6b4a.
- Every explanation must reference SPECIFIC profile signals, not generic praise.
- Write like a well-traveled friend with perfect recall. Warm, specific, editorial — never promotional.
- Return ONLY the JSON object, nothing else.`;

// Reuse the same place extraction/resolution/attachment logic from the main route

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPlaces(feed: any): Array<{ name: string; location: string }> {
  const seen = new Set<string>();
  const places: Array<{ name: string; location: string }> = [];

  function add(name?: string, location?: string) {
    if (!name) return;
    const key = `${name}||${location || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    places.push({ name, location: location || '' });
  }

  for (const card of feed.becauseYouCards || []) add(card.place, card.location);
  for (const p of feed.signalThread?.places || []) add(p.name, p.location);
  add(feed.tasteTension?.resolvedBy?.name, feed.tasteTension?.resolvedBy?.location);
  for (const p of feed.weeklyCollection?.places || []) add(p.name, p.location);
  for (const board of feed.moodBoards || []) {
    for (const p of board.places || []) add(p.name, p.location);
  }
  add(feed.deepMatch?.name, feed.deepMatch?.location);
  add(feed.stretchPick?.name, feed.stretchPick?.location);
  for (const rec of feed.contextRecs || []) add(rec.name, rec.location);

  return places;
}

async function resolveAllPlaces(
  places: Array<{ name: string; location: string }>,
  userId: string,
): Promise<Map<string, string>> {
  const placeIdMap = new Map<string, string>();

  const settled = await Promise.allSettled(
    places.map(async ({ name, location }) => {
      const query = location ? `${name}, ${location}` : name;
      const googleResult = await searchPlace(query);
      if (!googleResult) return { name, location, googlePlaceId: undefined };

      const googlePlaceId = googleResult.id;
      const resolvedName = googleResult.displayName?.text || name;

      // Fire-and-forget enrichment
      ensureEnrichment(googlePlaceId, resolvedName, userId).catch(() => {});

      return { name, location, googlePlaceId };
    }),
  );

  let resolved = 0;
  let failed = 0;
  for (const result of settled) {
    if (result.status === 'fulfilled' && result.value.googlePlaceId) {
      const { name, location, googlePlaceId } = result.value;
      placeIdMap.set(`${name}||${location}`, googlePlaceId);
      resolved++;
    } else {
      failed++;
    }
  }

  console.log(`[discover-more] ${resolved}/${places.length} places resolved${failed > 0 ? `, ${failed} failed` : ''}`);
  return placeIdMap;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function attachPlaceIds(feed: any, placeIdMap: Map<string, string>): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function attach(obj: any) {
    if (!obj) return;
    const name = obj.name || obj.place;
    if (!name) return;
    const id = placeIdMap.get(`${name}||${obj.location || ''}`);
    if (id) obj.googlePlaceId = id;
  }

  for (const card of feed.becauseYouCards || []) attach(card);
  for (const p of feed.signalThread?.places || []) attach(p);
  attach(feed.tasteTension?.resolvedBy);
  for (const p of feed.weeklyCollection?.places || []) attach(p);
  for (const board of feed.moodBoards || []) {
    for (const p of board.places || []) attach(p);
  }
  attach(feed.deepMatch);
  attach(feed.stretchPick);
  for (const rec of feed.contextRecs || []) attach(rec);
}

export const POST = authHandler(async (req: NextRequest, _ctx, user: User) => {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip + ':ai-more', { maxRequests: 10, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  try {
    const body = await req.json();
    const { userProfile, lifeContext, pageIndex, excludePlaces } = body;

    if (!userProfile || typeof pageIndex !== 'number') {
      return NextResponse.json({ error: 'Missing userProfile or pageIndex' }, { status: 400 });
    }

    // Clamp page index to available configs (1-5)
    const configIndex = Math.min(Math.max(pageIndex, 1), 5);
    const pageConfig = PAGE_CONFIGS[configIndex];

    const month = new Date().getMonth();
    const season = month >= 4 && month <= 9 ? 'Summer' : 'Winter';
    const companion = lifeContext?.primaryCompanions?.[0] || 'solo';
    const contextLabel = companion !== 'solo' ? `With ${companion}` : season;

    const excludeList = Array.isArray(excludePlaces) && excludePlaces.length > 0
      ? `\n\nALREADY SHOWN PLACES (do NOT repeat any of these):\n${excludePlaces.join('\n')}`
      : '';

    const contextMessage = `
USER'S TASTE PROFILE:
- Archetype: ${userProfile.overallArchetype}
- Description: ${userProfile.archetypeDescription || ''}
- Emotional driver: ${userProfile.emotionalDriver?.primary || 'Unknown'} / ${userProfile.emotionalDriver?.secondary || 'Unknown'}

MICRO-SIGNALS BY DOMAIN:
${Object.entries(userProfile.microTasteSignals || {}).map(([domain, signals]) => `${domain}: ${(signals as string[]).join(', ')}`).join('\n')}

RADAR AXES:
${(userProfile.radarData || []).map((r: { axis: string; value: number }) => `${r.axis}: ${Math.round(r.value * 100)}%`).join(', ')}

CONTRADICTIONS:
${(userProfile.contradictions || []).map((c: { stated: string; revealed: string; resolution: string }) => `${c.stated} vs ${c.revealed} → ${c.resolution}`).join('\n') || 'None identified'}

CONTEXT MODIFIERS:
${(userProfile.contextModifiers || []).map((m: { context: string; shifts: string[] }) => `${m.context}: ${(m.shifts || []).join(', ')}`).join('\n') || 'None'}

LIFE CONTEXT:
- Primary companion: ${companion}
- Current season: ${season}
- Context label: "${contextLabel}"
${excludeList}

GENERATE THESE SECTIONS ONLY: ${pageConfig.sections}

${pageConfig.instructions}

Return valid JSON only.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: [{ type: 'text', text: CONTINUATION_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: contextMessage }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse continuation content' }, { status: 500 });
    }

    const result = JSON.parse(jsonMatch[0]);

    // Resolve and enrich all places in this batch
    const places = extractPlaces(result);
    if (places.length > 0) {
      try {
        const placeIdMap = await resolveAllPlaces(places, user.id);
        attachPlaceIds(result, placeIdMap);
      } catch (err) {
        console.error('[discover-more] Pre-resolution failed (non-blocking):', err);
      }
    }

    // Attach contextLabel so frontend can render context sections
    result.contextLabel = contextLabel;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Discover continuation error:', error);
    return NextResponse.json({ error: 'Failed to generate continuation content' }, { status: 500 });
  }
});
