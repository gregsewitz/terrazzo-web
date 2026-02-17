import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const grantId = request.cookies.get('nylas_grant_id')?.value;
  return NextResponse.json({ connected: !!grantId });
}
