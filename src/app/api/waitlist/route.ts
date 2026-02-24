import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body.email || '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

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
