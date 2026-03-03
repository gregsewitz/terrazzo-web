import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';

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
        });
      }
    }

    // Fallback: check cookie (backward compat)
    const cookieGrant = request.cookies.get('nylas_grant_id')?.value;

    return NextResponse.json({
      connected: !!cookieGrant,
      ...(cookieGrant ? { grantId: cookieGrant } : {}),
    });
  } catch (error) {
    console.error('Email status error:', error);
    return NextResponse.json({ connected: false });
  }
}
