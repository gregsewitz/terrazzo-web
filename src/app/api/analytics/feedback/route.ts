import { NextRequest, NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-auth-handler';
import type { User } from '@prisma/client';

export const POST = authHandler(async (req: NextRequest, _ctx, user: User) => {
  try {
    const body = await req.json();

    // For alpha: log to server console for manual review
    console.log(`[alpha-feedback] User ${user.id} | ${user.email}:`, JSON.stringify({
      ...body,
      userId: user.id,
      email: user.email,
    }, null, 2));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[alpha-feedback] Error:', error);
    return NextResponse.json({ error: 'Failed to record feedback' }, { status: 500 });
  }
});
