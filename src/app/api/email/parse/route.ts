import { NextRequest, NextResponse } from 'next/server';
import { parseEmailToBookings } from '@/lib/anthropic';

export async function POST(request: NextRequest) {
  try {
    const { htmlBody } = await request.json();

    if (!htmlBody) {
      return NextResponse.json({ error: 'Email body is required' }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 });
    }

    const bookings = await parseEmailToBookings(htmlBody);
    return NextResponse.json({ bookings });
  } catch (error) {
    console.error('Email parse error:', error);
    return NextResponse.json({ error: 'Parse failed' }, { status: 500 });
  }
}
