import { NextRequest, NextResponse } from 'next/server';
import { searchPlace, searchPlaces, priceLevelToString, mapGoogleTypeToPlaceType, getPhotoUrl } from '@/lib/places';

export async function POST(request: NextRequest) {
  try {
    const { query, locationBias, multi } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, {
        status: 400,
        headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' }
      });
    }

    if (!process.env.GOOGLE_PLACES_API_KEY) {
      return NextResponse.json({ error: 'Google Places API key not configured' }, {
        status: 500,
        headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' }
      });
    }

    // Multi-result mode for Add Bar blended search
    if (multi) {
      const results = await searchPlaces(query, 5);
      const mapped = results.map(r => ({
        name: r.displayName?.text || '',
        placeId: r.id,
        address: r.formattedAddress,
        type: mapGoogleTypeToPlaceType(r.primaryType),
        lat: r.location?.latitude,
        lng: r.location?.longitude,
        photoUrl: r.photos?.[0]?.name ? getPhotoUrl(r.photos[0].name, 200) : undefined,
      }));
      return NextResponse.json(mapped, {
        headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' }
      });
    }

    // Single-result mode (existing behavior)
    const result = await searchPlace(query, locationBias);

    if (!result) {
      return NextResponse.json({ error: 'No places found' }, {
        status: 404,
        headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' }
      });
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
    }, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' }
    });
  } catch (error) {
    console.error('Places search error:', error);
    return NextResponse.json({ error: 'Search failed' }, {
      status: 500,
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' }
    });
  }
}
