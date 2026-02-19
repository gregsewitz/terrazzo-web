// DEPRECATED: This legacy route is no longer used by the client.
// All imports now go through the unified /api/import route with SSE streaming.

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Use /api/import instead.' },
    { status: 410 }
  );
}
