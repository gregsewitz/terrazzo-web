/**
 * POST /api/profile/discover/more
 *
 * Continuation endpoint for infinite scroll on the discover feed.
 * RAG-grounded (primary) with legacy LLM-only fallback.
 *
 * Each page uses a different editorial template (15 configs, cycling).
 * RAG path pulls from scored PI candidates excluding already-shown places.
 * Fresh pick slots allow Claude to suggest 2-3 new real places per page
 * that aren't in our database yet — these get resolved + enriched immediately.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { authHandler } from '@/lib/api-auth-handler';
import { CLAUDE_SONNET } from '@/lib/models';
import { searchPlace, mapGoogleTypeToPlaceType } from '@/lib/places';
import { ensureEnrichment } from '@/lib/ensure-enrichment';
import type { User } from '@prisma/client';
import type {
  GeneratedTasteProfile,
  OnboardingLifeContext,
  TasteProfile,
  TasteDomain,
  TasteContradiction,
} from '@/types';
import { ALL_TASTE_DOMAINS } from '@/types';
import {
  fetchCandidateProperties,
  scoreWithVectors,
  scoreAllCandidates,
} from '@/lib/discover-candidates';
import {
  hasEnoughCandidates,
  allocateMoreSlots,
} from '@/lib/discover-allocation';
import {
  generateMoreEditorialCopy,
  type MorePageConfig,
} from '@/lib/discover-editorial';
import {
  extractAllFeedPlaces,
  triggerEnrichmentBatch,
} from '../route';

const anthropic = new Anthropic();

// v3.2: Default user profile for when radarData is missing
const DEFAULT_USER_PROFILE: TasteProfile = {
  Design: 0.85,
  Atmosphere: 0.75,
  Character: 0.8,
  Service: 0.6,
  FoodDrink: 0.75,
  Geography: 0.7,
  Wellness: 0.4,
  Sustainability: 0.3,
};

// ─── Page Configs (15 templates, cycling) ─────────────────────────────────────

const PAGE_CONFIGS: MorePageConfig[] = [
  // 1: Fresh signal thread + moods + collection
  {
    sections: ['signalThread', 'moodBoards', 'weeklyCollection'],
    freshPickSlots: 2,
    instructions: `Generate a fresh signal thread: pick a DIFFERENT signal than what's been used. Show how it connects 3 completely different place types (e.g., a bookshop, a bathhouse, a rooftop bar).
2 moodBoards: New moods — think "When you need to be anonymous" or "When the city owes you a sunset". 3 places each.
1 weeklyCollection: A thematic grouping with a compelling editorial title (not generic). 5 places.`,
  },
  // 2: Tension + because you + deep match
  {
    sections: ['tasteTension', 'becauseYouCards', 'deepMatch'],
    freshPickSlots: 2,
    instructions: `Find a DIFFERENT contradiction in their profile. Go deeper psychologically — why do they hold both preferences at once?
3 becauseYouCards: New signals, new places. Pick signals from domains not yet explored.
1 deepMatch: A different property than before, with a full signal breakdown. This should feel like discovering a soulmate hotel/restaurant.`,
  },
  // 3: Signal thread + context + collection + stretch
  {
    sections: ['signalThread', 'contextRecs', 'weeklyCollection', 'stretchPick'],
    freshPickSlots: 2,
    instructions: `Pick their most subtle, unexpected signal. Thread it through 3 places that would surprise them.
3 contextRecs: Match their current context (season/companion) but in regions they might not have considered.
1 weeklyCollection: Theme around a specific city or region resonating with their profile. 5 places.
1 stretchPick: A place that deliberately breaks one stated preference but might expand their taste.`,
  },
  // 4: Evening moods + niche picks + tension
  {
    sections: ['moodBoards', 'becauseYouCards', 'tasteTension'],
    freshPickSlots: 2,
    instructions: `2 moodBoards: Explore nighttime/evening moods — "When the lobby bar is your living room" or "When silence is the amenity". 3 places each.
3 becauseYouCards: Focus on their most niche, specific signals. Pair with lesser-known places that true insiders would know.
1 tasteTension: Explore how their taste changes based on context — what they want solo vs. with others, or summer vs. winter.`,
  },
  // 5: Dream neighborhood + food thread + collection
  {
    sections: ['deepMatch', 'signalThread', 'weeklyCollection'],
    freshPickSlots: 2,
    instructions: `1 deepMatch: Their dream neighborhood — not a hotel, but a place to live for a month. Full signal breakdown.
1 signalThread: Thread their food/drink signals across 3 very different dining experiences.
1 weeklyCollection: "If You Loved X, Try Y" — 5 places that share DNA with their profile's strongest signals.`,
  },
  // 6: City Deep Dive
  {
    sections: ['weeklyCollection', 'moodBoards'],
    freshPickSlots: 3,
    instructions: `CITY DEEP DIVE: Pick ONE city that resonates deeply with this user's taste profile.
1 weeklyCollection: 5 places in that city — hotels, restaurants, bars, neighborhoods — all matching their signals. Title should name the city.
2 moodBoards: Different sides of the same city — daytime vs. nighttime, or touristy vs. local. 3 places each.
The fresh picks should be the lesser-known gems in this city.`,
  },
  // 7: Domain Spotlight (expansion)
  {
    sections: ['becauseYouCards', 'signalThread'],
    freshPickSlots: 2,
    instructions: `EXPANSION TERRITORY: Focus on the user's WEAKEST taste domain — the area where they have the least engagement.
3 becauseYouCards: Properties that score high in this underexplored domain. Frame them as doorways into new territory.
1 signalThread: Find a signal from this weak domain that connects to something they DO care about — a bridge between their comfort zone and new ground.`,
  },
  // 8: Seasonal Edit
  {
    sections: ['contextRecs', 'weeklyCollection'],
    freshPickSlots: 3,
    instructions: `SEASONAL EDIT: Curate specifically for the current season and the user's travel companion.
4 contextRecs: Perfect for right now — where they should go THIS season with their usual travel companion.
1 weeklyCollection: A themed collection titled for the season (e.g., "Winter Warmth for the Design-Obsessed" or "Summer Tables Worth the Flight"). 5 places.
Fresh picks should be seasonal gems that only work at this time of year.`,
  },
  // 9: The Anti-List
  {
    sections: ['stretchPick', 'tasteTension', 'becauseYouCards'],
    freshPickSlots: 2,
    instructions: `THE ANTI-LIST: Challenge their taste assumptions.
1 stretchPick: The most provocative pick — somewhere that breaks their usual pattern but has ONE quality they'd find irresistible.
1 tasteTension: The deepest contradiction in their profile — really interrogate why they hold opposing preferences.
3 becauseYouCards: Each one should be a surprise — places that match signals they didn't know they had.`,
  },
  // 10: Neighborhood Guide
  {
    sections: ['weeklyCollection', 'moodBoards'],
    freshPickSlots: 3,
    instructions: `NEIGHBORHOOD GUIDE: Pick a single neighborhood or district that's a perfect fit for this user.
1 weeklyCollection: 5 places all within walking distance in one neighborhood — a hotel, a coffee spot, a restaurant, a bar, a shop. Title should name the neighborhood.
2 moodBoards: The neighborhood at different times — morning ritual vs. evening ritual. 3 places each.
Fresh picks should be the real insider spots in this neighborhood.`,
  },
  // 11: Dining Edit
  {
    sections: ['signalThread', 'becauseYouCards', 'weeklyCollection'],
    freshPickSlots: 3,
    instructions: `THE DINING EDIT: Restaurants, bars, and cafes only — no hotels.
1 signalThread: Thread a food/drink signal across 3 very different dining contexts (a neighborhood bistro, a destination restaurant, a standing-room wine bar).
3 becauseYouCards: Their ideal dining spots — pair specific food/drink signals with restaurants that embody them.
1 weeklyCollection: A themed dining collection (e.g., "Counter Seats for Solitary Lunches" or "Tables Where the Chef Decides"). 5 restaurants/bars.
All fresh picks should be restaurants or bars.`,
  },
  // 12: Design Hotels
  {
    sections: ['deepMatch', 'becauseYouCards', 'weeklyCollection'],
    freshPickSlots: 2,
    instructions: `DESIGN HOTELS EDIT: Hotels and stays only — no restaurants.
1 deepMatch: Their ultimate design hotel — the place where every surface, material, and spatial choice was made for someone exactly like them.
3 becauseYouCards: Hotels where the Design and Atmosphere signals are strongest. Focus on materiality, spatial design, light.
1 weeklyCollection: A themed hotel collection (e.g., "Brutalist Retreats" or "Where the Building IS the Experience"). 5 hotels.`,
  },
  // 13: Off-Radar
  {
    sections: ['stretchPick', 'weeklyCollection', 'moodBoards'],
    freshPickSlots: 3,
    instructions: `OFF THE RADAR: Lesser-known places that match their signals.
1 stretchPick: A place nobody they know has been to — strong on one domain, unknown on others.
1 weeklyCollection: "Places You Haven't Heard Of Yet" — 5 under-the-radar spots with strong signal alignment. Avoid the obvious choices.
2 moodBoards: "When you want to be the only tourist" and "When you want to feel local". 3 places each.
Lean heavily on fresh picks here — these should genuinely be new discoveries.`,
  },
  // 14: Weekend Format
  {
    sections: ['contextRecs', 'moodBoards'],
    freshPickSlots: 2,
    instructions: `48 HOURS IN...: Pick a city and design a weekend for this user.
4 contextRecs: Frame each as a moment in a weekend trip — the arrival hotel, the first dinner, the morning café, the Sunday stroll.
2 moodBoards: "Friday night energy" and "Sunday morning slowness". 3 places each from the same city.
Make it feel like a real itinerary someone could follow.`,
  },
  // 15: Taste Evolution
  {
    sections: ['tasteTension', 'signalThread', 'deepMatch'],
    freshPickSlots: 2,
    instructions: `TASTE EVOLUTION: Explore the nuance and growth in their taste profile.
1 tasteTension: Not just a contradiction — an evolution. Where did their taste come from, and where is it going?
1 signalThread: Their most sophisticated signal — thread it through 3 places that represent increasing levels of that quality.
1 deepMatch: The place that represents their taste at its most evolved — where every signal converges into something greater than the sum.`,
  },
];

// ─── Fresh pick resolution ────────────────────────────────────────────────────

/**
 * Find places in the editorial output that have empty googlePlaceIds (fresh picks from Claude),
 * resolve them via Google Places API, and trigger enrichment.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveFreshPicks(feed: any, userId: string): Promise<void> {
  const freshPicks: Array<{ obj: any; name: string; location: string }> = [];

  // Walk all sections looking for objects with empty googlePlaceId
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function collect(obj: any) {
    if (!obj) return;
    const name = obj.name || obj.place;
    if (!name) return;
    if (!obj.googlePlaceId || obj.googlePlaceId === '') {
      freshPicks.push({ obj, name, location: obj.location || '' });
    }
  }

  for (const card of feed.becauseYouCards || []) collect(card);
  for (const p of feed.signalThread?.places || []) collect(p);
  collect(feed.tasteTension?.resolvedBy);
  for (const p of feed.weeklyCollection?.places || []) collect(p);
  for (const board of feed.moodBoards || []) {
    for (const p of board.places || []) collect(p);
  }
  collect(feed.deepMatch);
  collect(feed.stretchPick);
  for (const rec of feed.contextRecs || []) collect(rec);

  if (freshPicks.length === 0) return;

  console.log(`[discover-more] Resolving ${freshPicks.length} fresh picks from Claude`);

  const results = await Promise.allSettled(
    freshPicks.map(async ({ obj, name, location }) => {
      const query = location ? `${name}, ${location}` : name;
      const googleResult = await searchPlace(query);
      if (!googleResult) return;

      obj.googlePlaceId = googleResult.id;
      const resolvedName = googleResult.displayName?.text || name;
      const placeType = mapGoogleTypeToPlaceType(googleResult.primaryType);
      ensureEnrichment(googleResult.id, resolvedName, userId, 'discover_more_fresh', placeType).catch((err: unknown) => console.warn('[discover/more] ensureEnrichment failed:', err));
    }),
  );

  const resolved = results.filter(r => r.status === 'fulfilled').length;
  console.log(`[discover-more] Fresh picks: ${resolved}/${freshPicks.length} resolved`);
}

// ─── Legacy LLM-only flow (kept for fallback) ────────────────────────────────

const LEGACY_SYSTEM_PROMPT = `You are Terrazzo's editorial intelligence — a deeply tasteful, well-traveled curator who writes like the best travel magazines but thinks like a data scientist.

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
- moodBoard colors: muted, editorial: #4a6b8b, #8b4a4a, #6b6b4a, #4a6741, #413800.
- Every explanation must reference SPECIFIC profile signals, not generic praise.
- Write like a well-traveled friend with perfect recall. Warm, specific, editorial — never promotional.
- Return ONLY the JSON object, nothing else.`;

// Legacy helpers (duplicated from main route for independence)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPlacesLegacy(feed: any): Array<{ name: string; location: string }> {
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
  for (const board of feed.moodBoards || []) { for (const p of board.places || []) add(p.name, p.location); }
  add(feed.deepMatch?.name, feed.deepMatch?.location);
  add(feed.stretchPick?.name, feed.stretchPick?.location);
  for (const rec of feed.contextRecs || []) add(rec.name, rec.location);
  return places;
}

async function resolveAllPlacesLegacy(
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
      const placeType = mapGoogleTypeToPlaceType(googleResult.primaryType);
      ensureEnrichment(googlePlaceId, resolvedName, userId, 'discover_more', placeType).catch((err: unknown) => console.warn('[discover/more] ensureEnrichment failed:', err));
      return { name, location, googlePlaceId };
    }),
  );
  for (const result of settled) {
    if (result.status === 'fulfilled' && result.value.googlePlaceId) {
      const { name, location, googlePlaceId } = result.value;
      placeIdMap.set(`${name}||${location}`, googlePlaceId);
    }
  }
  return placeIdMap;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function attachPlaceIdsLegacy(feed: any, placeIdMap: Map<string, string>): void {
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
  for (const board of feed.moodBoards || []) { for (const p of board.places || []) attach(p); }
  attach(feed.deepMatch);
  attach(feed.stretchPick);
  for (const rec of feed.contextRecs || []) attach(rec);
}

// ─── Route handler ───────────────────────────────────────────────────────────

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

    // Pick config (1-indexed, cycling through 15)
    const configIndex = ((Math.max(pageIndex, 1) - 1) % PAGE_CONFIGS.length);
    const pageConfig = PAGE_CONFIGS[configIndex];
    const excludeSet = new Set<string>(Array.isArray(excludePlaces) ? excludePlaces : []);

    // ─── Try RAG-grounded flow first ──────────────────────────────────
    try {
      const candidates = await fetchCandidateProperties();
      const profile = userProfile as GeneratedTasteProfile;
      const context = lifeContext as OnboardingLifeContext | null;

      // Build TasteProfile from radarData
      const validDomains = new Set<string>(ALL_TASTE_DOMAINS);
      const tasteProfile: TasteProfile = { ...DEFAULT_USER_PROFILE };
      for (const r of profile.radarData || []) {
        if (validDomains.has(r.axis)) {
          tasteProfile[r.axis as TasteDomain] = Math.max(tasteProfile[r.axis as TasteDomain], r.value);
        }
      }

      const userMicroSignals = profile.microTasteSignals || {};
      const userContradictions: TasteContradiction[] = profile.contradictions || [];

      // Score candidates
      const scoringContext = { applyDecay: true };
      let scoredAll;
      const { results, vectorEnabled } = await scoreWithVectors(
        user.id,
        candidates,
        tasteProfile,
        userMicroSignals,
        userContradictions,
        scoringContext,
      );
      scoredAll = results;

      if (vectorEnabled) {
        console.log(`[discover-more] Using vector-enhanced scoring`);
      }

      // Filter out already-shown places
      const scored = scoredAll.filter(c => !excludeSet.has(c.googlePlaceId) && !excludeSet.has(c.propertyName));

      console.log(`[discover-more] ${scored.length} candidates remaining after excluding ${excludeSet.size} shown places`);

      if (hasEnoughCandidates(scored.length)) {
        // Allocate into the sections requested by this page config
        const allocated = allocateMoreSlots(
          scored,
          pageConfig.sections,
          userMicroSignals,
          userContradictions,
          context,
        );

        // Generate editorial copy
        const editorialFeed = await generateMoreEditorialCopy(
          allocated,
          pageConfig,
          profile,
          context,
          Array.from(excludeSet),
        );

        // Resolve fresh picks (places with empty googlePlaceId)
        await resolveFreshPicks(editorialFeed, user.id);

        // Defensive enrichment for all places
        triggerEnrichmentBatch(extractAllFeedPlaces(editorialFeed), user.id, 'discover_more_rag').catch((err: unknown) => console.warn('[discover/more] triggerEnrichmentBatch failed:', err));

        // Attach context label
        const month = new Date().getMonth();
        const season = month >= 4 && month <= 9 ? 'Summer' : 'Winter';
        const companion = context?.primaryCompanions?.[0] || 'solo';
        (editorialFeed as any).contextLabel = companion !== 'solo' ? `With ${companion}` : season;

        console.log(`[discover-more] RAG page ${pageIndex} (config ${configIndex + 1}: ${pageConfig.sections.join(', ')}) generated`);
        return NextResponse.json(editorialFeed);
      }

      console.log(`[discover-more] Not enough candidates for RAG (${scored.length}), falling back to legacy`);
    } catch (ragError) {
      console.error('[discover-more] RAG flow failed, falling back to legacy:', ragError);
    }

    // ─── Legacy fallback ──────────────────────────────────────────────
    const month = new Date().getMonth();
    const season = month >= 4 && month <= 9 ? 'Summer' : 'Winter';
    const companion = lifeContext?.primaryCompanions?.[0] || 'solo';
    const contextLabel = companion !== 'solo' ? `With ${companion}` : season;

    const excludeList = excludeSet.size > 0
      ? `\n\nALREADY SHOWN PLACES (do NOT repeat any of these):\n${Array.from(excludeSet).slice(0, 50).join('\n')}`
      : '';

    const legacySections = pageConfig.sections.join(', ');
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

LIFE CONTEXT:
- Primary companion: ${companion}
- Current season: ${season}
- Context label: "${contextLabel}"
${excludeList}

GENERATE THESE SECTIONS ONLY: ${legacySections}

${pageConfig.instructions}

Return valid JSON only.`;

    const response = await anthropic.messages.create({
      model: CLAUDE_SONNET,
      max_tokens: 4096,
      system: [{ type: 'text', text: LEGACY_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: contextMessage }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse continuation content' }, { status: 500 });
    }

    const result = JSON.parse(jsonMatch[0]);

    // Resolve and enrich all places
    const places = extractPlacesLegacy(result);
    if (places.length > 0) {
      try {
        const placeIdMap = await resolveAllPlacesLegacy(places, user.id);
        attachPlaceIdsLegacy(result, placeIdMap);
      } catch (err) {
        console.error('[discover-more] Legacy resolution failed (non-blocking):', err);
      }
    }

    result.contextLabel = contextLabel;
    return NextResponse.json(result);
  } catch (error) {
    console.error('Discover continuation error:', error);
    return NextResponse.json({ error: 'Failed to generate continuation content' }, { status: 500 });
  }
});
