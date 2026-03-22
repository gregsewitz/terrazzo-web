import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.NYLAS_CLIENT_ID;
    const redirectUri = process.env.NYLAS_REDIRECT_URI || 'http://localhost:3000/api/auth/nylas/callback';

    if (!clientId) {
      return NextResponse.json({ error: 'Nylas not configured' }, { status: 500 });
    }

    // Pass return_to through the OAuth state param so callback knows where to redirect
    const returnTo = request.nextUrl.searchParams.get('return_to') || '';
    const state = returnTo ? encodeURIComponent(returnTo) : '';

    const authUrl = `https://api.us.nylas.com/v3/connect/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&provider=google&access_type=online&scope=https://www.googleapis.com/auth/gmail.readonly${state ? `&state=${state}` : ''}`;

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Nylas connect error:', error);
    return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 });
  }
}
