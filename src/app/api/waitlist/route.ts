import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateBody, waitlistSchema } from '@/lib/api-validation';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await validateBody(body, waitlistSchema);
    if ('error' in result) return result.error;

    const { data } = result;
    const email = data.email.trim().toLowerCase();

    // Check for existing entry
    const existing = await prisma.waitlistEntry.findUnique({ where: { email } });
    if (existing) {
      // Don't reveal that they're already on the list — just confirm
      return NextResponse.json({ success: true, message: 'You are on the list.' });
    }

    await prisma.waitlistEntry.create({
      data: {
        email,
        referralSource: body.referralSource || null,
      },
    });

    return NextResponse.json({ success: true, message: 'You are on the list.' });
  } catch (err) {
    console.error('[waitlist] Error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
