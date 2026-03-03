import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');

    if (!code) {
      return NextResponse.redirect(new URL('/profile?error=no_code', request.url));
    }

    // Exchange code for token via Nylas API
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
    const grantId = data.grant_id;
    const email = data.email || '';

    // ── Persist grant to database ──────────────────────────────────────────
    // Try to get the authenticated user from the Authorization header (forwarded
    // via state param or cookie). If we can't resolve a user, fall back to the
    // cookie-only approach so the OAuth flow never breaks.
    const user = await getUser(request).catch(() => null);

    if (user) {
      await prisma.nylasGrant.upsert({
        where: { grantId },
        create: {
          userId: user.id,
          grantId,
          email,
          provider: 'google',
        },
        update: {
          email,
          provider: 'google',
        },
      });
    }

    // ── Also set httpOnly cookie (session fallback) ────────────────────────
    const redirectUrl = new URL('/trips?email_connected=1', request.url);
    const res = NextResponse.redirect(redirectUrl);
    res.cookies.set('nylas_grant_id', grantId, {
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
