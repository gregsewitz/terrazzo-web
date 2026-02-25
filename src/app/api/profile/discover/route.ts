import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { validateBody, profileDiscoverSchema } from '@/lib/api-validation';

const anthropic = new Anthropic();

const DISCOVER_SYSTEM_PROMPT = `You are Terrazzo's editorial intelligence — a deeply tasteful, well-traveled curator who writes like the best travel magazines but thinks like a data scientist. Given a user's complete taste profile, generate a hyper-personalized discover feed that feels like a love letter from someone who truly understands how they travel.

You must return valid JSON matching this EXACT structure:

{
  "editorialLetter": {
    "headline": "A provocative, personal observation about their taste (max 12 words). Write like an opening line of an essay.",
    "body": "2-3 sentences. Second-person. Deeply specific to their signals. Reference actual things from their profile. This should feel like a friend who's been paying very close attention.",
    "signalHighlight": "The single micro-signal that inspired this letter"
  },
  "becauseYouCards": [
    {
      "signal": "a specific micro-signal from their profile",
      "signalDomain": "Design Language | Character & Identity | Service Philosophy | Food & Drink | Location & Context | Wellness & Body",
      "place": "Real place name",
      "location": "City, Country",
      "score": 85-99,
      "why": "2-sentence explanation connecting the signal to this specific place. Be visceral and specific.",
      "bg": "#hex color (dark, moody)"
    }
  ],
  "signalThread": {
    "signal": "A dominant micro-signal from their profile",
    "domain": "The domain it belongs to",
    "thread": "1 sentence explaining how this single signal shapes their entire travel experience across different place types.",
    "places": [
      {
        "name": "Place name",
        "location": "City, Country",
        "type": "hotel | restaurant | bar | cafe | neighborhood",
        "connection": "1 sentence: how this specific place embodies the signal",
        "score": 80-99
      }
    ]
  },
  "tasteTension": {
    "title": "A compelling 4-6 word title for their most interesting contradiction",
    "stated": "What they said/think they prefer",
    "revealed": "What their behavior actually shows",
    "editorial": "2-3 sentences exploring WHY this tension exists and what it reveals about them. This is the intellectual heart of the feed — make it genuinely insightful.",
    "resolvedBy": {
      "name": "A real place that resolves this tension",
      "location": "City, Country",
      "how": "1 sentence explaining how this place holds both sides of the contradiction"
    }
  },
  "weeklyCollection": {
    "title": "Thematic collection title (max 10 words, evocative not generic)",
    "subtitle": "Filtered for: signal1 · signal2 · signal3",
    "places": [
      {
        "name": "Place name",
        "location": "City, Country",
        "score": 80-99,
        "signals": ["signal1", "signal2", "signal3"],
        "signalDomain": "Primary domain",
        "note": "1-sentence personalized explanation — visceral, not promotional"
      }
    ]
  },
  "moodBoards": [
    {
      "mood": "A mood or context phrased as 'When you...' (max 8 words)",
      "description": "1-sentence evocative description of this travel mood",
      "color": "#hex (muted, editorial tone)",
      "places": [
        {
          "name": "Place name",
          "location": "City, Country",
          "vibe": "3-5 word atmospheric descriptor",
          "score": 80-97
        }
      ]
    }
  ],
  "deepMatch": {
    "name": "Their single highest-match property",
    "location": "City, Country",
    "score": 93-99,
    "headline": "A personal, editorial statement about why this place is their match (max 12 words)",
    "signalBreakdown": [
      {
        "signal": "Specific micro-signal",
        "domain": "Domain name",
        "strength": 85-99,
        "note": "Why this signal matches this specific property"
      }
    ],
    "tensionResolved": "1-2 sentences on which contradiction this property resolves and how"
  },
  "stretchPick": {
    "name": "Place name",
    "location": "City, Country",
    "score": 65-80,
    "type": "hotel | restaurant | cafe | bar",
    "strongAxis": "Axis name",
    "strongScore": 85-99,
    "weakAxis": "Axis name",
    "weakScore": 20-45,
    "why": "Why this could expand their taste (2 sentences). Be honest about the mismatch.",
    "tension": "What breaks their usual pattern (1 sentence)"
  },
  "contextRecs": [
    {
      "name": "Place name",
      "location": "City, Country",
      "score": 80-97,
      "whyFits": "1-sentence context-specific fit explanation"
    }
  ],
  "contextLabel": "Summer" or "Winter" or "With Partner" etc
}

RULES:
- Use REAL places that exist. Hotels, restaurants, cafes well-known in the design/boutique world.
- Generate: 1 editorialLetter, 3 becauseYouCards, 1 signalThread with 3 places, 1 tasteTension, 5 weeklyCollection places, 2 moodBoards with 3 places each, 1 deepMatch with 4-5 signal breakdowns, 1 stretchPick, 3 contextRecs.
- Scores reflect genuine alignment with the profile.
- The stretchPick should genuinely contradict one stated preference while matching a revealed one.
- bg colors: dark, muted earth tones: #2d3a2d, #3a2d2d, #2d2d3a, #3a3a2d, #2d3a3a.
- moodBoard colors: muted, editorial: #4a6b8b, #8b4a4a, #6b6b4a, #4a6741, #8b6b4a.
- Context recs match the user's primary travel companion or current season.
- Every "why", "note", "connection" must reference SPECIFIC profile signals, not generic praise.
- Write like a well-traveled friend who also happens to have perfect recall of everything you've ever said about travel. Warm, specific, editorial — never promotional or corporate.
- The editorialLetter is the crown jewel. It should feel like the opening of a magazine essay written just for this person.
- The tasteTension editorial should be genuinely psychologically insightful, not just restating the contradiction.
- signalThread should pick their most interesting signal and show how it plays out across very different place types.`;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip + ':ai', { maxRequests: 10, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  try {
    const validation = await validateBody(req, profileDiscoverSchema);
    if ('error' in validation) {
      return validation.error;
    }
    // These are loosely-typed objects from the client — cast for template access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { userProfile, lifeContext } = validation.data as any;

    // Determine context based on season and life context
    const month = new Date().getMonth();
    const season = month >= 4 && month <= 9 ? 'Summer' : 'Winter';
    const companion = lifeContext?.primaryCompanions?.[0] || 'solo';
    const contextLabel = companion !== 'solo' ? `With ${companion}` : season;

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

CONTEXT LABEL FOR RECS: "${contextLabel}"

Generate the full discover feed. Return valid JSON only.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: [{ type: 'text', text: DISCOVER_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: contextMessage }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse discover content' }, { status: 500 });
    }

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Discover generation error:', error);
    return NextResponse.json({ error: 'Failed to generate discover content' }, { status: 500 });
  }
}
