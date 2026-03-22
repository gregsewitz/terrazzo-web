import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, rateLimitResponse, getClientIp } from '../rate-limit';

// ─── rateLimit ──────────────────────────────────────────────────────────────

describe('rateLimit', () => {
  // Use unique keys per test to avoid cross-test contamination
  let keyCounter = 0;
  function uniqueKey() { return `test-key-${keyCounter++}-${Date.now()}`; }

  it('allows first request and returns remaining tokens', () => {
    const result = rateLimit(uniqueKey(), { maxRequests: 5, windowMs: 60000 });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4); // 5 - 1
  });

  it('allows requests up to the limit', () => {
    const key = uniqueKey();
    for (let i = 0; i < 5; i++) {
      const result = rateLimit(key, { maxRequests: 5, windowMs: 60000 });
      expect(result.success).toBe(true);
    }
  });

  it('blocks requests beyond the limit', () => {
    const key = uniqueKey();
    for (let i = 0; i < 5; i++) {
      rateLimit(key, { maxRequests: 5, windowMs: 60000 });
    }
    const result = rateLimit(key, { maxRequests: 5, windowMs: 60000 });
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('uses default options when none provided', () => {
    const result = rateLimit(uniqueKey());
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(9); // default maxRequests=10, minus 1
  });

  it('decrements remaining count correctly', () => {
    const key = uniqueKey();
    const r1 = rateLimit(key, { maxRequests: 3, windowMs: 60000 });
    expect(r1.remaining).toBe(2);
    const r2 = rateLimit(key, { maxRequests: 3, windowMs: 60000 });
    expect(r2.remaining).toBe(1);
    const r3 = rateLimit(key, { maxRequests: 3, windowMs: 60000 });
    expect(r3.remaining).toBe(0);
  });

  it('isolates different keys', () => {
    const key1 = uniqueKey();
    const key2 = uniqueKey();
    // Exhaust key1
    for (let i = 0; i < 3; i++) {
      rateLimit(key1, { maxRequests: 3, windowMs: 60000 });
    }
    // key2 should still work
    const result = rateLimit(key2, { maxRequests: 3, windowMs: 60000 });
    expect(result.success).toBe(true);
  });
});

// ─── rateLimitResponse ──────────────────────────────────────────────────────

describe('rateLimitResponse', () => {
  it('returns a 429 status', () => {
    const response = rateLimitResponse();
    expect(response.status).toBe(429);
  });

  it('includes an error message', async () => {
    const response = rateLimitResponse();
    const body = await response.json();
    expect(body.error).toContain('Too many requests');
  });
});

// ─── getClientIp ────────────────────────────────────────────────────────────

describe('getClientIp', () => {
  it('extracts IP from x-forwarded-for header', () => {
    const headers = new Headers({ 'x-forwarded-for': '192.168.1.1, 10.0.0.1' });
    expect(getClientIp(headers)).toBe('192.168.1.1');
  });

  it('falls back to x-real-ip', () => {
    const headers = new Headers({ 'x-real-ip': '10.0.0.5' });
    expect(getClientIp(headers)).toBe('10.0.0.5');
  });

  it('returns anonymous when no IP headers', () => {
    const headers = new Headers();
    expect(getClientIp(headers)).toBe('anonymous');
  });

  it('trims whitespace from forwarded IP', () => {
    const headers = new Headers({ 'x-forwarded-for': '  192.168.1.1  , 10.0.0.1' });
    expect(getClientIp(headers)).toBe('192.168.1.1');
  });
});
