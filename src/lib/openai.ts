import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function parseEmailToBookings(htmlBody: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a travel booking parser. Extract structured booking information from email HTML.
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
      },
      { role: 'user', content: htmlBody },
    ],
    temperature: 0.1,
  });

  try {
    return JSON.parse(response.choices[0]?.message?.content || '[]');
  } catch {
    return [];
  }
}

export async function parseUrlToPlaces(articleText: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a travel recommendation extractor. Extract all place recommendations from this article.
For each place, return:
- name: string (the place name)
- type: "restaurant" | "hotel" | "museum" | "activity" | "bar" | "cafe" | "shop" | "neighborhood"
- city: string (city or area)
- description: string (brief quote or description from the article)
- priceHint: string (if mentioned)

Return ONLY a JSON array, no markdown or explanation.`,
      },
      { role: 'user', content: articleText },
    ],
    temperature: 0.1,
  });

  try {
    return JSON.parse(response.choices[0]?.message?.content || '[]');
  } catch {
    return [];
  }
}

export async function parseTextToPlaces(text: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a travel list parser. The user has pasted a text list of place recommendations (from a friend, article, etc).
Extract each place mentioned and return a JSON array with:
- name: string (the place name)
- type: "restaurant" | "hotel" | "museum" | "activity" | "bar" | "cafe" | "shop" | "neighborhood"
- city: string (city or area, if mentioned)
- description: string (any context given about the place)

Return ONLY a JSON array, no markdown or explanation.`,
      },
      { role: 'user', content: text },
    ],
    temperature: 0.1,
  });

  try {
    return JSON.parse(response.choices[0]?.message?.content || '[]');
  } catch {
    return [];
  }
}

export async function generateTasteMatch(placeName: string, placeType: string, userProfile: Record<string, number>) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are Terrazzo's taste intelligence engine. Given a place and a user's taste profile (scored 0-1 across 6 axes: Design, Character, Service, Food, Location, Wellness), generate:
- matchScore: number 0-100 (overall match)
- matchBreakdown: { Design: 0-1, Character: 0-1, Service: 0-1, Food: 0-1, Location: 0-1, Wellness: 0-1 } (how the PLACE scores on each axis)
- tasteNote: string (one-line description of the place's character)
- terrazzoInsight: { why: string (2-3 sentences on why this matches the user), caveat: string (honest heads-up) }

Return ONLY JSON, no markdown.`,
      },
      {
        role: 'user',
        content: `Place: ${placeName} (${placeType})\nUser taste profile: ${JSON.stringify(userProfile)}`,
      },
    ],
    temperature: 0.3,
  });

  try {
    return JSON.parse(response.choices[0]?.message?.content || '{}');
  } catch {
    return null;
  }
}

export default openai;
