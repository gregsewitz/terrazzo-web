import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

const DISCOVER_SYSTEM_PROMPT = `You are Terrazzo's discover feed curator. Given a user's taste profile, generate hyper-personalized place recommendations.

You must return valid JSON matching this EXACT structure:

{
  "becauseYouCards": [
    {
      "signal": "a specific micro-signal from their profile",
      "signalDomain": "Design Language | Character & Identity | Service Philosophy | Food & Drink | Location & Context | Wellness & Body",
      "place": "Real place name",
      "location": "City, Country",
      "score": 85-99,
      "why": "2-sentence explanation connecting the signal to this specific place",
      "bg": "#hex color (dark, moody)"
    }
  ],
  "weeklyCollection": {
    "title": "Thematic collection title (max 10 words)",
    "subtitle": "Filtered for: signal1 · signal2 · signal3",
    "places": [
      {
        "name": "Place name",
        "location": "City, Country",
        "score": 80-99,
        "signals": ["signal1", "signal2", "signal3"],
        "signalDomain": "Primary domain",
        "note": "1-sentence personalized explanation"
      }
    ]
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
    "why": "Why this could expand their taste (2 sentences)",
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
- Use REAL places that exist. Hotels, restaurants, cafes that are well-known in the design/boutique space.
- Generate 3 becauseYouCards, 5 weeklyCollection places, 1 stretchPick, 3 contextRecs.
- Scores should reflect genuine alignment with the profile, not random numbers.
- The stretchPick should genuinely contradict one of their stated preferences while matching a revealed one.
- bg colors should be dark, muted earth tones: #2d3a2d, #3a2d2d, #2d2d3a, #3a3a2d, #2d3a3a.
- Context recommendations should match the user's primary travel companion or current season.
- Every "why" and "note" must reference SPECIFIC profile signals, not generic praise.`;

export async function POST(req: NextRequest) {
  try {
    const { userProfile, lifeContext } = await req.json();

    if (!userProfile) {
      return NextResponse.json({ error: 'No profile provided' }, { status: 400 });
    }

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

Generate the discover feed. Return valid JSON only.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
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
