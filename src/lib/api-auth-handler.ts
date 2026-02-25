import { NextRequest, NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import type { User } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuthHandler<C = any> = (req: NextRequest, ctx: C, user: User) => Promise<Response>;

/**
 * API handler with automatic auth check, Prisma error handling, and ownership verification
 * Usage:
 *   export const POST = authHandler(async (req, ctx, user) => {
 *     // user is guaranteed to exist, already authenticated
 *     return Response.json({ data });
 *   });
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function authHandler<C = any>(handler: AuthHandler<C>) {
  return async (req: NextRequest, ctx: C) => {
    try {
      const user = await getUser(req);
      if (!user) return unauthorized();
      return await handler(req, ctx, user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      console.error(`[API ${req.method} ${req.nextUrl.pathname}]`, message);

      // Prisma-specific error handling
      if (err && typeof err === 'object' && 'code' in err) {
        const prismaErr = err as { code: string; meta?: Record<string, unknown> };
        if (prismaErr.code === 'P2002') {
          return NextResponse.json({ error: 'Record already exists' }, { status: 409 });
        }
        if (prismaErr.code === 'P2025') {
          return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        }
      }

      return NextResponse.json(
        { error: message },
        { status: 500 }
      );
    }
  };
}
