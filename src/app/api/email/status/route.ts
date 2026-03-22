import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { CACHE_PRIVATE_REVALIDATE, withCache } from '@/lib/cache-policy';

export async function GET(request: NextRequest) {
  try {
    // Try DB-backed grant first (requires auth)
    const user = await getUser(request).catch(() => null);

    if (user) {
      const grant = await prisma.nylasGrant.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });

      if (grant) {
        return NextResponse.json({
          connected: true,
          email: grant.email,
          provider: grant.provider,
          grantId: grant.grantId,
          connectedAt: grant.createdAt,
        }, {
          headers: withCache({}, CACHE_PRIVATE_REVALIDATE),
        });
      }
    }

    // Fallback: check cookie and migrate to DB if we have a user
    const cookieGrantId = request.cookies.get('nylas_grant_id')?.value;

    if (cookieGrantId && user) {
      // Migrate cookie-only grant to DB
      const migrated = await prisma.nylasGrant.upsert({
        where: { grantId: cookieGrantId },
        create: {
          userId: user.id,
          grantId: cookieGrantId,
          email: user.email || '',
          provider: 'google',
        },
        update: { userId: user.id },
      });
      return NextResponse.json({
        connected: true,
        email: migrated.email || user.email,
        provider: migrated.provider,
        grantId: migrated.grantId,
        connectedAt: migrated.createdAt,
      }, {
        headers: withCache({}, CACHE_PRIVATE_REVALIDATE),
      });
    }

    return NextResponse.json({
      connected: !!cookieGrantId,
      ...(cookieGrantId ? { grantId: cookieGrantId } : {}),
    }, {
      headers: withCache({}, CACHE_PRIVATE_REVALIDATE),
    });
  } catch (error) {
    console.error('Email status error:', error);
    return NextResponse.json({ connected: false });
  }
}
