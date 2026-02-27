/**
 * Discover Editorial — Claude writes editorial copy for pre-selected properties.
 *
 * This is the "Claude as editor, not selector" layer of the RAG-grounded discover feed.
 * Claude receives properties that have already been scored and allocated by the matching engine,
 * and writes warm, specific, second-person editorial copy for each card slot.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { GeneratedTasteProfile, OnboardingLifeContext } from '@/types';
import type { AllocatedFeed } from './discover-allocation';

const anthropic = new Anthropic();

// ─── Editorial prompt ────────────────────────────────────────────────────────

const GROUNDED_EDITORIAL_PROMPT = `You are Terrazzo's editorial voice — a deeply tasteful, well-traveled curator who writes like the best travel magazines. You have intimate knowledge of both the user and the properties you're writing about.

CRITICAL: You are NOT selecting properties. Properties have already been selected by our matching engine based on real signal data. Your job is to write warm, specific, second-person editorial copy for each card.

For each property, you receive:
- Property name and its computed match score (real, not estimated)
- The specific taste signals that drove the match
- Which user contradiction the property resolves (if any)
- The user's full taste profile for narrative context

RULES:
- Use the computed scores provided. Do NOT invent scores.
- Reference specific signals in your copy. Never be generic or promotional.
- Write like a well-traveled friend who also happens to have perfect recall.
- The editorialLetter is the crown jewel — make it feel like the opening of a magazine essay written just for this person.
- The tasteTension editorial should be genuinely psychologically insightful.
- Every "why", "note", "connection" must reference SPECIFIC profile signals.
- bg colors: dark, muted earth tones: #2d3a2d, #3a2d2d, #2d2d3a, #3a3a2d, #2d3a3a.
- moodBoard colors: muted, editorial: #4a6b8b, #8b4a4a, #6b6b4a, #4a6741, #8b6b4a.

Return valid JSON matching the EXACT structure specified in the context message.`;

// ─── Types for the editorial output ──────────────────────────────────────────

export interface EditorialFeed {
  editorialLetter: {
    headline: string;
    body: string;
    signalHighlight: string;
  };
  becauseYouCards: Array<{
    signal: string;
    signalDomain: string;
    place: string;
    location: string;
    score: number;
    why: string;
    bg: string;
    googlePlaceId: string;
  }>;
  signalThread: {
    signal: string;
    domain: string;
    thread: string;
    places: Array<{
      name: string;
      location: string;
      type: string;
      connection: string;
      score: number;
      googlePlaceId: string;
    }>;
  };
  tasteTension: {
    title: string;
    stated: string;
    revealed: string;
    editorial: string;
    resolvedBy: {
      name: string;
      location: string;
      how: string;
      googlePlaceId: string;
    };
  } | null;
  weeklyCollection: {
    title: string;
    subtitle: string;
    places: Array<{
      name: string;
      location: string;
      score: number;
      signals: string[];
      signalDomain: string;
      note: string;
      googlePlaceId: string;
    }>;
  };
  moodBoards: Array<{
    mood: string;
    description: string;
    color: string;
    places: Array<{
      name: string;
      location: string;
      vibe: string;
      score: number;
      googlePlaceId: string;
    }>;
  }>;
  deepMatch: {
    name: string;
    location: string;
    score: number;
    headline: string;
    signalBreakdown: Array<{
      signal: string;
      domain: string;
      strength: number;
      note: string;
    }>;
    tensionResolved: string;
    googlePlaceId: string;
  };
  stretchPick: {
    name: string;
    location: string;
    score: number;
    type: string;
    strongAxis: string;
    strongScore: number;
    weakAxis: string;
    weakScore: number;
    why: string;
    tension: string;
    googlePlaceId: string;
  } | null;
  contextRecs: Array<{
    name: string;
    location: string;
    score: number;
    whyFits: string;
    googlePlaceId: string;
  }>;
  contextLabel: string;
}

// ─── Build context message from allocated feed ───────────────────────────────

function buildContextMessage(
  allocated: AllocatedFeed,
  userProfile: GeneratedTasteProfile,
  lifeContext: OnboardingLifeContext | null,
): string {
  const companion = lifeContext?.primaryCompanions?.[0] || 'solo';
  const month = new Date().getMonth();
  const season = month >= 4 && month <= 9 ? 'Summer' : 'Winter';

  // Serialize the allocated feed into a readable format for Claude
  const deepMatch = allocated.deepMatch.candidate;
  const becauseYou = allocated.becauseYouCards;
  const signalThread = allocated.signalThread;
  const tasteTension = allocated.tasteTension;
  const weekly = allocated.weeklyCollection;
  const moodBoards = allocated.moodBoards;
  const stretchPick = allocated.stretchPick;
  const contextRecs = allocated.contextRecs;

  return `USER'S TASTE PROFILE:
- Archetype: ${userProfile.overallArchetype}
- Description: ${userProfile.archetypeDescription || ''}
- Emotional driver: ${userProfile.emotionalDriver?.primary || 'Unknown'} / ${userProfile.emotionalDriver?.secondary || 'Unknown'}

MICRO-SIGNALS BY DOMAIN:
${Object.entries(userProfile.microTasteSignals || {}).map(([domain, signals]) => `${domain}: ${(signals as string[]).join(', ')}`).join('\n')}

RADAR AXES:
${(userProfile.radarData || []).map((r: { axis: string; value: number }) => `${r.axis}: ${Math.round(r.value * 100)}%`).join(', ')}

CONTRADICTIONS:
${(userProfile.contradictions || []).map((c) => `${c.stated} vs ${c.revealed} → ${c.resolution}`).join('\n') || 'None identified'}

LIFE CONTEXT:
- Primary companion: ${companion}
- Current season: ${season}

---

ALLOCATED FEED — PRE-SELECTED BY MATCHING ENGINE:
(Scores are computed from real signal data. Use them as-is.)

1. DEEP MATCH (highest overall score):
   - Name: ${deepMatch.propertyName}
   - googlePlaceId: ${deepMatch.googlePlaceId}
   - Score: ${deepMatch.overallScore}
   - Top domain: ${deepMatch.topDimension}
   - Domain breakdown: ${JSON.stringify(deepMatch.domainBreakdown)}
   - Top matching signals: ${deepMatch.topMatchingSignals.map(s => `"${s.signal}" (${s.dimension}, conf=${s.confidence})`).join('; ')}
   ${deepMatch.contradictionRelevance ? `- Resolves contradiction: "${deepMatch.contradictionRelevance.contradiction.stated}" vs "${deepMatch.contradictionRelevance.contradiction.revealed}"` : ''}

2. BECAUSE YOU CARDS (3 domain-diversified picks):
${becauseYou.map((b, i) => `   ${i + 1}. ${b.candidate.propertyName} (${b.candidate.googlePlaceId})
      Score: ${b.candidate.overallScore} | Signal: "${b.signal}" | Domain: ${b.signalDomain}
      Top signals: ${b.candidate.topMatchingSignals.slice(0, 3).map(s => `"${s.signal}"`).join(', ')}`).join('\n')}

3. SIGNAL THREAD (shared signal across properties):
   - Dominant signal: "${signalThread.signal}"
   - Domain: ${signalThread.domain}
   - Properties:
${signalThread.candidates.map((c, i) => `     ${i + 1}. ${c.propertyName} (${c.googlePlaceId}) — Score: ${c.overallScore}`).join('\n')}

4. TASTE TENSION:${tasteTension ? `
   - Contradiction: "${tasteTension.contradiction.stated}" vs "${tasteTension.contradiction.revealed}"
   - Resolution: ${tasteTension.contradiction.resolution}
   - Resolved by: ${tasteTension.candidate.propertyName} (${tasteTension.candidate.googlePlaceId}) — Score: ${tasteTension.candidate.overallScore}
   - Covers both sides: ${tasteTension.candidate.contradictionRelevance?.coversBothSides}` : '\n   (No contradiction-resolving property found)'}

5. STRETCH PICK:${stretchPick ? `
   - Name: ${stretchPick.candidate.propertyName} (${stretchPick.candidate.googlePlaceId})
   - Score: ${stretchPick.candidate.overallScore}
   - Strong domain: ${stretchPick.strongDomain} (${stretchPick.candidate.domainBreakdown[stretchPick.strongDomain]})
   - Weak domain: ${stretchPick.weakDomain} (${stretchPick.candidate.domainBreakdown[stretchPick.weakDomain]})` : '\n   (No stretch pick found)'}

6. WEEKLY COLLECTION (thematic cluster, domain: ${weekly.dominantDomain}):
${weekly.candidates.map((c, i) => `   ${i + 1}. ${c.propertyName} (${c.googlePlaceId}) — Score: ${c.overallScore} | Top: ${c.topDimension}`).join('\n')}

7. MOOD BOARDS:
${moodBoards.map((mb, i) => `   Board ${i + 1} — Domain: ${mb.domain}
${mb.candidates.map((c, j) => `     ${j + 1}. ${c.propertyName} (${c.googlePlaceId}) — Score: ${c.overallScore}`).join('\n')}`).join('\n')}

8. CONTEXT RECS (for "${allocated.contextLabel}"):
${contextRecs.map((cr, i) => `   ${i + 1}. ${cr.candidate.propertyName} (${cr.candidate.googlePlaceId}) — Score: ${cr.candidate.overallScore}`).join('\n')}

---

CONTEXT LABEL: "${allocated.contextLabel}"

OUTPUT FORMAT:
Return valid JSON with this structure:
{
  "editorialLetter": {
    "headline": "A provocative, personal observation (max 12 words)",
    "body": "2-3 sentences, second-person, referencing specific signals",
    "signalHighlight": "The single micro-signal that inspired this letter"
  },
  "becauseYouCards": [
    { "signal": "...", "signalDomain": "...", "place": "property name", "location": "City, Country", "score": <use computed score>, "why": "2-sentence explanation connecting signal to place", "bg": "#hex", "googlePlaceId": "..." }
  ],
  "signalThread": {
    "signal": "the dominant signal from above", "domain": "...",
    "thread": "1 sentence on how this signal shapes their travel",
    "places": [{ "name": "...", "location": "...", "type": "hotel|restaurant|bar|cafe|neighborhood", "connection": "1 sentence", "score": <computed>, "googlePlaceId": "..." }]
  },
  "tasteTension": { "title": "4-6 words", "stated": "...", "revealed": "...", "editorial": "2-3 insightful sentences", "resolvedBy": { "name": "...", "location": "...", "how": "1 sentence", "googlePlaceId": "..." } } | null,
  "weeklyCollection": {
    "title": "Evocative theme (max 10 words)", "subtitle": "Filtered for: signal1 · signal2 · signal3",
    "places": [{ "name": "...", "location": "...", "score": <computed>, "signals": ["s1","s2","s3"], "signalDomain": "...", "note": "1 sentence", "googlePlaceId": "..." }]
  },
  "moodBoards": [{ "mood": "When you... (max 8 words)", "description": "1 sentence", "color": "#hex", "places": [{ "name": "...", "location": "...", "vibe": "3-5 words", "score": <computed>, "googlePlaceId": "..." }] }],
  "deepMatch": {
    "name": "...", "location": "...", "score": <computed>, "headline": "max 12 words",
    "signalBreakdown": [{ "signal": "...", "domain": "...", "strength": <computed domain score>, "note": "why this matches" }],
    "tensionResolved": "1-2 sentences", "googlePlaceId": "..."
  },
  "stretchPick": { "name": "...", "location": "...", "score": <computed>, "type": "hotel|restaurant|...", "strongAxis": "...", "strongScore": <computed>, "weakAxis": "...", "weakScore": <computed>, "why": "2 sentences", "tension": "1 sentence", "googlePlaceId": "..." } | null,
  "contextRecs": [{ "name": "...", "location": "...", "score": <computed>, "whyFits": "1 sentence", "googlePlaceId": "..." }],
  "contextLabel": "${allocated.contextLabel}"
}

IMPORTANT:
- Use the EXACT property names from above. Do not rename or substitute properties.
- Use the EXACT computed scores provided. Do not inflate or change them.
- Use the EXACT googlePlaceIds provided. These link to real Places in our database.
- For "location", infer the city/country from the property name or write "Location TBD" if unknown.
- Write editorial copy that references specific signals from the profile.
- Return ONLY valid JSON, no wrapping text.`;
}

// ─── Generate editorial copy ─────────────────────────────────────────────────

/**
 * Send the allocated feed + user profile to Claude for editorial copy generation.
 * Claude writes the narrative layer; all property selection and scoring is pre-computed.
 */
export async function generateEditorialCopy(
  allocated: AllocatedFeed,
  userProfile: GeneratedTasteProfile,
  lifeContext: OnboardingLifeContext | null,
): Promise<EditorialFeed> {
  const contextMessage = buildContextMessage(allocated, userProfile, lifeContext);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: GROUNDED_EDITORIAL_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: contextMessage }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse editorial content from Claude response');
  }

  const result = JSON.parse(jsonMatch[0]) as EditorialFeed;
  return result;
}
