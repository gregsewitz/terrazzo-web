import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { validateBody, smartSearchSchema } from '@/lib/api-validation';
import { CLAUDE_SONNET } from '@/lib/models';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are the Terrazzo travel app's collection curator.
The user has a collection of saved places (hotels, restaurants, bars, cafes, museums, activities, neighborhoods, shops).
Each place has: name, type, location (city), source (how it was saved), matchScore (0-100), and a rating reaction (myPlace, enjoyed, mixed, notMe).

Given a natural language query, extract structured filters to search the collection. Return a JSON object with:

{
  "name": "A short, human-readable collection name",
  "emoji": "A single emoji that represents this collection",
  "filters": {
    "types": ["restaurant", "hotel", "bar", "cafe", "museum", "activity"] | null,
    "locations": ["Tokyo", "Paris"] | null,
    "sources": ["maps", "article", "email", "ai", "manual", "instagram"] | null,
    "minMatchScore": 80 | null,
    "reactions": ["myPlace", "enjoyed"] | null,
    "keywords": ["sushi", "cocktails"] | null
  },
  "filterTags": ["type: restaurant", "location: Tokyo"],
  "reasoning": "A warm, friendly one-liner about what Terrazzo picked and why — like a friend explaining their curation"
}

Rules:
- Only include filter fields that are relevant to the query. Use null for irrelevant fields.
- filterTags should be human-readable summaries like "type: hotel", "location: Europe", "person: Lizzie", "reaction: ♡", "match: 80+"
- For vague queries, be generous with interpretation but explain your reasoning in the reasoning field
- The emoji should be the single most representative emoji for the collection
- The name should be concise (2-5 words) and descriptive
- The reasoning should sound like a knowledgeable friend, NOT like a search engine. Write it conversationally — e.g. "Pulled together your favorite restaurants and bars in Tokyo" not "Query specifically targets restaurant and bar types with high match scores"
- Return ONLY the JSON object, no markdown formatting or extra text`;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip + ':ai', { maxRequests: 10, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  try {
    const validation = await validateBody(req, smartSearchSchema);
    if ('error' in validation) {
      return validation.error;
    }
    const { query, places } = validation.data;

    // Build context about the user's actual collection
    let collectionContext = '';
    if (places && Array.isArray(places)) {
      const summary = places.map((p: any) =>
        `${p.name} (${p.type}, ${p.location}${p.matchScore ? `, taste: ${p.matchScore >= 78 ? 'strong match' : p.matchScore >= 65 ? 'good match' : p.matchScore >= 50 ? 'worth a look' : 'mixed fit'}` : ''}${p.source?.name ? `, source: ${p.source.name}` : ''})`
      ).join('\n');
      collectionContext = `\n\nThe user's current collection:\n${summary}`;
    }

    const message = await client.messages.create({
      model: CLAUDE_SONNET,
      max_tokens: 512,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: `Parse this collection query: "${query}"${collectionContext}`,
        },
      ],
    });

    // Extract the text content
    const textBlock = message.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'No response received' }, { status: 500 });
    }

    // Parse the JSON response
    const parsed = JSON.parse(textBlock.text);

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error('Smart search error:', error);

    // Fallback to basic keyword parsing if API fails
    const status = error instanceof Error ? (error as any).status : undefined;
    if (status === 401 || status === 403) {
      return NextResponse.json(
        { error: 'Invalid API key. Check ANTHROPIC_API_KEY in environment variables.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to parse query', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
