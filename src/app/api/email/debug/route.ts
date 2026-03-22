import { NextRequest, NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import nylas from '@/lib/nylas';

/**
 * GET /api/email/debug
 *
 * Diagnostic endpoint: tries to list the 5 most recent emails
 * with NO search filter to verify Nylas grant has inbox access.
 */
export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return unauthorized();

  try {
    // Resolve grant
    let grantId: string | null = null;

    const grant = await prisma.nylasGrant.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (grant) {
      grantId = grant.grantId;
    } else {
      grantId = request.cookies.get('nylas_grant_id')?.value || null;
    }

    if (!grantId) {
      return NextResponse.json({ error: 'No grant found' }, { status: 400 });
    }

    // Test 1: List recent messages (no search filter)
    let recentMessages;
    let recentError: string | null = null;
    try {
      recentMessages = await nylas.messages.list({
        identifier: grantId,
        queryParams: { limit: 5 },
      });
    } catch (err) {
      recentError = err instanceof Error ? err.message : String(err);
    }

    // Test 2: Try a simple search
    let searchMessages;
    let searchError: string | null = null;
    try {
      searchMessages = await nylas.messages.list({
        identifier: grantId,
        queryParams: {
          limit: 5,
          searchQueryNative: 'subject:confirmation',
        },
      });
    } catch (err) {
      searchError = err instanceof Error ? err.message : String(err);
    }

    // Test 3: Try just "reservation" anywhere
    let reservationMessages;
    let reservationError: string | null = null;
    try {
      reservationMessages = await nylas.messages.list({
        identifier: grantId,
        queryParams: {
          limit: 5,
          searchQueryNative: 'reservation',
        },
      });
    } catch (err) {
      reservationError = err instanceof Error ? err.message : String(err);
    }

    return NextResponse.json({
      grantId,
      tests: {
        recentMessages: {
          count: recentMessages?.data?.length ?? 0,
          error: recentError,
          subjects: recentMessages?.data?.map((m) => ({
            subject: m.subject,
            from: (m.from as Array<{ email: string }>)?.[0]?.email,
            date: m.date ? new Date(m.date * 1000).toISOString() : null,
          })) ?? [],
        },
        searchConfirmation: {
          count: searchMessages?.data?.length ?? 0,
          error: searchError,
          subjects: searchMessages?.data?.map((m) => ({
            subject: m.subject,
            from: (m.from as Array<{ email: string }>)?.[0]?.email,
          })) ?? [],
        },
        searchReservation: {
          count: reservationMessages?.data?.length ?? 0,
          error: reservationError,
          subjects: reservationMessages?.data?.map((m) => ({
            subject: m.subject,
            from: (m.from as Array<{ email: string }>)?.[0]?.email,
          })) ?? [],
        },
      },
    });
  } catch (error) {
    console.error('Email debug error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Debug failed' },
      { status: 500 }
    );
  }
}
