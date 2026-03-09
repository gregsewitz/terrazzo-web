import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { validateBody, onboardingSynthesizeSchema } from '@/lib/api-validation';
import { getUser } from '@/lib/supabase-server';
import { searchPlace, mapGoogleTypeToPlaceType } from '@/lib/places';
import { ensureEnrichment } from '@/lib/ensure-enrichment';

const anthropic = new Anthropic();

// ─── Shared context builder ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSignalContext(tasteSignals: any[], sustainabilitySignals: any[], messages: any[], contradictions: any, certainties: any) {
  return `
TASTE SIGNALS (${tasteSignals.length} total across 6 taste domains + 2 preference dimensions):
${JSON.stringify(tasteSignals, null, 2)}

SUSTAINABILITY SIGNALS (${sustainabilitySignals.length} total):
${JSON.stringify(sustainabilitySignals, null, 2)}

KEY CONVERSATION HIGHLIGHTS:
${messages.filter((m: { role: string }) => m.role === 'user').slice(0, 12).map((m: { text: string }) => `- "${m.text}"`).join('\n')}

DETECTED CONTRADICTIONS:
${JSON.stringify(contradictions, null, 2)}

FINAL CERTAINTIES (6 taste domains + 2 preference dimensions):
${JSON.stringify(certainties)}`;
}

// ─── Chunk 1: Core Profile ───
const CORE_SYSTEM = `You are synthesizing the CORE ANALYTICAL section of a Terrazzo taste profile.

THE 6 TASTE DOMAINS: Design, Atmosphere, Character, Service, FoodDrink, Setting
THE 2 PREFERENCE DIMENSIONS: Wellness, Sustainability

EMOTIONAL DRIVER ARCHETYPES — classify the user into ONE primary:
- AESTHETIC_PILGRIM: Travels to expand their sense of what's possible in design, food, beauty
- CONTROL_ARCHITECT: Needs to shape the experience — researches, plans, curates every detail
- STORY_COLLECTOR: Seeks narrative and connection — every trip becomes a story to tell
- SENSORY_HEDONIST: Driven by physical pleasure — texture, taste, temperature, light
- TRANSFORMATION_SEEKER: Uses travel as catalyst for personal change or growth
- MASTERY_SEEKER: Wants to go deep — learn to cook, understand wine regions, master surf breaks
- LEGACY_BUILDER: Creates experiences for family/loved ones — travel as shared memory

Generate a JSON object with ONLY these fields:
{
  "overallArchetype": "2-3 word evocative name (e.g., 'The Aesthetic Pilgrim', 'The Sensory Archaeologist')",
  "archetypeDescription": "2-3 sentences, editorial voice, specific to this person",
  "emotionalDriver": {
    "primary": "Main driver archetype (one of the 7 above)",
    "description": "1-2 sentences explaining why this fits",
    "secondary": "Secondary archetype"
  },
  "contradictions": [2-4 core tensions with "stated", "revealed", "resolution", "matchRule"],
  "contextModifiers": [4-6 situational shifts with "context" and "shifts"],
  "microTasteSignals": { "category_name": ["term1", "term2", ...] } (6-8 categories, 4-6 terms each),
  "radarData": [{ "axis": "Design|Atmosphere|Character|Service|FoodDrink|Setting|Wellness|Sustainability", "value": 0.0-1.0 }],
  "sustainabilityProfile": {
    "sensitivity": "LEADING | CONSCIOUS | PASSIVE | INDIFFERENT",
    "priorities": ["top sustainability priorities"],
    "dealbreakers": ["sustainability dealbreakers if any"],
    "willingnessToPayPremium": 0.0-1.0
  },
  "tasteTrajectory": {
    "direction": "REFINING | EXPANDING | SHIFTING | STABLE",
    "description": "1 sentence on how their taste is evolving"
  },
  "profileVersion": 2
}

RULES:
- Archetype name must feel personal, not generic. Never "The Luxury Traveler."
- Contradictions must have actionable matchRules that a scoring algorithm can use.
- Micro-taste signals should include both positive and rejection signals.
- radarData must have exactly 8 axes matching the domains above.
- Return valid JSON only.`;

// ─── Chunk 2: Narrative & Editorial ───
const NARRATIVE_SYSTEM = `You are writing the EDITORIAL NARRATIVE sections of a Terrazzo taste profile. Write like a well-traveled friend — warm, specific, never clinical.

Generate a JSON object with ONLY these fields:
{
  "bestQuote": {
    "quote": "A real line the user said during onboarding — the moment that revealed the most about their taste. Choose for emotional resonance, not information. Pick a moment where they described a FEELING or SCENE.",
    "insight": "One sentence: what this quote revealed about them. Warm, knowing, never condescending."
  },
  "designInsight": {
    "headline": "A short sentence about how they see space (e.g., 'You read a room before you feel it.')",
    "annotations": [
      { "axis": "volume", "label": ["Minimal", "Maximal"], "note": "Observation about visual density." },
      { "axis": "temperature", "label": ["Cool & Composed", "Warm & Rich"], "note": "Material/color warmth." },
      { "axis": "time", "label": ["Contemporary", "Historic & Layered"], "note": "Temporal aesthetic." },
      { "axis": "formality", "label": ["Raw & Natural", "Polished & Sleek"], "note": "Material finish." },
      { "axis": "culture", "label": ["International", "Deeply Local"], "note": "Design provenance." },
      { "axis": "mood", "label": ["Serene", "Energetic"], "note": "Light and energy." }
    ]
  },
  "perfectDay": {
    "morning": "2-3 sentences. Sensory, specific. What their ideal morning looks like, drawn from their signals.",
    "afternoon": "2-3 sentences. Their natural pace, what draws them.",
    "evening": "2-3 sentences. Dining, social energy, what a great evening feels like."
  },
  "howYouShift": [
    { "context": "With [partner name if mentioned]", "insight": "1-2 sentences on companion shifts." },
    { "context": "Solo", "insight": "1-2 sentences on solo travel identity." },
    { "context": "With friends", "insight": "1-2 sentences on group dynamics." }
  ],
  "tasteNeighbors": {
    "nearbyArchetypes": ["2-3 archetype names they share overlap with"],
    "distinction": "1 sentence on what makes them different.",
    "rarityStat": "A specific stat about their signal combination rarity."
  },
  "destinations": {
    "familiar": ["2-3 destination regions they'd expect to love — NOT places they've already been"],
    "surprise": {
      "name": "One unexpected destination — NOT somewhere they've visited",
      "reason": "One line explaining WHY."
    }
  }
}

RULES:
- bestQuote must be a REAL quote pulled verbatim from the conversation highlights. Do not fabricate.
- designInsight annotations should reference specific things the user said.
- perfectDay should feel like a lived experience, not a data summary. Use sensory language.
- howYouShift should use the partner's actual name if it appears in the conversation.
- CRITICAL: Never recommend places the user has already visited or mentioned visiting.
- destinations.surprise must be a real, lesser-known place — not a generic bucket-list destination.
- Return valid JSON only.`;

// ─── Chunk 3: Matched Properties ───
const PROPERTIES_SYSTEM = `You are recommending 5 real properties (hotels, restaurants, bars, etc.) that match a user's taste profile.

Generate a JSON object with ONLY this field:
{
  "matchedProperties": [
    {
      "name": "Real property name",
      "location": "City, Country",
      "score": 0.0-1.0,
      "matchReasons": ["2-3 specific reasons this matches their taste signals"],
      "tensionResolved": "Which contradiction this property navigates (if any)",
      "atmosphereNote": "1 sentence editorial note about the atmosphere",
      "sustainabilityScore": 0.0-1.0
    }
  ]
}

RULES:
- All 5 properties must be REAL places that actually exist.
- CRITICAL: Never recommend places the user has already visited. If they mention staying at or visiting a specific hotel, restaurant, or destination during the conversation, do NOT include it. Use places they've been as EVIDENCE of their taste, not as recommendations.
- matchReasons should reference specific taste signals, not generic praise.
- Include a mix of property types (hotels, restaurants, experiences) if signals support it.
- Return valid JSON only.`;

// ─── Helper: call Claude and parse JSON ───
async function callAndParse(
  system: string,
  userMessage: string,
  maxTokens: number,
  label: string,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  const t0 = Date.now();
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const elapsed = Date.now() - t0;

  if (response.stop_reason === 'max_tokens') {
    console.error(`[synthesis:${label}] Truncated by max_tokens after ${elapsed}ms`);
  } else {
    console.log(`[synthesis:${label}] Completed in ${elapsed}ms (${text.length} chars)`);
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error(`[synthesis:${label}] No JSON found in response`);
    return {};
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error(`[synthesis:${label}] JSON parse failed:`, (err as Error).message);
    return {};
  }
}

/**
 * Pre-resolve matched properties via Google Places API and attach googlePlaceIds.
 * Also triggers enrichment pipeline as a side effect so data is ready when users click.
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
        const placeType = mapGoogleTypeToPlaceType(googleResult.primaryType);
        ensureEnrichment(googlePlaceId, resolvedName, userId, 'onboarding_synthesis', placeType).catch(() => {});
      }
      return googlePlaceId;
    })
  );

  const resolved = results.filter(r => r.status === 'fulfilled' && r.value).length;
  const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value)).length;
  if (failed > 0) {
    console.warn(`[synthesis-resolve] ${resolved}/${properties.length} resolved, ${failed} failed`);
  } else {
    console.log(`[synthesis-resolve] All ${resolved} matched properties resolved`);
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip + ':ai', { maxRequests: 10, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  const user = await getUser(req).catch(() => null);

  try {
    const validation = await validateBody(req, onboardingSynthesizeSchema);
    if ('error' in validation) {
      return validation.error;
    }
    const { signals, contradictions, certainties } = validation.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages = validation.data.messages as any[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sustainabilitySignals = (signals as any[]).filter((s) => s.cat === 'Sustainability');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tasteSignals = (signals as any[]).filter((s) => s.cat !== 'Sustainability');

    const signalContext = buildSignalContext(tasteSignals, sustainabilitySignals, messages, contradictions, certainties);

    const t0 = Date.now();
    console.log(`[synthesis] Starting parallel synthesis (${tasteSignals.length} taste + ${sustainabilitySignals.length} sustainability signals, ${messages.length} messages)`);

    // ─── Fire all 3 chunks in parallel ───
    const [coreResult, narrativeResult, propertiesResult] = await Promise.all([
      callAndParse(
        CORE_SYSTEM,
        `Synthesize the core analytical profile from this onboarding data.\n${signalContext}\n\nReturn valid JSON only.`,
        2048,
        'core',
      ),
      callAndParse(
        NARRATIVE_SYSTEM,
        `Write the editorial narrative sections from this onboarding data.\n${signalContext}\n\nReturn valid JSON only.`,
        2048,
        'narrative',
      ),
      callAndParse(
        PROPERTIES_SYSTEM,
        `Recommend 5 matched properties from this onboarding data.\n${signalContext}\n\nReturn valid JSON only.`,
        1200,
        'properties',
      ),
    ]);

    const elapsed = Date.now() - t0;
    console.log(`[synthesis] All 3 chunks completed in ${elapsed}ms (was ~20-25s sequential)`);

    // ─── Merge into a single profile ───
    const profile = {
      ...coreResult,
      ...narrativeResult,
      ...propertiesResult,
    };

    // Pre-resolve matched properties
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
