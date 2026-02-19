import { NextRequest, NextResponse } from 'next/server';
import { searchPlaces, getPhotoUrl, priceLevelToString, mapGoogleTypeToPlaceType } from '@/lib/places';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return NextResponse.json({ results: [] });
    }

    const places = await searchPlaces(query.trim(), 5);

    const results = places.map(p => ({
      id: p.id,
      name: p.displayName?.text || '',
      address: p.formattedAddress || '',
      rating: p.rating || null,
      reviewCount: p.userRatingCount || null,
      priceLevel: priceLevelToString(p.priceLevel),
      category: p.primaryTypeDisplayName?.text || mapGoogleTypeToPlaceType(p.primaryType),
      placeType: mapGoogleTypeToPlaceType(p.primaryType),
      types: p.types || [],
      location: p.location ? { lat: p.location.latitude, lng: p.location.longitude } : null,
      photoUrl: p.photos?.[0]?.name ? getPhotoUrl(p.photos[0].name, 200) : null,
    }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error('Autocomplete error:', err);
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}
