import { NextRequest, NextResponse } from 'next/server';
import { parseUrlToPlaces } from '@/lib/openai';

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Fetch article content
    let articleText = '';
    try {
      const response = await fetch(content, {
        headers: { 'User-Agent': 'Terrazzo/1.0' },
      });
      articleText = await response.text();
      // Strip HTML tags for simpler parsing
      articleText = articleText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      // Limit to ~10k chars for GPT-4o
      articleText = articleText.slice(0, 10000);
    } catch {
      return NextResponse.json({ error: 'Failed to fetch URL' }, { status: 400 });
    }

    const extracted = await parseUrlToPlaces(articleText);

    const places = extracted.map((place: Record<string, unknown>, i: number) => ({
      id: `url-${Date.now()}-${i}`,
      name: place.name as string,
      type: place.type as string || 'activity',
      location: place.city as string || '',
      source: { type: 'url' as const, name: new URL(content).hostname.replace('www.', ''), url: content },
      matchScore: 0,
      matchBreakdown: { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0 },
      tasteNote: place.description as string || '',
      status: 'available' as const,
    }));

    return NextResponse.json({ places });
  } catch (error) {
    console.error('URL import error:', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
