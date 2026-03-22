import { NextRequest } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { apiHandler } from '@/lib/api-handler';
import Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_SONNET } from '@/lib/models';
import { DreamBoardEntry } from '@/types';

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

/**
 * POST /api/trips/[id]/analyze-dream-board
 *
 * AI-powered analysis of dream board entries during graduation.
 * Extracts place names, identifies bookings, and categorizes notes
 * that the client-side heuristics may have missed.
 *
 * Body: { entries: DreamBoardEntry[], destination: string }
 * Returns: { extractedPlaces, bookings, notes }
 */
export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await getUser(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await req.json();
  const { entries, destination } = body as { entries: DreamBoardEntry[]; destination: string };

  // Verify trip ownership
  const trip = await prisma.trip.findFirst({ where: { id, userId: user.id } });
  if (!trip) return Response.json({ error: 'Trip not found' }, { status: 404 });

  if (!entries?.length) {
    return Response.json({ extractedPlaces: [], bookings: [], notes: [] });
  }

  // Build a text representation of all dream board entries for Claude
  const entryDescriptions = entries.map((e, i) => {
    const parts = [`[Entry ${i + 1}] Type: ${e.type}`];
    if (e.title) parts.push(`Title: "${e.title}"`);
    if (e.content) parts.push(`Content: "${e.content}"`);
    if (e.items?.length) {
      parts.push(`Checklist items: ${e.items.map(it => `"${it.text}"${it.done ? ' (done)' : ''}`).join(', ')}`);
    }
    if (e.section) parts.push(`Section: ${e.section}`);
    return parts.join(' | ');
  }).join('\n');

  const client = getClient();
  const message = await client.messages.create({
    model: CLAUDE_SONNET,
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `You are analyzing dream board entries for a trip to ${destination}. Extract any specific places, bookings, or actionable items.

DREAM BOARD ENTRIES:
${entryDescriptions}

Analyze each entry and return a JSON object with:
{
  "extractedPlaces": [
    {
      "entryIndex": <number>,
      "names": ["Place Name 1", "Place Name 2"],
      "type": "restaurant" | "hotel" | "activity" | "bar" | "cafe" | "shop" | "museum" | "attraction" | "other",
      "confidence": 0.0-1.0,
      "context": "brief context about why this was flagged"
    }
  ],
  "bookings": [
    {
      "entryIndex": <number>,
      "placeName": "Hotel/Restaurant Name",
      "confirmationCode": "ABC123" or null,
      "date": "2025-06-15" or null,
      "time": "20:00" or null,
      "type": "hotel" | "restaurant" | "flight" | "activity" | "other"
    }
  ],
  "notes": [
    {
      "entryIndex": <number>,
      "category": "logistics" | "research" | "personal" | "budget" | "packing",
      "summary": "Brief one-line summary"
    }
  ]
}

Rules:
- Only extract SPECIFIC, NAMED places — not generic descriptions like "a nice restaurant"
- For checklist entries with titles like "Restaurants to try" or "Places to visit", extract each item as a separate place
- Look for confirmation codes in patterns like: CONF: ABC123, #ABC123, Booking: XY-9283, Ref: ABC123
- Look for dates and times associated with bookings (e.g., "dinner at 8pm", "June 15th")
- For text that mentions someone recommending a place (e.g., "Sarah said try Noma"), still extract the place
- For entries with URLs to booking sites, note them as potential bookings
- Mark confidence as 0.9+ for explicit place names, 0.6-0.8 for probable references, below 0.6 for ambiguous
- Categorize remaining non-place entries appropriately under "notes"

Return ONLY valid JSON, no markdown fences.`,
    }],
  });

  // Parse the response
  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  try {
    const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const result = JSON.parse(cleaned);
    return Response.json(result);
  } catch {
    return Response.json({
      extractedPlaces: [],
      bookings: [],
      notes: [],
      parseError: 'Failed to parse AI response',
    });
  }
});
