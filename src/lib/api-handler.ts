import { NextRequest, NextResponse } from 'next/server';

/**
 * Wrap an API route handler with standardized error handling.
 * Catches all errors and returns proper JSON responses instead of 500s.
 *
 * Usage:
 *   export const POST = apiHandler(async (req) => {
 *     // ... your route logic
 *     return Response.json({ data });
 *   });
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function apiHandler<C = any>(
  handler: (req: NextRequest, ctx: C) => Promise<Response>
) {
  return async (req: NextRequest, ctx: C) => {
    try {
      return await handler(req, ctx);
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
