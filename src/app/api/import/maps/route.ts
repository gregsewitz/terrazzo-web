import { NextRequest, NextResponse } from 'next/server';
import { searchPlace, priceLevelToString } from '@/lib/places';

/**
 * Google Maps import: takes a pasted Google Maps list URL or text containing place names,
 * looks each one up via Google Places API, and returns structured ImportedPlace data.
 */
export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    if (!process.env.GOOGLE_PLACES_API_KEY) {
      return NextResponse.json({ error: 'Google Places API key not configured' }, { status: 500 });
    }

    // Extract place names from the pasted content
    // Handles: Google Maps list URLs (we fetch the page), plain text lists, comma-separated names
    let placeNames: string[] = [];

    // If it looks like a Google Maps URL, try to extract place names from it
    if (content.startsWith('http') && content.includes('google.com/maps')) {
      try {
        const res = await fetch(content, {
          headers: { 'User-Agent': 'Terrazzo/1.0' },
          redirect: 'follow',
        });
        const html = await res.text();
        // Extract place names from Google Maps list page
        // Google Maps lists contain place names in various formats
        const nameMatches = html.match(/"([^"]{3,60})","https:\/\/maps\.google\.com/g);
        if (nameMatches) {
          placeNames = nameMatches
            .map(m => m.replace(/"([^"]+)".*/, '$1'))
            .filter(n => n.length > 2 && n.length < 60);
        }
        // Fallback: try to find place names from structured data
        if (placeNames.length === 0) {
          const titleMatches = html.match(/aria-label="([^"]{3,60})"/g);
          if (titleMatches) {
            placeNames = titleMatches
              .map(m => m.replace(/aria-label="([^"]+)"/, '$1'))
              .filter(n => !n.includes('Google') && n.length > 2);
          }
        }
      } catch {
        // If URL fetch fails, treat the URL itself as not parseable
        return NextResponse.json({ error: 'Could not read Google Maps list. Try pasting place names directly.' }, { status: 400 });
      }
    } else {
      // Plain text: split by newlines, commas, or numbered list patterns
      placeNames = content
        .split(/[\n,]/)
        .map((s: string) => s.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter((s: string) => s.length > 2 && s.length < 100);
    }

    if (placeNames.length === 0) {
      return NextResponse.json({ error: 'No place names found in the content' }, { status: 400 });
    }

    // Limit to 15 places to avoid rate limiting
    const names = placeNames.slice(0, 15);

    // Look up each place via Google Places API
    const places = [];
    for (const name of names) {
      try {
        const result = await searchPlace(name);
        if (result) {
          places.push({
            id: `maps-${Date.now()}-${places.length}`,
            name: result.displayName?.text || name,
            type: mapGoogleTypeToPlaceType(result.primaryType || result.types?.[0]),
            location: result.formattedAddress || '',
            source: { type: 'google-maps' as const, name: 'Google Maps' },
            matchScore: 0,
            matchBreakdown: { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0 },
            tasteNote: '',
            status: 'available' as const,
            google: {
              rating: result.rating,
              reviewCount: result.userRatingCount,
              category: result.primaryTypeDisplayName?.text || result.primaryType,
              priceLevel: priceLevelToString(result.priceLevel) ? priceLevelToString(result.priceLevel).length : undefined,
              hours: result.regularOpeningHours?.weekdayDescriptions,
              address: result.formattedAddress,
              lat: result.location?.latitude,
              lng: result.location?.longitude,
            },
            ghostSource: 'maps' as const,
          });
        }
      } catch {
        // Skip individual failures
        console.warn(`Failed to look up: ${name}`);
      }
    }

    return NextResponse.json({ places });
  } catch (error) {
    console.error('Maps import error:', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}

function mapGoogleTypeToPlaceType(googleType?: string): string {
  if (!googleType) return 'activity';
  const type = googleType.toLowerCase();
  if (type.includes('restaurant') || type.includes('food')) return 'restaurant';
  if (type.includes('bar') || type.includes('night_club') || type.includes('pub')) return 'bar';
  if (type.includes('cafe') || type.includes('coffee') || type.includes('bakery')) return 'cafe';
  if (type.includes('hotel') || type.includes('lodging') || type.includes('resort')) return 'hotel';
  if (type.includes('museum') || type.includes('art_gallery') || type.includes('church') || type.includes('landmark')) return 'museum';
  if (type.includes('store') || type.includes('shop') || type.includes('market')) return 'shop';
  if (type.includes('park') || type.includes('neighborhood') || type.includes('locality')) return 'neighborhood';
  return 'activity';
}
