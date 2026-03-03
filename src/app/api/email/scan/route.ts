import { NextRequest, NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { searchConfirmationEmails } from '@/lib/nylas';
import { RESERVATION_SEARCH_QUERIES } from '@/types/email';

/**
 * POST /api/email/scan
 *
 * Triggers a new email scan. Searches for confirmation/booking emails
 * via Nylas and stores raw results in an EmailScan record.
 *
 * Body (optional):
 *   { scanType?: 'full' | 'incremental', sinceDays?: number }
 *
 * Returns the scan record with found messages ready for parsing.
 */
export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json().catch(() => ({}));
    const scanType = body.scanType || 'full';
    const sinceDays = body.sinceDays || (scanType === 'incremental' ? 30 : 365);

    // ── Resolve Nylas grant ──────────────────────────────────────────────
    const grant = await prisma.nylasGrant.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    let resolvedGrant = grant;

    if (!resolvedGrant) {
      // Fallback: check cookie and create DB record
      const cookieGrantId = request.cookies.get('nylas_grant_id')?.value;
      if (!cookieGrantId) {
        return NextResponse.json(
          { error: 'No email account connected. Please connect Gmail first.' },
          { status: 400 }
        );
      }

      // Migrate cookie-only grant to DB
      resolvedGrant = await prisma.nylasGrant.upsert({
        where: { grantId: cookieGrantId },
        create: {
          userId: user.id,
          grantId: cookieGrantId,
          email: user.email || '',
          provider: 'google',
        },
        update: { userId: user.id },
      });
    }

    // ── Create scan record ───────────────────────────────────────────────
    const receivedAfter = Math.floor(Date.now() / 1000) - (sinceDays * 86400);
    const scanFrom = new Date(receivedAfter * 1000);

    const scan = await prisma.emailScan.create({
      data: {
        userId: user.id,
        nylasGrantId: resolvedGrant.id,
        status: 'running',
        scanType,
        scanFrom,
        scanTo: new Date(),
      },
    });

    // ── Search for confirmation emails ───────────────────────────────────
    const { messages, queriesRun } = await searchConfirmationEmails(
      resolvedGrant.grantId,
      RESERVATION_SEARCH_QUERIES,
      { limit: 25, receivedAfter }
    );

    // ── Update scan with results ─────────────────────────────────────────
    await prisma.emailScan.update({
      where: { id: scan.id },
      data: {
        status: 'completed',
        emailsFound: messages.length,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      scanId: scan.id,
      status: 'completed',
      emailsFound: messages.length,
      queriesRun,
      messages: messages.map((m) => ({
        id: m.id,
        subject: m.subject,
        from: m.from,
        date: new Date(m.date * 1000).toISOString(),
        snippet: m.snippet,
      })),
    });
  } catch (error) {
    console.error('Email scan error:', error);
    return NextResponse.json(
      { error: 'Failed to scan emails' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/email/scan
 *
 * Returns the user's scan history with reservation counts.
 */
export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return unauthorized();

  try {
    const scans = await prisma.emailScan.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        _count: { select: { reservations: true } },
        reservations: {
          orderBy: { reservationDate: 'asc' },
          select: {
            id: true,
            status: true,
            placeName: true,
            placeType: true,
            location: true,
            reservationDate: true,
            provider: true,
            confidence: true,
            matchedTripName: true,
          },
        },
      },
    });

    return NextResponse.json({
      scans: scans.map((s) => ({
        id: s.id,
        status: s.status,
        scanType: s.scanType,
        emailsFound: s.emailsFound,
        emailsParsed: s.emailsParsed,
        reservationsFound: s._count.reservations,
        scanFrom: s.scanFrom?.toISOString(),
        scanTo: s.scanTo?.toISOString(),
        createdAt: s.createdAt.toISOString(),
        completedAt: s.completedAt?.toISOString(),
        reservations: s.reservations,
      })),
    });
  } catch (error) {
    console.error('Email scan history error:', error);
    return NextResponse.json({ error: 'Failed to fetch scan history' }, { status: 500 });
  }
}
