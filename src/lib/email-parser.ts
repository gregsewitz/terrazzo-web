/**
 * Email Reservation Parser
 *
 * Uses Claude to extract structured reservation data from confirmation email bodies.
 * Designed for the full travel stack: restaurants, hotels, flights, activities.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ExtractedReservation, EmailParseResult, NylasEmailMessage } from '@/types/email';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

const EXTRACTION_PROMPT = `You are a precise email parser for a travel planning app called Terrazzo. Your job is to extract reservation and booking details from confirmation emails.

For each email, extract ALL reservations/bookings found. A single email might contain multiple reservations (e.g. a multi-leg flight, or a hotel + activity package).

For each reservation, return a JSON object with these fields:

{
  "placeName": "Name of the restaurant, hotel, airline, or activity provider",
  "placeType": "restaurant | hotel | rental | flight | activity | bar | cafe",
  "location": "City or full address if available",
  "reservationDate": "YYYY-MM-DD format, the date of the reservation/check-in/departure",
  "reservationTime": "HH:mm 24h format, if available",
  "partySize": number or null,
  "confirmationNumber": "booking reference if present",
  "provider": "The booking platform (OpenTable, Resy, Booking.com, Airbnb, etc.)",

  // Flight-specific (only for flights)
  "flightNumber": "e.g. UA1234",
  "departureAirport": "IATA code e.g. SFO",
  "arrivalAirport": "IATA code e.g. LHR",
  "departureTime": "HH:mm",
  "arrivalTime": "HH:mm",

  // Hotel-specific
  "checkInDate": "YYYY-MM-DD",
  "checkOutDate": "YYYY-MM-DD",

  // Activity-specific
  "activityDetails": "Brief description, e.g. '2-hour guided walking tour'",

  "confidence": 0.0 to 1.0
}

CONFIDENCE SCORING:
- 1.0: Explicit confirmation email with all details clearly stated
- 0.8-0.9: Confirmation but some details inferred from context
- 0.5-0.7: Likely a booking but some ambiguity (e.g. "thank you for your interest" vs "confirmed")
- Below 0.5: Probably not an actual booking (marketing, cancellation, etc.)

RULES:
- Only extract CONFIRMED bookings. Skip marketing emails, newsletters, "complete your booking" reminders.
- If an email is a CANCELLATION, do NOT extract it as a reservation. Set skipped=true with skipReason="cancellation".
- If an email is a MODIFICATION, extract the updated details (not the original).
- Parse dates carefully — handle formats like "March 14, 2025", "14/03/2025", "2025-03-14", etc.
- For restaurants, infer placeType from context (bar vs restaurant vs cafe).
- IMPORTANT: Distinguish "hotel" from "rental":
  - Use "hotel" for branded hotels and hotel chains (Marriott, Hilton, Hyatt, Four Seasons, boutique hotels, hostels, etc.) — places that are commercial establishments listed on Google Maps.
  - Use "rental" for private vacation rentals and short-term stays (Airbnb, VRBO, Vacasa, Turnkey, Evolve, HomeAway, any private home/apartment/villa/cabin). These are private properties NOT listed as businesses on Google Maps.
  - When the email is from airbnb.com or vrbo.com, the placeType should almost always be "rental" (unless it's an Airbnb Experience, which is "activity").
- Always prefer the venue's actual name over the booking platform name.
- Strip HTML tags from names and locations.

Return a JSON object:
{
  "reservations": [...],
  "skipped": boolean,
  "skipReason": "string or null"
}`;

/**
 * Parse a single email body using Claude to extract reservation data.
 */
export async function parseEmailForReservations(
  email: NylasEmailMessage
): Promise<EmailParseResult> {
  const emailBody = stripHtml(email.body || '');
  const fromEmail = email.from?.[0]?.email || '';
  const fromName = email.from?.[0]?.name || '';

  // Skip obviously irrelevant emails
  if (isLikelyIrrelevant(email.subject || '', fromEmail)) {
    return {
      nylasMessageId: email.id,
      emailSubject: email.subject || '',
      emailFrom: fromEmail,
      emailFromName: fromName,
      emailDate: new Date(email.date * 1000).toISOString(),
      reservations: [],
      skipped: true,
      skipReason: 'Filtered: likely marketing or newsletter',
    };
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Parse this email for travel reservations/bookings.

SUBJECT: ${email.subject || '(no subject)'}
FROM: ${fromName} <${fromEmail}>
DATE: ${new Date(email.date * 1000).toISOString()}

BODY:
${emailBody.slice(0, 8000)}`,
        },
      ],
      system: EXTRACTION_PROMPT,
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        nylasMessageId: email.id,
        emailSubject: email.subject || '',
        emailFrom: fromEmail,
        emailFromName: fromName,
        emailDate: new Date(email.date * 1000).toISOString(),
        reservations: [],
        skipped: true,
        skipReason: 'Claude returned no parseable JSON',
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      reservations: ExtractedReservation[];
      skipped: boolean;
      skipReason?: string;
    };

    return {
      nylasMessageId: email.id,
      emailSubject: email.subject || '',
      emailFrom: fromEmail,
      emailFromName: fromName,
      emailDate: new Date(email.date * 1000).toISOString(),
      reservations: parsed.reservations || [],
      skipped: parsed.skipped || false,
      skipReason: parsed.skipReason || undefined,
    };
  } catch (error) {
    console.error(`Failed to parse email ${email.id}:`, error);
    return {
      nylasMessageId: email.id,
      emailSubject: email.subject || '',
      emailFrom: fromEmail,
      emailFromName: fromName,
      emailDate: new Date(email.date * 1000).toISOString(),
      reservations: [],
      skipped: true,
      skipReason: `Parse error: ${error instanceof Error ? error.message : 'unknown'}`,
    };
  }
}

/**
 * Parse multiple emails in parallel with concurrency control.
 */
export async function parseEmailBatch(
  emails: NylasEmailMessage[],
  concurrency = 3
): Promise<EmailParseResult[]> {
  const results: EmailParseResult[] = new Array(emails.length);
  let idx = 0;

  async function worker() {
    while (idx < emails.length) {
      const i = idx++;
      results[i] = await parseEmailForReservations(emails[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, emails.length) }, () => worker())
  );

  return results;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Rough HTML stripper for email bodies */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Pre-filter obviously irrelevant emails before spending Claude tokens */
function isLikelyIrrelevant(subject: string, fromEmail: string): boolean {
  const lowerSubject = subject.toLowerCase();
  const irrelevantPatterns = [
    'unsubscribe',
    'newsletter',
    'sale ends',
    '% off',
    'flash sale',
    'limited time',
    'don\'t miss',
    'complete your booking', // abandoned cart, not a confirmation
    'still interested',
    'price drop alert',
    'special offer',
    'earn points',
    'reward',
  ];

  return irrelevantPatterns.some((p) => lowerSubject.includes(p));
}
