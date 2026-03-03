import { NextRequest, NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/auth/nylas/disconnect
 *
 * Disconnects the user's Gmail/Nylas account:
 * - Deletes all NylasGrant records for the user
 * - Clears the nylas_grant_id cookie
 */
export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return unauthorized();

  try {
    // Delete all grants for this user
    const deleted = await prisma.nylasGrant.deleteMany({
      where: { userId: user.id },
    });

    // Clear the cookie
    const res = NextResponse.json({
      success: true,
      deletedGrants: deleted.count,
    });
    res.cookies.set('nylas_grant_id', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
    });

    return res;
  } catch (error) {
    console.error('Nylas disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect email account' },
      { status: 500 }
    );
  }
}
