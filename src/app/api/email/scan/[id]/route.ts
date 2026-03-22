import { NextRequest, NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { CACHE_PRIVATE_REVALIDATE, withCache } from '@/lib/cache-policy';

/**
 * GET /api/email/scan/[id]
 *
 * Returns the current status of a specific scan.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser(request);
  if (!user) return unauthorized();

  const { id } = await params;

  try {
    const scan = await prisma.emailScan.findFirst({
      where: { id, userId: user.id },
      include: { _count: { select: { reservations: true } } },
    });

    if (!scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    return NextResponse.json({
      scanId: scan.id,
      status: scan.status,
      emailsFound: scan.emailsFound,
      emailsParsed: scan.emailsParsed,
      reservationsFound: scan._count.reservations,
      errorMessage: scan.errorMessage,
      createdAt: scan.createdAt.toISOString(),
      completedAt: scan.completedAt?.toISOString() || null,
    }, {
      headers: withCache({}, CACHE_PRIVATE_REVALIDATE),
    });
  } catch (error) {
    console.error('Scan status error:', error);
    return NextResponse.json({ error: 'Failed to get scan status' }, { status: 500 });
  }
}
