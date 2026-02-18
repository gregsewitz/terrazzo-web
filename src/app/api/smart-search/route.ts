import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are the Terrazzo travel app's collection curator.
The user has a collection of saved places (hotels, restaurants, bars, cafes, museums, activities, neighborhoods, shops).
Each place has: name, type, location (city), source (how it was saved), matchScore (0-100), friendAttribution (who recommended it), and a rating reaction (myPlace, enjoyed, mixed, notMe).

Given a natural language query, extract structured filters to search the collection. Return a JSON object with:

{
  "name": "A short, human-readable collection name",
  "emoji": "A single emoji that represents this collection",
  "filters": {
    "types": ["restaurant", "hotel", "bar", "cafe", "museum", "activity"] | null,
    "locations": ["Tokyo", "Paris"] | null,
    "friends": ["Lizzie", "Marco"] | null,
    "sources": ["friend", "maps", "article", "email", "ai", "manual", "instagram"] | null,
    "minMatchScore": 80 | null,
    "reactions": ["myPlace", "enjoyed"] | null,
    "keywords": ["sushi", "cocktails"] | null
  },
  "filterTags": ["type: restaurant", "location: Tokyo", "person: Lizzie"],
  "reasoning": "Brief explanation of how you interpreted the query"
}

Rules:
- Only include filter fields that are relevant to the query. Use null for irrelevant fields.
- filterTags should be human-readable summaries like "type: hotel", "location: Europe", "person: Lizzie", "reaction: ♡", "match: 80+"
- For vague queries, be generous with interpretation but explain your reasoning
- The emoji should be the single most representative emoji for the collection
- The name should be concise (2-5 words) and descriptive
- Return ONLY the JSON object, no markdown formatting or extra text`;

export async function POST(req: NextRequest) {
  try {
    const { query, places } = await req.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Build context about the user's actual collection
    let collectionContext = '';
    if (places && Array.isArray(places)) {
      const summary = places.map((p: any) =>
        `${p.name} (${p.type}, ${p.location}${p.friendAttribution ? `, from ${p.friendAttribution.name}` : ''}${p.matchScore ? `, ${p.matchScore}% match` : ''}${p.ghostSource ? `, source: ${p.ghostSource}` : ''})`
      ).join('\n');
      collectionContext = `\n\nThe user's current collection:\n${summary}`;
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
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
  } catch (error: any) {
    console.error('Smart search error:', error);

    // Fallback to basic keyword parsing if API fails
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json(
        { error: 'Invalid API key. Check ANTHROPIC_API_KEY in environment variables.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to parse query', details: error.message },
      { status: 500 }
    );
  }
}
