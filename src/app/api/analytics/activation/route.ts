import { NextRequest, NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-auth-handler';
import { prisma } from '@/lib/prisma';
import type { User } from '@prisma/client';

export const POST = authHandler(async (req: NextRequest, _ctx, user: User) => {
  try {
    const body = await req.json();

    // Log activation data for alpha analytics
    console.log(`[activation] User ${user.id} activated:`, JSON.stringify(body, null, 2));

    // Note: The User model in the Prisma schema does not have a metadata field,
    // so we only log to console. This can be extended in the future if needed.
    // The activation data is already being tracked client-side in localStorage
    // and reported server-side for logging and analytics.

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[activation] Error:', error);
    return NextResponse.json(
      { error: 'Failed to record activation' },
      { status: 500 }
    );
  }
});
