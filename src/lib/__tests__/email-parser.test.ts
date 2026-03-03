import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NylasEmailMessage } from '@/types/email';

// ─── Mock Anthropic SDK ─────────────────────────────────────────────────────

const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

// Import AFTER mock is registered
const { parseEmailForReservations, parseEmailBatch } = await import('../email-parser');

// ─── Test Fixtures ──────────────────────────────────────────────────────────

function makeEmail(overrides: Partial<NylasEmailMessage> = {}): NylasEmailMessage {
  return {
    id: 'msg-1',
    grantId: 'grant-test-123',
    subject: 'Your reservation is confirmed!',
    from: [{ name: 'OpenTable', email: 'reservations@opentable.com' }],
    to: [{ name: 'Greg', email: 'greg@example.com' }],
    date: Math.floor(new Date('2026-06-01T12:00:00Z').getTime() / 1000),
    body: '<p>Your reservation at <b>Ristorante Da Mario</b> is confirmed for June 12 at 7:30 PM. Party of 4. Confirmation #RT8832.</p>',
    snippet: 'Your reservation at Ristorante Da Mario is confirmed...',
    ...overrides,
  };
}

function mockClaudeResponse(json: Record<string, unknown>) {
  mockCreate.mockResolvedValueOnce({
    content: [
      {
        type: 'text',
        text: JSON.stringify(json),
      },
    ],
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('parseEmailForReservations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('pre-filtering (isLikelyIrrelevant)', () => {
    it('skips newsletters without calling Claude', async () => {
      const email = makeEmail({ subject: 'Our weekly newsletter — travel tips!' });
      const result = await parseEmailForReservations(email);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain('marketing');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('skips sale emails without calling Claude', async () => {
      const email = makeEmail({ subject: 'Flash sale: 50% off hotels!' });
      const result = await parseEmailForReservations(email);
      expect(result.skipped).toBe(true);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('skips "complete your booking" emails', async () => {
      const email = makeEmail({ subject: 'Complete your booking at Marriott' });
      const result = await parseEmailForReservations(email);
      expect(result.skipped).toBe(true);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('skips "% off" promotional emails', async () => {
      const email = makeEmail({ subject: 'Get 25% off your next stay!' });
      const result = await parseEmailForReservations(email);
      expect(result.skipped).toBe(true);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('does NOT skip legitimate confirmation emails', async () => {
      mockClaudeResponse({
        reservations: [],
        skipped: true,
        skipReason: 'No reservations found',
      });
      const email = makeEmail({ subject: 'Your reservation is confirmed!' });
      await parseEmailForReservations(email);
      expect(mockCreate).toHaveBeenCalledOnce();
    });
  });

  describe('Claude extraction', () => {
    it('extracts a restaurant reservation', async () => {
      mockClaudeResponse({
        reservations: [
          {
            placeName: 'Ristorante Da Mario',
            placeType: 'restaurant',
            location: 'Rome, Italy',
            reservationDate: '2026-06-12',
            reservationTime: '19:30',
            partySize: 4,
            confirmationNumber: 'RT8832',
            provider: 'OpenTable',
            confidence: 0.95,
          },
        ],
        skipped: false,
      });

      const result = await parseEmailForReservations(makeEmail());
      expect(result.skipped).toBe(false);
      expect(result.reservations).toHaveLength(1);
      expect(result.reservations[0].placeName).toBe('Ristorante Da Mario');
      expect(result.reservations[0].placeType).toBe('restaurant');
      expect(result.reservations[0].partySize).toBe(4);
      expect(result.reservations[0].confidence).toBe(0.95);
    });

    it('extracts a flight reservation', async () => {
      mockClaudeResponse({
        reservations: [
          {
            placeName: 'United Airlines',
            placeType: 'flight',
            location: null,
            reservationDate: '2026-06-10',
            flightNumber: 'UA1234',
            departureAirport: 'SFO',
            arrivalAirport: 'FCO',
            departureTime: '18:00',
            arrivalTime: '14:00',
            confirmationNumber: 'ABC123',
            provider: 'United',
            confidence: 1.0,
          },
        ],
        skipped: false,
      });

      const email = makeEmail({
        subject: 'United Airlines - Flight Confirmation',
        from: [{ name: 'United Airlines', email: 'no-reply@united.com' }],
      });
      const result = await parseEmailForReservations(email);
      expect(result.reservations[0].flightNumber).toBe('UA1234');
      expect(result.reservations[0].departureAirport).toBe('SFO');
      expect(result.reservations[0].arrivalAirport).toBe('FCO');
    });

    it('extracts a hotel reservation', async () => {
      mockClaudeResponse({
        reservations: [
          {
            placeName: 'Hotel Colosseum',
            placeType: 'hotel',
            location: 'Rome, Italy',
            checkInDate: '2026-06-11',
            checkOutDate: '2026-06-14',
            confirmationNumber: 'BK-998877',
            provider: 'Booking.com',
            confidence: 0.9,
          },
        ],
        skipped: false,
      });

      const email = makeEmail({
        subject: 'Booking Confirmation — Hotel Colosseum',
        from: [{ name: 'Booking.com', email: 'noreply@booking.com' }],
      });
      const result = await parseEmailForReservations(email);
      expect(result.reservations[0].checkInDate).toBe('2026-06-11');
      expect(result.reservations[0].checkOutDate).toBe('2026-06-14');
    });

    it('extracts multiple reservations from one email', async () => {
      mockClaudeResponse({
        reservations: [
          {
            placeName: 'Delta Airlines',
            placeType: 'flight',
            flightNumber: 'DL100',
            departureAirport: 'JFK',
            arrivalAirport: 'FCO',
            reservationDate: '2026-06-10',
            confidence: 1.0,
          },
          {
            placeName: 'Delta Airlines',
            placeType: 'flight',
            flightNumber: 'DL101',
            departureAirport: 'FCO',
            arrivalAirport: 'JFK',
            reservationDate: '2026-06-17',
            confidence: 1.0,
          },
        ],
        skipped: false,
      });

      const result = await parseEmailForReservations(makeEmail());
      expect(result.reservations).toHaveLength(2);
    });

    it('handles cancellation emails (skipped by Claude)', async () => {
      mockClaudeResponse({
        reservations: [],
        skipped: true,
        skipReason: 'cancellation',
      });

      const email = makeEmail({ subject: 'Your reservation has been cancelled' });
      const result = await parseEmailForReservations(email);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe('cancellation');
      expect(result.reservations).toHaveLength(0);
    });
  });

  describe('response metadata', () => {
    it('populates email provenance fields correctly', async () => {
      mockClaudeResponse({ reservations: [], skipped: true });

      const email = makeEmail({
        id: 'msg-42',
        subject: 'Booking Confirmed',
        from: [{ name: 'Resy', email: 'no-reply@resy.com' }],
        date: Math.floor(new Date('2026-05-15T10:00:00Z').getTime() / 1000),
      });
      const result = await parseEmailForReservations(email);

      expect(result.nylasMessageId).toBe('msg-42');
      expect(result.emailSubject).toBe('Booking Confirmed');
      expect(result.emailFrom).toBe('no-reply@resy.com');
      expect(result.emailFromName).toBe('Resy');
      expect(result.emailDate).toBe('2026-05-15T10:00:00.000Z');
    });

    it('handles missing from field', async () => {
      mockClaudeResponse({ reservations: [], skipped: true });

      const email = makeEmail({ from: [] });
      const result = await parseEmailForReservations(email);
      expect(result.emailFrom).toBe('');
      expect(result.emailFromName).toBe('');
    });
  });

  describe('error handling', () => {
    it('returns skipped result when Claude returns non-JSON', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'I cannot parse this email.' }],
      });

      const result = await parseEmailForReservations(makeEmail());
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain('no parseable JSON');
    });

    it('returns skipped result when Claude call fails', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API rate limit'));

      const result = await parseEmailForReservations(makeEmail());
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain('API rate limit');
    });

    it('handles Claude response wrapped in markdown code block', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: '```json\n{"reservations": [{"placeName":"Test","placeType":"restaurant","confidence":0.8}], "skipped": false}\n```',
          },
        ],
      });

      const result = await parseEmailForReservations(makeEmail());
      expect(result.skipped).toBe(false);
      expect(result.reservations).toHaveLength(1);
      expect(result.reservations[0].placeName).toBe('Test');
    });
  });

  describe('HTML stripping (via body processing)', () => {
    it('strips HTML tags from email body before sending to Claude', async () => {
      mockClaudeResponse({ reservations: [], skipped: true });

      const email = makeEmail({
        body: '<html><body><style>.foo{}</style><p>Hello <b>World</b></p></body></html>',
      });
      await parseEmailForReservations(email);

      // Verify the body sent to Claude has HTML stripped
      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages[0].content as string;
      expect(userMessage).not.toContain('<p>');
      expect(userMessage).not.toContain('<b>');
      expect(userMessage).not.toContain('<style>');
      expect(userMessage).toContain('Hello');
      expect(userMessage).toContain('World');
    });
  });
});

describe('parseEmailBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes multiple emails and returns results in order', async () => {
    // First email: restaurant
    mockClaudeResponse({
      reservations: [{ placeName: 'Place A', placeType: 'restaurant', confidence: 0.9 }],
      skipped: false,
    });
    // Second email: hotel
    mockClaudeResponse({
      reservations: [{ placeName: 'Place B', placeType: 'hotel', confidence: 0.85 }],
      skipped: false,
    });

    const emails = [
      makeEmail({ id: 'msg-a', subject: 'Reservation confirmed at Place A' }),
      makeEmail({ id: 'msg-b', subject: 'Booking confirmed at Place B' }),
    ];

    const results = await parseEmailBatch(emails, 2);
    expect(results).toHaveLength(2);
    expect(results[0].nylasMessageId).toBe('msg-a');
    expect(results[0].reservations[0].placeName).toBe('Place A');
    expect(results[1].nylasMessageId).toBe('msg-b');
    expect(results[1].reservations[0].placeName).toBe('Place B');
  });

  it('handles mixed pre-filtered and parsed emails', async () => {
    // Only the non-newsletter email will call Claude
    mockClaudeResponse({
      reservations: [{ placeName: 'Place C', placeType: 'activity', confidence: 0.8 }],
      skipped: false,
    });

    const emails = [
      makeEmail({ id: 'msg-news', subject: 'Our weekly newsletter' }),
      makeEmail({ id: 'msg-real', subject: 'Activity confirmed' }),
    ];

    const results = await parseEmailBatch(emails, 2);
    expect(results).toHaveLength(2);
    expect(results[0].skipped).toBe(true); // newsletter filtered
    expect(results[1].skipped).toBe(false); // parsed by Claude
    expect(mockCreate).toHaveBeenCalledOnce(); // only 1 Claude call
  });

  it('returns empty array for empty input', async () => {
    const results = await parseEmailBatch([], 3);
    expect(results).toHaveLength(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
