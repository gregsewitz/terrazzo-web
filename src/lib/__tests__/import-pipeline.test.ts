import { describe, it, expect } from 'vitest';
import {
  parallelMap,
  detectInputType,
  normalizeForDedup,
  deduplicatePlaces,
} from '../import-pipeline';

// ─── detectInputType ────────────────────────────────────────────────────────

describe('detectInputType', () => {
  it('detects Google Maps URLs', () => {
    expect(detectInputType('https://www.google.com/maps/place/Tokyo')).toBe('google-maps');
    expect(detectInputType('https://maps.app.goo.gl/abc123')).toBe('google-maps');
    expect(detectInputType('http://google.com/maps/@35.6,139.7')).toBe('google-maps');
  });

  it('detects regular URLs', () => {
    expect(detectInputType('https://cntraveler.com/best-hotels-tokyo')).toBe('url');
    expect(detectInputType('http://example.com/article')).toBe('url');
    expect(detectInputType('www.tripadvisor.com/Hotel')).toBe('url');
  });

  it('detects plain text', () => {
    expect(detectInputType('Aman Tokyo, Park Hyatt, Hoshinoya')).toBe('text');
    expect(detectInputType('Best restaurants in Kyoto')).toBe('text');
    expect(detectInputType('')).toBe('text');
  });

  it('is case insensitive for URLs', () => {
    expect(detectInputType('HTTPS://WWW.GOOGLE.COM/MAPS/PLACE/Test')).toBe('google-maps');
    expect(detectInputType('HTTP://EXAMPLE.COM')).toBe('url');
  });
});

// ─── normalizeForDedup ──────────────────────────────────────────────────────

describe('normalizeForDedup', () => {
  it('lowercases input', () => {
    expect(normalizeForDedup('Aman Tokyo')).toBe('aman tokyo');
  });

  it('removes special characters', () => {
    expect(normalizeForDedup("L'Atelier de Joël Robuchon")).toBe('latelier de jol robuchon');
  });

  it('collapses whitespace', () => {
    expect(normalizeForDedup('  Aman   Tokyo  ')).toBe('aman tokyo');
  });

  it('handles empty string', () => {
    expect(normalizeForDedup('')).toBe('');
  });
});

// ─── deduplicatePlaces ──────────────────────────────────────────────────────

describe('deduplicatePlaces', () => {
  it('removes exact name duplicates', () => {
    const places = [
      { name: 'Aman Tokyo', type: 'hotel', city: 'Tokyo' },
      { name: 'Aman Tokyo', type: 'hotel', city: 'Tokyo' },
    ];
    const result = deduplicatePlaces(places);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Aman Tokyo');
  });

  it('treats different-case names as duplicates', () => {
    const places = [
      { name: 'aman tokyo', type: 'hotel', city: 'Tokyo' },
      { name: 'Aman Tokyo', type: 'hotel', city: 'Tokyo' },
    ];
    const result = deduplicatePlaces(places);
    expect(result).toHaveLength(1);
  });

  it('keeps the longer description when merging', () => {
    const places = [
      { name: 'Aman Tokyo', type: 'hotel', city: 'Tokyo', description: 'Short' },
      { name: 'Aman Tokyo', type: 'hotel', city: 'Tokyo', description: 'A much longer and more detailed description of this hotel' },
    ];
    const result = deduplicatePlaces(places);
    expect(result).toHaveLength(1);
    expect(result[0].description).toContain('much longer');
  });

  it('merges userContext from both entries', () => {
    const places = [
      { name: 'Aman', type: 'hotel', city: 'Tokyo', userContext: 'Anniversary trip' },
      { name: 'Aman', type: 'hotel', city: 'Tokyo', userContext: 'Spa weekend' },
    ];
    const result = deduplicatePlaces(places);
    expect(result).toHaveLength(1);
    expect(result[0].userContext).toContain('Anniversary trip');
    expect(result[0].userContext).toContain('Spa weekend');
  });

  it('preserves unique entries', () => {
    const places = [
      { name: 'Aman Tokyo', type: 'hotel', city: 'Tokyo' },
      { name: 'Park Hyatt', type: 'hotel', city: 'Tokyo' },
      { name: 'Hoshinoya', type: 'hotel', city: 'Kyoto' },
    ];
    const result = deduplicatePlaces(places);
    expect(result).toHaveLength(3);
  });

  it('handles empty array', () => {
    expect(deduplicatePlaces([])).toHaveLength(0);
  });

  it('fills in missing timing/travelWith from duplicate', () => {
    const places = [
      { name: 'Aman', type: 'hotel', city: 'Tokyo' },
      { name: 'Aman', type: 'hotel', city: 'Tokyo', timing: 'March', travelWith: 'Partner' },
    ];
    const result = deduplicatePlaces(places);
    expect(result).toHaveLength(1);
    expect(result[0].timing).toBe('March');
    expect(result[0].travelWith).toBe('Partner');
  });
});

// ─── parallelMap ────────────────────────────────────────────────────────────

describe('parallelMap', () => {
  it('maps all items with results in order', async () => {
    const items = [1, 2, 3, 4, 5];
    const result = await parallelMap(items, async (x) => x * 2, 3);
    expect(result).toEqual([2, 4, 6, 8, 10]);
  });

  it('respects concurrency limit', async () => {
    let maxConcurrent = 0;
    let current = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);

    await parallelMap(items, async () => {
      current++;
      maxConcurrent = Math.max(maxConcurrent, current);
      await new Promise(r => setTimeout(r, 10));
      current--;
    }, 3);

    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  it('handles empty array', async () => {
    const result = await parallelMap([], async (x: number) => x, 3);
    expect(result).toEqual([]);
  });

  it('handles single item', async () => {
    const result = await parallelMap([42], async (x) => x + 1, 3);
    expect(result).toEqual([43]);
  });

  it('propagates errors from worker functions', async () => {
    await expect(
      parallelMap([1, 2, 3], async (x) => {
        if (x === 2) throw new Error('fail');
        return x;
      }, 2)
    ).rejects.toThrow('fail');
  });
});
