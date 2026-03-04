import { NextRequest, NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/email/reservations/batch-dismiss
 *
 * Batch-dismiss selected email reservations.
 *
 * Body:
 *   { reservationIds: string[] }
 */
export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const { reservationIds } = body as { reservationIds: string[] };

    if (!reservationIds?.length) {
      return NextResponse.json({ error: 'No reservation IDs provided' }, { status: 400 });
    }

    // Batch update — only dismiss pending reservations owned by user
    const result = await prisma.emailReservation.updateMany({
      where: {
        id: { in: reservationIds },
        userId: user.id,
        status: 'pending',
      },
      data: {
        status: 'dismissed',
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json({
      dismissed: result.count,
    });
  } catch (error) {
    console.error('Batch dismiss error:', error);
    return NextResponse.json({ error: 'Batch dismiss failed' }, { status: 500 });
  }
}
