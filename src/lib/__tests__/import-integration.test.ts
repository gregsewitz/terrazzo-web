/**
 * Smart Import Integration Tests
 *
 * These tests exercise the real import pipeline with live API calls.
 * They require ANTHROPIC_API_KEY and FIRECRAWL_API_KEY in .env.local.
 *
 * Run with:  npx vitest run src/lib/__tests__/import-integration.test.ts
 * Watch:     npx vitest watch src/lib/__tests__/import-integration.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';

// Load env vars BEFORE any other imports that might use them.
// Must be synchronous and at the top level.
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Now safe to check env and import modules that use process.env
const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
const hasFirecrawl = !!process.env.FIRECRAWL_API_KEY;

import {
  detectInput,
  detectInputType,
  extractPlaceIdFromMapsUrl,
  getPlatformLabel,
} from '../detect-input';
import { fetchAndClean, deduplicatePlaces, stripHtml } from '../import-pipeline';
import { extractAndMatchPlaces } from '../anthropic';
import fs from 'fs';

// ─── Detection tests (no API calls, always run) ─────────────────────────────

describe('Detection: Google Maps lists vs single places', () => {
  it('classifies saved-list URLs as google-maps-list', () => {
    expect(detectInputType('https://www.google.com/maps/placelists/list/ABC123xyz')).toBe('google-maps-list');
    expect(detectInputType('https://www.google.com/maps/@40.7,-74.0,15z?share_token=ABCDEF123')).toBe('google-maps-list');
    expect(detectInputType('https://www.google.com/maps/@40.7,-74.0,15z/data=!4m3!11m2!2sCgsvZy8xMXRucXA1c2Y!3e3')).toBe('google-maps-list');
  });

  it('defaults ambiguous short URLs to list', () => {
    expect(detectInputType('https://maps.app.goo.gl/abc123')).toBe('google-maps-list');
  });

  it('classifies single-place URLs as google-maps-place', () => {
    expect(detectInputType('https://www.google.com/maps/place/Aman+Tokyo/@35.6,139.7,17z')).toBe('google-maps-place');
    expect(detectInputType('https://google.com/maps?cid=1234567890')).toBe('google-maps-place');
    expect(detectInputType('https://www.google.com/maps/search/restaurants+near+me')).toBe('google-maps-place');
  });

  it('handles long real-world Google Maps place URLs', () => {
    const url = 'https://www.google.com/maps/place/Aman+Tokyo/@35.6876532,139.7602204,17z/data=!3m1!4b1!4m6!3m5!1s0x60188b857f56c3b3:0x5a1aed80fb1e2e98!8m2!3d35.6876489!4d139.7627953!16s%2Fg%2F11tnqp5sf';
    expect(detectInputType(url)).toBe('google-maps-place');
  });
});

describe('Detection: Platform identification', () => {
  const cases = [
    { url: 'https://www.instagram.com/p/ABC123/', platform: 'instagram' },
    { url: 'https://instagr.am/p/ABC123/', platform: 'instagram' },
    { url: 'https://www.instagram.com/reel/ABC123xyz/', platform: 'instagram' },
    { url: 'https://www.tiktok.com/@user/video/123', platform: 'tiktok' },
    { url: 'https://vm.tiktok.com/ABC123/', platform: 'tiktok' },
    { url: 'https://www.tripadvisor.com/Hotel_Review-g123', platform: 'tripadvisor' },
    { url: 'https://www.yelp.com/biz/restaurant-name', platform: 'yelp' },
    { url: 'https://www.eater.com/maps/best-restaurants-tokyo', platform: 'eater' },
    { url: 'https://www.theinfatuation.com/new-york/guides/best-restaurants', platform: 'infatuation' },
    { url: 'https://www.cntraveler.com/gallery/best-hotels-paris', platform: 'cntraveler' },
    { url: 'https://www.timeout.com/tokyo/restaurants/best', platform: 'timeout' },
    { url: 'https://guide.michelin.com/en/restaurants', platform: 'michelin' },
    { url: 'https://www.thrillist.com/eat/nation/best-new-restaurants', platform: 'thrillist' },
  ];

  for (const { url, platform } of cases) {
    it(`detects ${platform} from ${url.slice(0, 50)}`, () => {
      const meta = detectInput(url);
      expect(meta.type).toBe('url');
      expect(meta.platform).toBe(platform);
    });
  }

  it('returns generic for unknown domains', () => {
    const meta = detectInput('https://randomtravelblog.com/best-places');
    expect(meta.platform).toBe('generic');
  });
});

describe('Detection: Place ID extraction from Maps URLs', () => {
  it('extracts place name', () => {
    const info = extractPlaceIdFromMapsUrl('https://www.google.com/maps/place/Aman+Tokyo/@35.6876,139.7602,17z');
    expect(info?.placeName).toBe('Aman Tokyo');
  });

  it('extracts URL-encoded names', () => {
    const info = extractPlaceIdFromMapsUrl('https://www.google.com/maps/place/L%27Atelier+de+Jo%C3%ABl+Robuchon/@35.6,139.7');
    expect(info?.placeName).toBe("L'Atelier de Joël Robuchon");
  });

  it('extracts coordinates', () => {
    const info = extractPlaceIdFromMapsUrl('https://www.google.com/maps/place/Test/@35.6895,139.6917,17z');
    expect(info?.coordinates).toEqual({ lat: 35.6895, lng: 139.6917 });
  });

  it('extracts CID from query params', () => {
    const info = extractPlaceIdFromMapsUrl('https://www.google.com/maps?cid=12345678901234');
    expect(info?.cid).toBe('12345678901234');
  });

  it('extracts hex place ID from data params', () => {
    const info = extractPlaceIdFromMapsUrl(
      'https://www.google.com/maps/place/Test/@35.6,139.7/data=!4m2!3m1!1s0x60188b857f56c3b3:0x5a1aed80fb1e2e98'
    );
    expect(info?.placeId).toBe('0x60188b857f56c3b3:0x5a1aed80fb1e2e98');
  });

  it('returns null for non-Maps URLs', () => {
    expect(extractPlaceIdFromMapsUrl('https://example.com')).toBeNull();
  });
});

describe('Detection: List ID extraction patterns', () => {
  // Replicate the extractListId logic from maps-list route
  function extractListId(url: string): string | null {
    const dataMatch = url.match(/!2s([A-Za-z0-9_-]+)/);
    if (dataMatch) return dataMatch[1];
    const placelistMatch = url.match(/\/maps\/placelists\/list\/([A-Za-z0-9_-]+)/);
    if (placelistMatch) return placelistMatch[1];
    const tokenMatch = url.match(/share_token=([A-Za-z0-9_-]+)/);
    if (tokenMatch) return tokenMatch[1];
    return null;
  }

  it('extracts from !2s data param', () => {
    expect(extractListId('https://www.google.com/maps/@40.7/data=!4m3!11m2!2sCgsvZy8xMXRucXA1c2Y!3e3'))
      .toBe('CgsvZy8xMXRucXA1c2Y');
  });

  it('extracts from placelists/list/ path', () => {
    expect(extractListId('https://www.google.com/maps/placelists/list/ABC123xyz'))
      .toBe('ABC123xyz');
  });

  it('extracts from share_token param', () => {
    expect(extractListId('https://www.google.com/maps?share_token=MyToken123'))
      .toBe('MyToken123');
  });
});

// ─── HTML stripping tests (no API calls, always run) ─────────────────────────

describe('HTML stripping: stripHtml utility', () => {
  it('removes script and style tags with their content', () => {
    const html = '<p>Hello</p><script>alert("x")</script><style>.a{color:red}</style><p>World</p>';
    const text = stripHtml(html);
    expect(text).not.toContain('alert');
    expect(text).not.toContain('color:red');
    expect(text).toContain('Hello');
    expect(text).toContain('World');
  });

  it('removes nav, footer, and header chrome', () => {
    const html = '<header><nav>Menu</nav></header><main><p>Content here</p></main><footer>Copyright</footer>';
    const text = stripHtml(html);
    expect(text).not.toContain('Menu');
    expect(text).not.toContain('Copyright');
    expect(text).toContain('Content here');
  });

  it('decodes common HTML entities', () => {
    const html = '<p>L&#8217;Hotel &amp; Caf&#8211;Bar</p>';
    const text = stripHtml(html);
    expect(text).toContain("L'Hotel");
    expect(text).toContain('&');
    expect(text).toContain('–');
  });

  it('respects maxLength parameter', () => {
    const html = '<p>' + 'A'.repeat(50000) + '</p>';
    const text = stripHtml(html, 1000);
    expect(text.length).toBeLessThanOrEqual(1000);
  });

  it('strips a real WordPress HTML file to clean text with hotel names', () => {
    // Use the uploaded Yolo Journal Marrakech hotels file if available
    const filePaths = [
      path.resolve(__dirname, '../../../../mnt/uploads/Our Marrakech Hotels List - Yolo Journal.html'),
      path.resolve(__dirname, '../../../test-fixtures/marrakech-hotels.html'),
    ];
    const filePath = filePaths.find(p => fs.existsSync(p));
    if (!filePath) {
      console.log('⚠️  Skipping real HTML test — Marrakech HTML file not found');
      return;
    }

    const rawHtml = fs.readFileSync(filePath, 'utf-8');
    const stripped = stripHtml(rawHtml);

    // Raw HTML is ~200k+, stripped should be way smaller
    expect(stripped.length).toBeLessThan(rawHtml.length * 0.5);

    // Should contain hotel/riad names from the article
    // Note: &#8217; decodes to \u2019 (curly apostrophe), not straight '
    expect(stripped).toContain('L\u2019Hotel Marrakech');
    expect(stripped).toContain('Riad 42');
    expect(stripped).toContain('Amanjena');
    expect(stripped).toContain('Kasbah');
    expect(stripped).toContain('Marrakech');

    // Should NOT contain HTML tags (all stripped)
    expect(stripped).not.toContain('<script');
    expect(stripped).not.toContain('<style');
    expect(stripped).not.toContain('<div');

    console.log(`📊 HTML stripping: ${rawHtml.length} chars → ${stripped.length} chars (${Math.round(stripped.length / rawHtml.length * 100)}%)`);
  });
});

// ─── Live extraction tests (require ANTHROPIC_API_KEY + network access) ─────
//
// These tests hit real APIs (Anthropic, Firecrawl, Google).
// They're skipped when network is unavailable (e.g. sandboxed environments).
//
// Run locally with: npx vitest run src/lib/__tests__/import-integration.test.ts
//

// Quick network check — try DNS resolution of the Anthropic API
async function canReachAnthropicAPI(): Promise<boolean> {
  try {
    const dns = await import('dns');
    return new Promise((resolve) => {
      dns.lookup('api.anthropic.com', (err) => resolve(!err));
    });
  } catch {
    return false;
  }
}

let networkAvailable = false;

describe('Live: Text list extraction', () => {
  beforeAll(async () => {
    networkAvailable = hasAnthropic && await canReachAnthropicAPI();
    if (!networkAvailable) {
      console.log('⚠️  Skipping live tests — no network access to api.anthropic.com');
    }
  });
  it.skipIf(!networkAvailable)('extracts places from a simple comma-separated list', async () => {
    const input = 'Aman Tokyo, Park Hyatt Tokyo, Hoshinoya Tokyo, The Peninsula Tokyo';
    const result = await extractAndMatchPlaces(input, false);

    expect(result.places.length).toBeGreaterThanOrEqual(4);
    expect(result.places.some(p => p.name?.toLowerCase().includes('aman'))).toBe(true);
    expect(result.places.some(p => p.name?.toLowerCase().includes('park hyatt'))).toBe(true);
  }, 30000);

  it.skipIf(!networkAvailable)('extracts places from a multi-line list with notes', async () => {
    const input = `Noma - Copenhagen (closed but legendary)
Le Bernardin - NYC, amazing tasting menu
Gaggan Anand - Bangkok, molecular Indian
Den - Tokyo, innovative Japanese
Central - Lima, Peruvian biodiversity`;

    const result = await extractAndMatchPlaces(input, false);

    expect(result.places.length).toBeGreaterThanOrEqual(4);
    // Should classify most as restaurants
    const restaurants = result.places.filter(p => p.type === 'restaurant');
    expect(restaurants.length).toBeGreaterThanOrEqual(3);
  }, 30000);

  it.skipIf(!networkAvailable)('handles mixed place types', async () => {
    const input = `Trip to Kyoto:
- Aman Kyoto (hotel, booked for March)
- Kikunoi (restaurant, need reservation)
- Nishiki Market (activity, morning visit)
- Gion district (neighborhood, evening stroll)
- Ippodo Tea (cafe, matcha tasting)
- SOU SOU (shop, textiles)`;

    const result = await extractAndMatchPlaces(input, false);

    expect(result.places.length).toBeGreaterThanOrEqual(5);
    const types = new Set(result.places.map(p => p.type));
    // Should detect at least 3 different types
    expect(types.size).toBeGreaterThanOrEqual(3);
  }, 30000);

  it.skipIf(!networkAvailable)('extracts pipe-separated inline lists', async () => {
    const input = 'Best ramen in Tokyo: Fuunji | Kagari | Tsuta | Nakiryu | Mensho';
    const result = await extractAndMatchPlaces(input, false);

    expect(result.places.length).toBeGreaterThanOrEqual(4);
  }, 30000);

  it.skipIf(!networkAvailable)('detects intent signals from bucket list text', async () => {
    const input = `My travel bucket list 2026:
1. Aman Venice - dreaming, anniversary trip
2. Fogo Island Inn, Newfoundland - researching, summer 2026
3. Soneva Fushi, Maldives - planning with partner
4. Singita Kruger, South Africa - booked for October!`;

    const result = await extractAndMatchPlaces(input, false);

    expect(result.places.length).toBeGreaterThanOrEqual(4);
    // At least some should have intent status
    const withIntent = result.places.filter(p => p.intentStatus);
    expect(withIntent.length).toBeGreaterThanOrEqual(2);
    // The "booked" one should be detected
    const booked = result.places.find(p =>
      p.name?.toLowerCase().includes('singita') && p.intentStatus === 'booked'
    );
    expect(booked).toBeDefined();
  }, 30000);
});

describe('Live: URL fetch + extraction', () => {
  it.skipIf(!networkAvailable)('fetches and extracts from an Eater article', async () => {
    const url = 'https://www.eater.com/maps/best-restaurants-london';
    const content = await fetchAndClean(url);

    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(500);

    const result = await extractAndMatchPlaces(content!, true);
    expect(result.places.length).toBeGreaterThanOrEqual(5);

    // Should mostly be restaurants
    const restaurants = result.places.filter(p => p.type === 'restaurant' || p.type === 'bar');
    expect(restaurants.length).toBeGreaterThanOrEqual(3);

    // Check dedup
    const deduped = deduplicatePlaces(result.places);
    expect(deduped.length).toBeLessThanOrEqual(result.places.length);
  }, 60000);

  it.skipIf(!networkAvailable)('fetches and extracts from a CN Traveler hotel article', async () => {
    const url = 'https://www.cntraveler.com/gallery/best-hotels-in-paris';
    const content = await fetchAndClean(url);

    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(500);

    const result = await extractAndMatchPlaces(content!, true);
    expect(result.places.length).toBeGreaterThanOrEqual(3);

    // Should mostly be hotels
    const hotels = result.places.filter(p => p.type === 'hotel');
    expect(hotels.length).toBeGreaterThanOrEqual(2);
  }, 60000);

  it.skipIf(!networkAvailable)('fetches and extracts from a Time Out restaurant list', async () => {
    const url = 'https://www.timeout.com/tokyo/restaurants/best-restaurants-in-tokyo';
    const content = await fetchAndClean(url);

    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(500);

    const result = await extractAndMatchPlaces(content!, true);
    expect(result.places.length).toBeGreaterThanOrEqual(5);
  }, 60000);
});

describe('Live: HTML file upload extraction (simulated)', () => {
  it.skipIf(!networkAvailable)('extracts hotels from a saved Yolo Journal HTML file', async () => {
    // Simulate the file upload flow: read HTML → strip tags → extract places
    const filePaths = [
      path.resolve(__dirname, '../../../../mnt/uploads/Our Marrakech Hotels List - Yolo Journal.html'),
      path.resolve(__dirname, '../../../test-fixtures/marrakech-hotels.html'),
    ];
    const filePath = filePaths.find(p => fs.existsSync(p));
    if (!filePath) {
      console.log('⚠️  Skipping — Marrakech HTML file not found');
      return;
    }

    const rawHtml = fs.readFileSync(filePath, 'utf-8');
    const cleaned = stripHtml(rawHtml);

    // Stripped content should be readable and contain hotel names
    expect(cleaned.length).toBeGreaterThan(500);
    expect(cleaned.length).toBeLessThan(rawHtml.length);

    // Now pass through Claude extraction (same as file upload route does)
    const result = await extractAndMatchPlaces(cleaned.slice(0, 30000), false);

    expect(result.places.length).toBeGreaterThanOrEqual(10);

    // Should detect as Marrakech region
    expect(result.region?.toLowerCase()).toContain('marrakech');

    // Should mostly be hotels
    const hotels = result.places.filter(p => p.type === 'hotel');
    expect(hotels.length).toBeGreaterThanOrEqual(8);

    // Spot-check known hotels from the article
    const names = result.places.map(p => p.name.toLowerCase());
    const expectedHotels = ['amanjena', 'riad 42', 'four seasons'];
    for (const hotel of expectedHotels) {
      expect(names.some(n => n.includes(hotel))).toBe(true);
    }

    // Check dedup works
    const deduped = deduplicatePlaces(result.places);
    expect(deduped.length).toBeLessThanOrEqual(result.places.length);

    console.log(`📊 Marrakech HTML: extracted ${result.places.length} places (${hotels.length} hotels), region: ${result.region}`);
    console.log(`   Hotels: ${result.places.filter(p => p.type === 'hotel').map(p => p.name).join(', ')}`);
  }, 60000);
});
