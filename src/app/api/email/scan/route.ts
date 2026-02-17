import { NextRequest, NextResponse } from 'next/server';
import { parseEmailToBookings } from '@/lib/anthropic';

export async function POST(request: NextRequest) {
  try {
    const grantId = request.cookies.get('nylas_grant_id')?.value;

    if (!grantId) {
      return NextResponse.json({ error: 'Email not connected. Please connect your Gmail first.' }, { status: 401 });
    }

    if (!process.env.NYLAS_API_KEY) {
      return NextResponse.json({ error: 'Nylas API key not configured' }, { status: 500 });
    }

    // Search for booking emails
    const searchQueries = [
      'subject:reservation',
      'subject:booking confirmation',
      'subject:itinerary',
      'from:resy.com',
      'from:opentable.com',
      'from:booking.com',
      'from:airbnb.com',
    ];

    const allBookings: Array<Record<string, unknown>> = [];

    for (const query of searchQueries.slice(0, 3)) { // Limit to 3 queries for speed
      const response = await fetch(
        `https://api.us.nylas.com/v3/grants/${grantId}/messages?limit=10&search_query_native=${encodeURIComponent(query)}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NYLAS_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) continue;

      const data = await response.json();
      const messages = data.data || [];

      for (const msg of messages.slice(0, 3)) { // Parse first 3 per query
        if (msg.body) {
          const bookings = await parseEmailToBookings(msg.body);
          allBookings.push(...bookings);
        }
      }
    }

    // Convert bookings to ImportedPlace format for trip pool
    const places = allBookings.map((booking: Record<string, unknown>, i: number) => ({
      id: `email-${Date.now()}-${i}`,
      name: booking.name as string || 'Unknown Place',
      type: (booking.type as string) || 'restaurant',
      location: (booking.address as string) || '',
      source: { type: 'email' as const, name: 'Gmail' },
      matchScore: 0,
      matchBreakdown: { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0 },
      tasteNote: '',
      status: 'available' as const,
      enrichment: { confidence: 0.8 },
    }));

    // Also create HistoryItem format for the saved store's history tier
    const detectedSourceMap: Record<string, string> = {
      'opentable': 'OpenTable',
      'resy': 'Resy',
      'booking': 'Hotels.com',
      'airbnb': 'Hotels.com',
      'hotels': 'Hotels.com',
    };
    const historyItems = allBookings.map((booking: Record<string, unknown>, i: number) => {
      const senderEmail = (booking.senderEmail as string) || '';
      let detectedFrom = 'OpenTable';
      for (const [key, label] of Object.entries(detectedSourceMap)) {
        if (senderEmail.toLowerCase().includes(key) || ((booking.name as string) || '').toLowerCase().includes(key)) {
          detectedFrom = label;
          break;
        }
      }
      const bookingType = (booking.type as string) || 'restaurant';
      return {
        id: `hist-email-${Date.now()}-${i}`,
        name: booking.name as string || 'Unknown Place',
        type: bookingType,
        location: (booking.address as string) || (booking.city as string) || '',
        detectedFrom,
        detectedDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        ghostSource: 'email',
      };
    });

    return NextResponse.json({ places, historyItems, rawBookings: allBookings });
  } catch (error) {
    console.error('Email scan error:', error);
    return NextResponse.json({ error: 'Email scan failed' }, { status: 500 });
  }
}
