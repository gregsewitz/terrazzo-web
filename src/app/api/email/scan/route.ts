import { NextRequest, NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { searchConfirmationEmails } from '@/lib/nylas';
import { RESERVATION_SEARCH_QUERIES } from '@/types/email';

/**
 * POST /api/email/scan
 *
 * Searches Gmail for reservation-like emails via Nylas.
 * Returns immediately with the scan ID and message IDs.
 * The client then drives parsing by calling /api/email/parse in batches.
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
      const cookieGrantId = request.cookies.get('nylas_grant_id')?.value;
      if (!cookieGrantId) {
        return NextResponse.json(
          { error: 'No email account connected. Please connect Gmail first.' },
          { status: 400 }
        );
      }

      resolvedGrant = await prisma.nylasGrant.upsert({
        where: { grantId: cookieGrantId },
        create: { userId: user.id, grantId: cookieGrantId, email: user.email || '', provider: 'google' },
        update: { userId: user.id },
      });
    }

    // ── Create scan record ───────────────────────────────────────────────
    const receivedAfter = Math.floor(Date.now() / 1000) - (sinceDays * 86400);

    const scan = await prisma.emailScan.create({
      data: {
        userId: user.id,
        nylasGrantId: resolvedGrant.id,
        status: 'scanning',
        scanType,
        scanFrom: new Date(receivedAfter * 1000),
        scanTo: new Date(),
      },
    });

    // ── Search for emails ────────────────────────────────────────────────
    const { messages, queriesRun } = await searchConfirmationEmails(
      resolvedGrant.grantId,
      RESERVATION_SEARCH_QUERIES,
      { limit: 25, receivedAfter }
    );

    // Update scan with email count and set to 'parsing' (client will drive)
    const newStatus = messages.length > 0 ? 'parsing' : 'completed';
    await prisma.emailScan.update({
      where: { id: scan.id },
      data: {
        emailsFound: messages.length,
        status: newStatus,
        ...(messages.length === 0 ? { completedAt: new Date() } : {}),
      },
    });

    // Return message IDs so the client can drive parsing
    return NextResponse.json({
      scanId: scan.id,
      status: newStatus,
      emailsFound: messages.length,
      queriesRun,
      messageIds: messages.map(m => m.id),
    });
  } catch (error) {
    console.error('Email scan error:', error);
    return NextResponse.json({ error: 'Failed to scan emails' }, { status: 500 });
  }
}

/**
 * GET /api/email/scan
 *
 * Returns the user's scan history.
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
      },
    });

    return NextResponse.json({
      scans: scans.map((s: any) => ({
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
      })),
    });
  } catch (error) {
    console.error('Email scan history error:', error);
    return NextResponse.json({ error: 'Failed to fetch scan history' }, { status: 500 });
  }
}
