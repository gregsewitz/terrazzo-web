import { NextResponse } from 'next/server';

/**
 * @deprecated Use /api/import/maps-list instead.
 *
 * This endpoint used fragile HTML scraping with regex to extract place names
 * from Google Maps URLs. It has been replaced by /api/import/maps-list which
 * uses Google's internal entitylist API for reliable, fast extraction.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Use /api/import/maps-list instead.' },
    { status: 410 },
  );
}
