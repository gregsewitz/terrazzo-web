import { NextRequest, NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/email/scan/[id]/complete
 *
 * Marks a scan as completed. Called by the client after all
 * parse batches have finished (or when resuming a stale scan).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser(request);
  if (!user) return unauthorized();

  const { id } = await params;

  try {
    const scan = await prisma.emailScan.findFirst({
      where: { id, userId: user.id },
    });

    if (!scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    await prisma.emailScan.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Complete scan error:', error);
    return NextResponse.json({ error: 'Failed to complete scan' }, { status: 500 });
  }
}
