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

export async function parseEmailToBookings(htmlBody: string) {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: `You are a travel booking parser. Extract structured booking information from email HTML.

${TERRAZZO_VOICE}

Return a JSON array of bookings. Each booking should have:
- name: string (restaurant, hotel, or venue name)
- type: "restaurant" | "hotel" | "activity" | "flight"
- date: string (ISO date if found)
- time: string (if found)
- partySize: number (if found)
- confirmationCode: string (if found)
- address: string (if found)
- notes: string (any relevant details)

Return ONLY the JSON array, no markdown or explanation.`,
    messages: [{ role: 'user', content: htmlBody }],
  });

  try {
    const textBlock = response.content.find((b) => b.type === 'text');
    return JSON.parse(extractJSON(textBlock?.type === 'text' ? textBlock.text : '[]'));
  } catch {
    return [];
  }
}

export async function parseUrlToPlaces(articleText: string) {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: `You are a travel recommendation extractor. Extract all place recommendations from this article.

${TERRAZZO_VOICE}

For each place, return:
- name: string (the place name)
- type: "restaurant" | "hotel" | "museum" | "activity" | "bar" | "cafe" | "shop" | "neighborhood"
- city: string (city or area)
- description: string (brief quote or description from the article - sound like a friend sharing what actually matters about this place)
- priceHint: string (if mentioned)

Return ONLY a JSON array, no markdown or explanation.`,
    messages: [{ role: 'user', content: articleText }],
  });

  try {
    const textBlock = response.content.find((b) => b.type === 'text');
    return JSON.parse(extractJSON(textBlock?.type === 'text' ? textBlock.text : '[]'));
  } catch {
    return [];
  }
}

export async function parseTextToPlaces(text: string) {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: `You are a travel list parser. The user has pasted a text list of place recommendations (from a friend, article, etc).

${TERRAZZO_VOICE}

Extract each place mentioned and return a JSON array with:
- name: string (the place name)
- type: "restaurant" | "hotel" | "museum" | "activity" | "bar" | "cafe" | "shop" | "neighborhood"
- city: string (city or area, if mentioned)
- description: string (any context given about the place, refined to sound like a friend's genuine take)

Return ONLY a JSON array, no markdown or explanation.`,
    messages: [{ role: 'user', content: text }],
  });

  try {
    const textBlock = response.content.find((b) => b.type === 'text');
    return JSON.parse(extractJSON(textBlock?.type === 'text' ? textBlock.text : '[]'));
  } catch {
    return [];
  }
}

// ─── Unified extraction (handles any text: lists, articles, mixed content) ────

export interface ExtractionResult {
  region: string | null;
  places: Array<{
    name: string;
    type: string;
    city?: string;
    description?: string;
    userContext?: string;
    travelWith?: string;
    timing?: string;
    intentStatus?: 'booked' | 'planning' | 'dreaming' | 'researching';
  }>;
}

export async function extractPlaces(content: string, isArticleFromUrl: boolean = false): Promise<ExtractionResult> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: `You are Terrazzo's smart place extractor. The user will paste content that contains travel places. It could be ANYTHING: a bucket list, a friend's text, an article, a newsletter, messy notes with emoji and slang, a Google Maps export, or a mix of all of these.

Your job: identify EVERY distinct place mentioned, up to ${isArticleFromUrl ? '50' : '30'} places max. Be exhaustive within that limit — prioritize places that are mentioned most often or described most enthusiastically.

COMPLETENESS IS YOUR #1 PRIORITY:
- Go through the ENTIRE text from start to finish. Do not stop after 15 or 20 places. Extract up to ${isArticleFromUrl ? '50' : '30'}.
- ENSURE COVERAGE ACROSS ALL SECTIONS. First scan the ENTIRE text for section headers/categories, then extract top places from EACH section proportionally. Do NOT exhaust your budget on early sections while ignoring later ones like "Special occasion", "International food", etc.
- Every named venue is a place: restaurants, hotels, bars, cafes, yoga studios, museums, art installations, wineries, bookstores, neighborhoods, beaches.
- If a place appears under a section header like "BARS" or "THINGS TO DO" or "DAY TRIPS" — it's a place. Extract it.
- If two places are mentioned together ("La Huella and Ferona for dancing") — that's TWO places.
- If a place is mentioned parenthetically ("Go nearby to Manantiales or La Barra for real raves") — those are places too.
- If someone writes "Soneva Secret/Kudadoo" that's TWO places. Slashes, commas, and "or" separating names = separate places.
- Neighborhoods, villages, and areas mentioned as destinations count ("Garzón", "Cabo Polonio", "Manantiales").
- But geographic locations used ONLY as context for WHERE an activity happens are NOT separate places. "Swim with Orcas in Norway" = one activity called "Swim with Orcas", with city "Norway". Do NOT also extract "Norway" as a separate neighborhood.
- Similarly, "Raja Ampat chartered boat" = one activity. "Antarctica" mentioned as context = not a place. Country/region names are locations, not places to extract.
- Yoga studios, gyms, art installations, light shows = "activity". Wineries = "activity". Bookstores with food = "cafe" or "shop".
- IMPORTANT: People's names are NOT places. If the text has contributor attributions like "—Sofia Coppola" or "—Frank Herrmann", those are people giving recommendations, NOT venues. Never extract a person's name as a place.
- Section headers ("EAT + DRINK", "Classic bistro", "Special occasion") are NOT places either.
- In hotel review articles, restaurants/bars/spas named as features WITHIN a hotel's description are part of that hotel — do NOT extract them as separate places. E.g., if a hotel review mentions "Spago by Wolfgang Puck" as one of its restaurants, that's a hotel feature, not a standalone place.

PERSONAL CONTEXT — PRESERVE THE VOICE:
The user's personal notes are what make these recommendations special. Capture their exact words:
- "My favorite restaurant in the world" → userContext
- "Steps from my sister's yoga studio" → userContext
- "I made out with a gaucho on a horse there once" → userContext (yes, keep this!)
- "My brother-in-law's great lunch spot" → userContext
- "The holy grail of dulce de leche" → include in description
- "Not to be missed. Reserve in advance." → include in description
These personal notes are the SOUL of the recommendation. Do not sanitize or remove them.

TYPE CLASSIFICATION:
- hotel: hotels, resorts, lodges, ryokans, fincas, estancias, riads, villas (accommodation)
- restaurant: restaurants, lunch spots, dinner spots, grills
- bar: bars, clubs, places primarily for drinking/dancing
- cafe: coffee shops, bakeries, cafes, bookstore-cafes, breakfast spots
- shop: shops, boutiques, bookstores (unless they primarily serve food)
- museum: museums, galleries, art installations, cultural sites, temples, shrines, historic landmarks
- activity: experiences, yoga studios, wineries/bodegas (for tastings), adventure activities, spas, gyms, light shows, expeditions, safaris, glamping camps, unique travel experiences (e.g. "White Desert" = activity, not hotel)
- neighborhood: neighborhoods, villages, beaches, areas mentioned as destinations

LOCATION:
- Use the most specific location. If the whole text is about José Ignacio, Uruguay — every place gets "José Ignacio, Uruguay" unless stated otherwise.
- For day trips away from the main area, use the actual location: "Garzón, Uruguay", "Punta del Este, Uruguay".
- Use your knowledge of these places to fill in correct locations.

INTENT STATUS:
- "booked" = confirmed reservation or "going in May"
- "planning" = "hopefully this fall", active intent
- "dreaming" = bucket list, "maybe someday", or no timing signal
- "researching" = "when they open", "looks gorg, never been"

${TERRAZZO_VOICE}

Return a JSON object (NOT just an array) with:
{
  "region": string | null (the primary region/country for this content, e.g. "José Ignacio, Uruguay" or "Japan" or null if it spans many countries),
  "places": [ ... array of place objects ... ]
}

Each place object has:
- name: string (cleaned up place name)
- type: "restaurant" | "hotel" | "museum" | "activity" | "bar" | "cafe" | "shop" | "neighborhood"
- city: string (specific location)
- description: string (${isArticleFromUrl ? 'ONE short phrase capturing the key detail, max 15 words' : "what makes this place special — blend the user's own words with your knowledge. Keep their voice. 1-2 sentences."})
- userContext: string | null (the user's personal note, preserved with their voice and personality intact)
- travelWith: string | null
- timing: string | null
- intentStatus: "booked" | "planning" | "dreaming" | "researching"

Return ONLY the JSON object. No markdown, no explanation, no truncation. Every place in the text must appear in your output.`,
    messages: [{ role: 'user', content: content.slice(0, 25000) }],
  });

  try {
    const textBlock = response.content.find((b) => b.type === 'text');
    const rawText = textBlock?.type === 'text' ? textBlock.text : '{}';
    const jsonStr = extractJSON(rawText);
    const parsed = JSON.parse(jsonStr);
    // Handle both formats: { region, places } wrapper or bare array
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
    console.error('[extractPlaces] JSON parse failed:', (e as Error).message);
    console.error('[extractPlaces] stop_reason:', response.stop_reason);
    console.error('[extractPlaces] raw response length:', rawText.length);
    console.error('[extractPlaces] raw response tail:', rawText.slice(-200));
    return { region: null, places: [] };
  }
}

// ─── Combined extraction + taste matching (one Claude call instead of two) ────

export interface ExtractAndMatchResult {
  region: string | null;
  places: Array<{
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
  }>;
}

export async function extractAndMatchPlaces(
  content: string,
  isArticleFromUrl: boolean,
  userProfile: Record<string, number>
): Promise<ExtractAndMatchResult> {
  const maxPlaces = isArticleFromUrl ? 50 : 30;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 16384,
    system: `You are Terrazzo's smart place extractor AND taste concierge in one. You will:
1. Extract every distinct place from the user's text (up to ${maxPlaces})
2. Score each against the user's taste profile
3. Return everything in a single JSON response

EXTRACTION RULES:
- Be exhaustive: extract up to ${maxPlaces} places. Go through the ENTIRE text.
- Cover all sections proportionally. Don't exhaust budget on early sections.
- Every named venue counts: restaurants, hotels, bars, cafes, museums, shops, activities, neighborhoods.
- Two names together ("La Huella and Ferona") = TWO places. Slashes too.
- People's names are NOT places. Section headers are NOT places.
- Hotel sub-venues (spa, restaurant inside a hotel) are part of the hotel, not separate places.
- Geographic context words ("Norway" in "Swim with Orcas in Norway") are locations, not places.

TYPE CLASSIFICATION:
hotel | restaurant | bar | cafe | shop | museum | activity | neighborhood

PERSONAL CONTEXT — preserve the user's exact voice and personality in userContext.

TASTE MATCHING:
User profile (0-1 per axis): ${JSON.stringify(userProfile)}
For each place, score:
- matchScore: 0-100 overall match
- matchBreakdown: { Design: 0-1, Character: 0-1, Service: 0-1, Food: 0-1, Location: 0-1, Wellness: 0-1 } — how the PLACE scores
- tasteNote: one-line description in a warm, friend-like voice
- terrazzoInsight: { why: "1-2 sentences on match", caveat: "honest heads-up" }

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
    "intentStatus": "booked" | "planning" | "dreaming" | "researching",
    "matchScore": number,
    "matchBreakdown": { Design, Character, Service, Food, Location, Wellness },
    "tasteNote": string,
    "terrazzoInsight": { "why": string, "caveat": string }
  }]
}

Return ONLY JSON. No markdown. No truncation.`,
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
    console.error('[extractAndMatch] raw response tail:', rawText.slice(-200));
    return { region: null, places: [] };
  }
}

// ─── Batch taste matching (scores multiple places in one Claude call) ─────────

export async function generateTasteMatchBatch(
  places: Array<{ name: string; type: string; city?: string }>,
  userProfile: Record<string, number>
) {
  if (places.length === 0) return [];

  const placeList = places.map((p, i) => `${i + 1}. ${p.name} (${p.type}${p.city ? `, ${p.city}` : ''})`).join('\n');

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `You are Terrazzo's taste concierge. Given a list of places and a user's taste profile (scored 0-1 across 6 axes: Design, Character, Service, Food, Location, Wellness), generate taste match data for EACH place.

${TERRAZZO_VOICE}

For each place, return an object with:
- matchScore: number 0-100 (overall match to the user's taste)
- matchBreakdown: { Design: 0-1, Character: 0-1, Service: 0-1, Food: 0-1, Location: 0-1, Wellness: 0-1 } (how the PLACE scores on each axis — this is about the place, not the user)
- tasteNote: string (one-line description of the place's character, written in the Terrazzo voice — like a friend telling you why this place matters)
- terrazzoInsight: { why: string (1-2 sentences on why this matches the user), caveat: string (honest heads-up) }

Return a JSON array in the SAME ORDER as the input list. Each element corresponds to the place at that index.
Return ONLY the JSON array, no markdown.`,
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

// ─── Single taste match (kept for backward compatibility) ─────────────────────

export async function generateTasteMatch(
  placeName: string,
  placeType: string,
  userProfile: Record<string, number>
) {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: `You are Terrazzo's taste concierge. Given a place and a user's taste profile (scored 0-1 across 6 axes: Design, Character, Service, Food, Location, Wellness), generate:

${TERRAZZO_VOICE}

- matchScore: number 0-100 (overall match)
- matchBreakdown: { Design: 0-1, Character: 0-1, Service: 0-1, Food: 0-1, Location: 0-1, Wellness: 0-1 } (how the PLACE scores on each axis)
- tasteNote: string (one-line description of the place's character, written in the Terrazzo voice)
- terrazzoInsight: { why: string (2-3 sentences on why this matches the user - sound like a friend making a personal recommendation), caveat: string (honest heads-up without judgment) }

Return ONLY JSON, no markdown.`,
    messages: [
      {
        role: 'user',
        content: `Place: ${placeName} (${placeType})\nUser taste profile: ${JSON.stringify(userProfile)}`,
      },
    ],
  });

  try {
    const textBlock = response.content.find((b) => b.type === 'text');
    return JSON.parse(extractJSON(textBlock?.type === 'text' ? textBlock.text : '{}'));
  } catch {
    return null;
  }
}

export default getClient;
