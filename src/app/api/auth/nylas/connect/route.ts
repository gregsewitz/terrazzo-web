import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const clientId = process.env.NYLAS_CLIENT_ID;
    const redirectUri = process.env.NYLAS_REDIRECT_URI || 'http://localhost:3000/api/auth/nylas/callback';

    if (!clientId) {
      return NextResponse.json({ error: 'Nylas not configured' }, { status: 500 });
    }

    const authUrl = `https://api.us.nylas.com/v3/connect/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&provider=google&access_type=online&scope=https://www.googleapis.com/auth/gmail.readonly`;

    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('Nylas connect error:', error);
    return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 });
  }
}
