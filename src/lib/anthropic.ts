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

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

function extractJSON(text: string): string {
  // Strip markdown code fences if present
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  return cleaned;
}

/**
 * Retry helper with exponential backoff for rate-limited API calls.
 */
async function callClaudeWithRetry(
  params: Parameters<typeof Anthropic.prototype.messages.create>[0],
  maxRetries = 3
): Promise<any> {
  const client = getClient();
  // Use streaming for large requests to avoid the 10-minute timeout limit.
  // The SDK throws "Streaming is required for operations that may take longer
  // than 10 minutes" for high max_tokens non-streaming calls.
  const useStreaming = (params.max_tokens || 0) > 8192;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (useStreaming) {
        // Stream the response and collect it into the same shape as a
        // non-streaming response so callers don't need to change.
        const stream = client.messages.stream(params);
        const response = await stream.finalMessage();
        return response;
      }
      return await client.messages.create(params);
    } catch (err: any) {
      if (err?.status === 429 && attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.warn(`[anthropic] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
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
  parseError?: string;
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
  // Estimate place density: count likely separators to size the cap.
  // Dense guides can easily have 80-100+ places.
  const separatorCount = (content.match(/\n|[|•·–—]|\d+\./g) || []).length;
  const estimatedPlaces = Math.max(separatorCount, content.length / 200);
  const maxPlaces = isArticleFromUrl
    ? Math.min(Math.max(50, Math.ceil(estimatedPlaces * 1.2)), 120)
    : Math.min(Math.max(30, Math.ceil(estimatedPlaces * 1.2)), 120);
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

Your job: identify EVERY distinct FEATURED place mentioned, up to ${maxPlaces} places max.

ARTICLE-TYPE AWARENESS (CRITICAL):
First, determine what kind of content this is. Look at the title, intro, and structure:
- If the article is a LIST OF HOTELS (e.g., "Best Hotels in Europe", "Top 10 Resorts"): extract ONLY the hotels being featured/reviewed. Restaurants, spas, bars, and activities mentioned WITHIN a hotel review are amenities of that hotel — capture them in the hotel's description, NOT as separate places.
- If the article is a LIST OF RESTAURANTS: extract ONLY the restaurants. A hotel mentioned as "stay nearby at X" is context, not a featured place.
- If the article is a CITY/DESTINATION GUIDE with multiple categories: extract the featured places from ALL categories (restaurants, bars, cafes, shops, hotels, museums, activities — everything).
- If the article is a MIXED LIST or bucket list: extract all distinct places.
- If the article is a PERSONAL BLOG POST or newsletter with editorial storytelling: the featured places may be embedded in paragraphs of narrative. Extract EVERY place that is a recommendation, even if surrounded by anecdotes, travel logistics, or personal stories. A hotel described across two paragraphs of editorial prose is still a featured place. IMPORTANT: blog roundups like "10 Wishlist Hotels" or "My Favorite Restaurants" have a DEFINED NUMBER in the title — you MUST extract ALL of them, not just the first few.
The key principle: extract the PRIMARY SUBJECTS of the article, not every proper noun that appears in supporting text.

COMPLETENESS (CRITICAL — READ CAREFULLY):
- Go through the ENTIRE text from start to finish, section by section.
- Extract up to ${maxPlaces} FEATURED places.
- ENSURE COVERAGE ACROSS ALL SECTIONS. Scan the ENTIRE text for section headers, then extract from EVERY section.
- INLINE LISTS ARE PLACES TOO: Text like "A | B | C" or "Check out: X, Y, and Z" or "Options include X / Y / Z" contains MULTIPLE places. Extract EACH ONE as its own entry.
- "Also try: X in neighborhood, Y in neighborhood" — extract X and Y separately.
- Two names together ("La Huella and Ferona") = TWO places. Slashes too ("Soneva Secret/Kudadoo"). Pipes too ("Iruca Tokyo | Kagari Ramen | Ichiran").
- Neighborhoods, villages, and areas mentioned as destinations count IF they are featured, not just used as location context.
- Geographic locations used ONLY as context (like "Norway" in "Swim with Orcas in Norway") are NOT separate places.
- People's names are NOT places. Section headers are NOT places.
- Convenience store chains (7-Eleven, FamilyMart, Lawson, etc.) and generic chain references are NOT places.
- Generic landmarks or intersections (e.g. "Shibuya Crossing", "Times Square", "the souks") are NOT saveable places — only extract them if they are named venues/businesses.
- Boats, vehicles, or modes of transport are NOT places (e.g. "Set Nefru" dahabiya, "Orient Express" train).
- Sub-venues (spa, restaurant, bar inside a hotel or resort) are part of the parent venue. Mention them in the description but do NOT extract them as separate places.
- A place mentioned only as "nearby" or "also consider" or in a photo caption is NOT a featured place unless the article dedicates a section to it.
- Hotels/properties mentioned only as a reference ("my friend's hotel X in Y") are NOT featured places — only extract places the article/text actually recommends or profiles.
- DO NOT STOP EARLY. If the text has 80 places, extract 80 places. If a blog says "10 hotels", extract all 10. Completeness matters more than brevity.
- BEFORE RETURNING: Count how many places you found. Then re-scan the text from the MIDDLE and END to check for any you missed. Blog posts and roundups often have equally important entries near the bottom.

PERSONAL CONTEXT — PRESERVE THE VOICE:
Capture the user's exact words in userContext. Personal notes are the SOUL of the recommendation.

TYPE CLASSIFICATION:
hotel | restaurant | bar | cafe | shop | museum | activity | neighborhood
Use these guidelines:
- "cafe" = primarily coffee, tea, juice, bakeries, pastry shops, bread shops, donut shops. If a place is mainly about drinks/pastries/light bites and the vibe is casual/daytime, use "cafe".
- "restaurant" = primarily sit-down meals (lunch/dinner). A place known for ramen, sushi, tempura, pizza, tonkatsu, etc. is a "restaurant" even if casual.
- "bar" = primarily drinks (wine bars, cocktail bars, listening bars, izakayas focused on drinks). If a place is described mainly for its drinks, cocktails, wine, or nightlife atmosphere, use "bar".
- "shop" = retail stores, bookshops, clothing stores, department stores, markets, vintage shops, knife shops, stationery stores, food halls/depachikas.
- "museum" = museums, galleries, art spaces, design museums, cultural foundations, historic houses open to visitors.
- "activity" = parks, markets (when visited as an experience rather than shopping), outdoor activities, tours, experiences, landmarks.

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

  // Scale max_tokens based on expected output size.
  // Each place is ~150 tokens of JSON. Add headroom for the wrapper.
  const baseTokens = includeTasteMatch ? 16384 : 8192;
  const scaledTokens = Math.min(Math.max(baseTokens, maxPlaces * 200), 32000);

  const response = await callClaudeWithRetry({
    model: MODEL,
    max_tokens: scaledTokens,
    system: [{ type: 'text', text: extractSystemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: content.slice(0, 30000) }],
  });

  try {
    const textBlock = response.content.find((b: { type: string }) => b.type === 'text');
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
    const textBlock = response.content.find((b: { type: string }) => b.type === 'text');
    const rawText = textBlock?.type === 'text' ? textBlock.text : '';
    console.error('[extractAndMatch] JSON parse failed:', (e as Error).message);
    console.error('[extractAndMatch] stop_reason:', response.stop_reason);
    console.error('[extractAndMatch] raw response length:', rawText.length);
    console.error('[extractAndMatch] raw response tail:', rawText.slice(-200));
    return { region: null, places: [], parseError: (e as Error).message };
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

  const response = await callClaudeWithRetry({
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
    const textBlock = response.content.find((b: { type: string }) => b.type === 'text');
    return JSON.parse(extractJSON(textBlock?.type === 'text' ? textBlock.text : '[]'));
  } catch {
    return [];
  }
}

export default getClient;
