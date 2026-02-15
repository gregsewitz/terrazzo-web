import { NextRequest, NextResponse } from 'next/server';
import { searchPlace, priceLevelToString } from '@/lib/places';

export async function POST(request: NextRequest) {
  try {
    const { query, locationBias } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    if (!process.env.GOOGLE_PLACES_API_KEY) {
      return NextResponse.json({ error: 'Google Places API key not configured' }, { status: 500 });
    }

    const result = await searchPlace(query, locationBias);

    if (!result) {
      return NextResponse.json({ error: 'No places found' }, { status: 404 });
    }

    return NextResponse.json({
      id: result.id,
      name: result.displayName?.text,
      address: result.formattedAddress,
      rating: result.rating,
      reviewCount: result.userRatingCount,
      priceLevel: priceLevelToString(result.priceLevel),
      category: result.primaryTypeDisplayName?.text || result.primaryType,
      hours: result.regularOpeningHours?.weekdayDescriptions,
      location: result.location ? {
        lat: result.location.latitude,
        lng: result.location.longitude,
      } : null,
      types: result.types,
    });
  } catch (error) {
    console.error('Places search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
