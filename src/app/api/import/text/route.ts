import { NextRequest, NextResponse } from 'next/server';
import { parseTextToPlaces } from '@/lib/openai';

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'Text content is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const extracted = await parseTextToPlaces(content);

    const places = extracted.map((place: Record<string, unknown>, i: number) => ({
      id: `text-${Date.now()}-${i}`,
      name: place.name as string,
      type: place.type as string || 'activity',
      location: place.city as string || '',
      source: { type: 'text' as const, name: 'Pasted List' },
      matchScore: 0,
      matchBreakdown: { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0 },
      tasteNote: place.description as string || '',
      status: 'available' as const,
    }));

    return NextResponse.json({ places });
  } catch (error) {
    console.error('Text import error:', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
