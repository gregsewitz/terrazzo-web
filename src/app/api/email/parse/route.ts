// DEPRECATED: Legacy email parse route. No longer called by any client code.
// Email parsing now uses /api/import with unified extraction.

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Use /api/import instead.' },
    { status: 410 }
  );
}
