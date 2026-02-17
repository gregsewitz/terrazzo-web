import Anthropic from '@anthropic-ai/sdk';
import { TERRAZZO_VOICE } from '@/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-20250514';

function extractJSON(text: string): string {
  // Strip markdown code fences if present
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  return cleaned;
}

export async function parseEmailToBookings(htmlBody: string) {
  const response = await anthropic.messages.create({
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
  const response = await anthropic.messages.create({
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
  const response = await anthropic.messages.create({
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

export async function generateTasteMatch(
  placeName: string,
  placeType: string,
  userProfile: Record<string, number>
) {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: `You are Terrazzo's taste intelligence engine. Given a place and a user's taste profile (scored 0-1 across 6 axes: Design, Character, Service, Food, Location, Wellness), generate:

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

export default anthropic;
