import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');

    if (!code) {
      return NextResponse.redirect(new URL('/profile?error=no_code', request.url));
    }

    // Exchange code for token
    const response = await fetch('https://api.us.nylas.com/v3/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${process.env.NYLAS_CLIENT_ID}:${process.env.NYLAS_API_KEY}`).toString('base64')}`,
      },
      body: JSON.stringify({
        code,
        redirect_uri: process.env.NYLAS_REDIRECT_URI || 'http://localhost:3000/api/auth/nylas/callback',
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      console.error('Token exchange failed:', await response.text());
      return NextResponse.redirect(new URL('/profile?error=token_exchange', request.url));
    }

    const data = await response.json();
    
    // TODO: Store grant in database
    // For now, store in a cookie (temporary)
    const redirectUrl = new URL('/trips', request.url);
    const res = NextResponse.redirect(redirectUrl);
    res.cookies.set('nylas_grant_id', data.grant_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return res;
  } catch (error) {
    console.error('Nylas callback error:', error);
    return NextResponse.redirect(new URL('/profile?error=callback_failed', request.url));
  }
}
