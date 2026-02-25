import { describe, it, expect } from 'vitest';
import {
  validateBody,
  placeSchema,
  shortlistCreateSchema,
  shortlistUpdateSchema,
  tripCreateSchema,
  waitlistSchema,
} from '../api-validation';

// ─── validateBody ───────────────────────────────────────────────────────────

describe('validateBody', () => {
  it('returns parsed data for valid input (object form)', async () => {
    const result = await validateBody(
      { email: 'test@example.com' },
      waitlistSchema,
    );
    expect('data' in result).toBe(true);
    if ('data' in result) {
      expect(result.data.email).toBe('test@example.com');
    }
  });

  it('returns error Response for invalid input', async () => {
    const result = await validateBody(
      { email: 'not-an-email' },
      waitlistSchema,
    );
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.status).toBe(400);
      const body = await result.error.json();
      expect(body.error).toBe('Validation failed');
      expect(body.issues).toBeDefined();
      expect(body.issues[0].path).toBe('email');
    }
  });

  it('returns error for missing required fields', async () => {
    const result = await validateBody({}, tripCreateSchema);
    expect('error' in result).toBe(true);
  });

  it('works with Request objects', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const result = await validateBody(req, waitlistSchema);
    expect('data' in result).toBe(true);
  });

  it('returns error for malformed JSON in Request', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const result = await validateBody(req, waitlistSchema);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.status).toBe(400);
    }
  });
});

// ─── Schema Validation ──────────────────────────────────────────────────────

describe('placeSchema', () => {
  it('accepts valid place data', () => {
    const result = placeSchema.safeParse({
      name: 'Aman Tokyo',
      type: 'hotel',
      location: 'Tokyo, Japan',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = placeSchema.safeParse({ name: '', type: 'hotel' });
    expect(result.success).toBe(false);
  });

  it('allows optional fields to be omitted', () => {
    const result = placeSchema.safeParse({ name: 'Test', type: 'restaurant' });
    expect(result.success).toBe(true);
  });

  it('allows null for nullable fields', () => {
    const result = placeSchema.safeParse({
      name: 'Test',
      type: 'restaurant',
      location: null,
      matchScore: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('shortlistCreateSchema', () => {
  it('accepts valid shortlist', () => {
    const result = shortlistCreateSchema.safeParse({ name: 'Best of Tokyo' });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = shortlistCreateSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('accepts optional emoji and placeIds', () => {
    const result = shortlistCreateSchema.safeParse({
      name: 'My List',
      emoji: '🗼',
      placeIds: ['abc', 'def'],
    });
    expect(result.success).toBe(true);
  });
});

describe('shortlistUpdateSchema', () => {
  it('accepts partial updates', () => {
    const result = shortlistUpdateSchema.safeParse({ emoji: '🏖' });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (all fields optional)', () => {
    const result = shortlistUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('tripCreateSchema', () => {
  it('accepts valid trip', () => {
    const result = tripCreateSchema.safeParse({
      name: 'Japan 2026',
      location: 'Tokyo',
      startDate: '2026-03-15',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const result = tripCreateSchema.safeParse({ location: 'Tokyo' });
    expect(result.success).toBe(false);
  });
});

describe('waitlistSchema', () => {
  it('accepts valid email', () => {
    const result = waitlistSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = waitlistSchema.safeParse({ email: 'not-email' });
    expect(result.success).toBe(false);
  });

  it('rejects missing email', () => {
    const result = waitlistSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
