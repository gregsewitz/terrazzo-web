import Anthropic from '@anthropic-ai/sdk';
import { TERRAZZO_VOICE } from '@/types';

let _anthropic: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return _anthropic;
}

const MODEL = 'claude-sonnet-4-20250514';

function extractJSON(text: string): string {
  // Strip markdown code fences if present
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  return cleaned;
}

// ─── Unified extraction + optional taste matching ────────────────────────────

/** Shape of a single place as returned by Claude extraction. */
export interface ExtractedPlace {
  name: string;
  type: string;
  city?: string;
  description?: string;
  userContext?: string;
  travelWith?: string;
  timing?: string;
  intentStatus?: 'booked' | 'planning' | 'dreaming' | 'researching';
  matchScore?: number;
  matchBreakdown?: Record<string, number>;
  tasteNote?: string;
  terrazzoInsight?: { why: string; caveat: string };
}

export interface ExtractAndMatchResult {
  region: string | null;
  places: ExtractedPlace[];
}

// Backward-compatible alias for callers that only need extraction
export type ExtractionResult = ExtractAndMatchResult;

/**
 * Unified place extraction from any content (articles, lists, notes, maps exports).
 * When userProfile is provided, also scores each place against the user's taste.
 * When omitted, performs extraction only (lighter prompt, lower token usage).
 */
export async function extractAndMatchPlaces(
  content: string,
  isArticleFromUrl: boolean,
  userProfile?: Record<string, number>
): Promise<ExtractAndMatchResult> {
  const maxPlaces = isArticleFromUrl ? 50 : 30;
  const includeTasteMatch = !!userProfile;

  const tasteMatchBlock = includeTasteMatch ? `
TASTE MATCHING:
User profile (0-1 per axis): ${JSON.stringify(userProfile)}
For each place, also score:
- matchScore: 0-100 overall match
- matchBreakdown: { Design: 0-1, Character: 0-1, Service: 0-1, Food: 0-1, Location: 0-1, Wellness: 0-1 } — how the PLACE scores
- tasteNote: one-line description in a warm, friend-like voice
- terrazzoInsight: { why: "1-2 sentences on match", caveat: "honest heads-up" }` : '';

  const tasteFieldsBlock = includeTasteMatch ? `
    "matchScore": number,
    "matchBreakdown": { Design, Character, Service, Food, Location, Wellness },
    "tasteNote": string,
    "terrazzoInsight": { "why": string, "caveat": string }` : '';

  const extractSystemPrompt = `You are Terrazzo's smart place extractor${includeTasteMatch ? ' AND taste concierge' : ''}. The user will paste content that contains travel places — a bucket list, article, newsletter, messy notes, Google Maps export, or a mix.

Your job: identify EVERY distinct place mentioned, up to ${maxPlaces} places max.

COMPLETENESS IS YOUR #1 PRIORITY:
- Go through the ENTIRE text from start to finish. Extract up to ${maxPlaces}.
- ENSURE COVERAGE ACROSS ALL SECTIONS. Scan the ENTIRE text for section headers, then extract proportionally from each.
- Every named venue is a place: restaurants, hotels, bars, cafes, yoga studios, museums, art installations, wineries, bookstores, neighborhoods, beaches.
- If a place appears under a section header like "BARS" or "THINGS TO DO" — it's a place.
- Two names together ("La Huella and Ferona") = TWO places. Slashes too ("Soneva Secret/Kudadoo").
- Neighborhoods, villages, and areas mentioned as destinations count.
- Geographic locations used ONLY as context (like "Norway" in "Swim with Orcas in Norway") are NOT separate places.
- People's names are NOT places. Section headers are NOT places.
- In hotel reviews, sub-venues (spa, restaurant inside a hotel) are part of that hotel, not separate places.

PERSONAL CONTEXT — PRESERVE THE VOICE:
Capture the user's exact words in userContext. Personal notes are the SOUL of the recommendation.

TYPE CLASSIFICATION:
hotel | restaurant | bar | cafe | shop | museum | activity | neighborhood

LOCATION:
- Use the most specific location. If the whole text is about one area, every place gets that location unless stated otherwise.
- Use your knowledge to fill in correct locations.

INTENT STATUS:
- "booked" = confirmed reservation
- "planning" = active intent
- "dreaming" = bucket list or no timing signal
- "researching" = looking into it
${tasteMatchBlock}

${TERRAZZO_VOICE}

Return a JSON object:
{
  "region": string | null,
  "places": [{
    "name": string,
    "type": string,
    "city": string,
    "description": string (${isArticleFromUrl ? 'max 15 words' : '1-2 sentences'}),
    "userContext": string | null,
    "travelWith": string | null,
    "timing": string | null,
    "intentStatus": "booked" | "planning" | "dreaming" | "researching"${includeTasteMatch ? ',' : ''}${tasteFieldsBlock}
  }]
}

Return ONLY JSON. No markdown. No truncation. Every place must appear.`;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: includeTasteMatch ? 16384 : 8192,
    system: [{ type: 'text', text: extractSystemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: content.slice(0, 25000) }],
  });

  try {
    const textBlock = response.content.find((b) => b.type === 'text');
    const rawText = textBlock?.type === 'text' ? textBlock.text : '{}';
    const jsonStr = extractJSON(rawText);
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return { region: null, places: parsed };
    }
    return {
      region: parsed.region || null,
      places: Array.isArray(parsed.places) ? parsed.places : [],
    };
  } catch (e) {
    const textBlock = response.content.find((b) => b.type === 'text');
    const rawText = textBlock?.type === 'text' ? textBlock.text : '';
    console.error('[extractAndMatch] JSON parse failed:', (e as Error).message);
    console.error('[extractAndMatch] stop_reason:', response.stop_reason);
    console.error('[extractAndMatch] raw response length:', rawText.length);
    console.error('[extractAndMatch] raw response tail:', rawText.slice(-200));
    return { region: null, places: [] };
  }
}

/**
 * @deprecated Use extractAndMatchPlaces(content, isArticle) without userProfile instead.
 * Kept as alias for backward compatibility with eval tooling.
 */
export const extractPlaces = (content: string, isArticleFromUrl: boolean = false): Promise<ExtractionResult> =>
  extractAndMatchPlaces(content, isArticleFromUrl);

// ─── Batch taste matching (scores multiple places in one Claude call) ─────────

export async function generateTasteMatchBatch(
  places: Array<{ name: string; type: string; city?: string }>,
  userProfile: Record<string, number>
) {
  if (places.length === 0) return [];

  const placeList = places.map((p, i) => `${i + 1}. ${p.name} (${p.type}${p.city ? `, ${p.city}` : ''})`).join('\n');

  const tasteMatchSystemPrompt = `You are Terrazzo's taste concierge. Given a list of places and a user's taste profile (scored 0-1 across 6 axes: Design, Character, Service, Food, Location, Wellness), generate taste match data for EACH place.

${TERRAZZO_VOICE}

For each place, return an object with:
- matchScore: number 0-100 (overall match to the user's taste)
- matchBreakdown: { Design: 0-1, Character: 0-1, Service: 0-1, Food: 0-1, Location: 0-1, Wellness: 0-1 } (how the PLACE scores on each axis — this is about the place, not the user)
- tasteNote: string (one-line description of the place's character, written in the Terrazzo voice — like a friend telling you why this place matters)
- terrazzoInsight: { why: string (1-2 sentences on why this matches the user), caveat: string (honest heads-up) }

Return a JSON array in the SAME ORDER as the input list. Each element corresponds to the place at that index.
Return ONLY the JSON array, no markdown.`;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: [{ type: 'text', text: tasteMatchSystemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: `Places:\n${placeList}\n\nUser taste profile: ${JSON.stringify(userProfile)}`,
      },
    ],
  });

  try {
    const textBlock = response.content.find((b) => b.type === 'text');
    return JSON.parse(extractJSON(textBlock?.type === 'text' ? textBlock.text : '[]'));
  } catch {
    return [];
  }
}

export default getClient;
