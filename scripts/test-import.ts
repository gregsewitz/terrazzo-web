#!/usr/bin/env npx tsx
/**
 * Smart Import Test Script
 *
 * Tests the import pipeline end-to-end with real URLs and text inputs.
 * Calls the underlying functions directly (no server needed).
 *
 * Usage:
 *   npx tsx scripts/test-import.ts                  # run all tests
 *   npx tsx scripts/test-import.ts --only=url       # run only URL tests
 *   npx tsx scripts/test-import.ts --only=maps      # run only Maps tests
 *   npx tsx scripts/test-import.ts --only=text      # run only text tests
 *   npx tsx scripts/test-import.ts --only=detect    # run only detection tests (fast, no API calls)
 *   npx tsx scripts/test-import.ts --verbose        # show full place details
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { detectInput, detectInputType, extractPlaceIdFromMapsUrl, getPlatformLabel } from '../src/lib/detect-input';
import { fetchAndClean, deduplicatePlaces } from '../src/lib/import-pipeline';
import { extractAndMatchPlaces } from '../src/lib/anthropic';

// ─── Config ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const only = args.find(a => a.startsWith('--only='))?.split('=')[1];
const verbose = args.includes('--verbose');

// ─── Styling ────────────────────────────────────────────────────────────────

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const WARN = '\x1b[33m⚠\x1b[0m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';

let passed = 0;
let failed = 0;
let warned = 0;

function header(title: string) {
  console.log(`\n${BOLD}${CYAN}━━━ ${title} ━━━${RESET}\n`);
}

function result(name: string, success: boolean, detail?: string, warning?: string) {
  if (success) {
    console.log(`  ${PASS} ${name}${detail ? `  ${DIM}${detail}${RESET}` : ''}`);
    passed++;
  } else {
    console.log(`  ${FAIL} ${name}${detail ? `  ${DIM}${detail}${RESET}` : ''}`);
    failed++;
  }
  if (warning) {
    console.log(`    ${WARN} ${warning}`);
    warned++;
  }
}

function printPlaces(places: any[]) {
  if (!places.length) return;
  const maxName = Math.min(Math.max(...places.map(p => p.name?.length || 0)), 40);
  for (const p of places.slice(0, verbose ? 50 : 10)) {
    const name = (p.name || '???').padEnd(maxName).slice(0, maxName);
    const type = (p.type || '?').padEnd(12).slice(0, 12);
    const city = (p.city || p.location || '').slice(0, 25);
    const score = p.matchScore ? ` ${p.matchScore}%` : '';
    console.log(`    ${DIM}│${RESET} ${name} ${DIM}${type} ${city}${score}${RESET}`);
  }
  if (!verbose && places.length > 10) {
    console.log(`    ${DIM}│ ... and ${places.length - 10} more${RESET}`);
  }
}

// ─── Test: Input Detection (fast, no API calls) ────────────────────────────

async function testDetection() {
  header('INPUT DETECTION');

  // Google Maps Lists
  const listTests = [
    { input: 'https://www.google.com/maps/placelists/list/ABC123xyz', expected: 'google-maps-list' },
    { input: 'https://www.google.com/maps/@40.7,-74.0,15z?share_token=ABCDEF123', expected: 'google-maps-list' },
    { input: 'https://www.google.com/maps/@40.7,-74.0,15z/data=!4m3!11m2!2sCgsvZy8xMXRncXA1c2Y!3e3', expected: 'google-maps-list' },
    { input: 'https://maps.app.goo.gl/abc123', expected: 'google-maps-list' },
  ];

  for (const { input, expected } of listTests) {
    const got = detectInputType(input);
    result(`List: ${input.slice(0, 60)}...`, got === expected, `→ ${got}`);
  }

  // Google Maps Single Places
  const placeTests = [
    { input: 'https://www.google.com/maps/place/Aman+Tokyo/@35.6,139.7,17z', expected: 'google-maps-place' },
    { input: 'https://google.com/maps?cid=1234567890', expected: 'google-maps-place' },
    { input: 'https://www.google.com/maps/search/restaurants+near+me', expected: 'google-maps-place' },
  ];

  for (const { input, expected } of placeTests) {
    const got = detectInputType(input);
    result(`Place: ${input.slice(0, 60)}...`, got === expected, `→ ${got}`);
  }

  // Platform detection
  const platformTests = [
    { input: 'https://www.instagram.com/p/ABC123/', expectedPlatform: 'instagram' },
    { input: 'https://www.tiktok.com/@user/video/123', expectedPlatform: 'tiktok' },
    { input: 'https://www.tripadvisor.com/Hotel_Review-g123', expectedPlatform: 'tripadvisor' },
    { input: 'https://www.yelp.com/biz/restaurant-name', expectedPlatform: 'yelp' },
    { input: 'https://www.eater.com/maps/best-restaurants-tokyo', expectedPlatform: 'eater' },
    { input: 'https://www.theinfatuation.com/new-york/guides/best-restaurants', expectedPlatform: 'infatuation' },
    { input: 'https://www.cntraveler.com/gallery/best-hotels-paris', expectedPlatform: 'cntraveler' },
    { input: 'https://www.timeout.com/tokyo/restaurants/best', expectedPlatform: 'timeout' },
    { input: 'https://guide.michelin.com/en/restaurants', expectedPlatform: 'michelin' },
  ];

  for (const { input, expectedPlatform } of platformTests) {
    const meta = detectInput(input);
    result(
      `Platform: ${expectedPlatform}`,
      meta.platform === expectedPlatform,
      `→ ${meta.platform} (${meta.type})`
    );
  }

  // Place ID extraction
  const extractTests = [
    {
      input: 'https://www.google.com/maps/place/Aman+Tokyo/@35.6876,139.7602,17z',
      expectName: 'Aman Tokyo',
    },
    {
      input: 'https://www.google.com/maps?cid=12345678901234',
      expectCid: '12345678901234',
    },
    {
      input: 'https://www.google.com/maps/place/L%27Atelier+de+Jo%C3%ABl+Robuchon/@35.6,139.7',
      expectName: "L'Atelier de Joël Robuchon",
    },
  ];

  for (const { input, expectName, expectCid } of extractTests) {
    const info = extractPlaceIdFromMapsUrl(input);
    if (expectName) {
      result(`Extract name: "${expectName}"`, info?.placeName === expectName, `→ "${info?.placeName}"`);
    }
    if (expectCid) {
      result(`Extract CID: ${expectCid}`, info?.cid === expectCid, `→ ${info?.cid}`);
    }
  }

  // URL normalization
  const normTests = [
    { input: 'www.cntraveler.com/article', expectType: 'url', expectNorm: true },
    { input: 'https://example.com/article', expectType: 'url', expectNorm: false },
    { input: 'example.com/article', expectType: 'text', expectNorm: false },
  ];

  for (const { input, expectType, expectNorm } of normTests) {
    const meta = detectInput(input);
    result(
      `Normalize: "${input}"`,
      meta.type === expectType && (!!meta.normalized === expectNorm),
      `→ type=${meta.type}, normalized=${meta.normalized}`
    );
  }
}

// ─── Test: URL Fetching + Extraction ────────────────────────────────────────

async function testUrlImport() {
  header('URL FETCH + EXTRACTION');

  // Test articles from major travel publications
  const urlTests = [
    {
      name: 'Eater restaurant guide',
      url: 'https://www.eater.com/maps/best-restaurants-london',
      minPlaces: 5,
      expectTypes: ['restaurant', 'bar'],
    },
    {
      name: 'CN Traveler hotel list',
      url: 'https://www.cntraveler.com/gallery/best-hotels-in-paris',
      minPlaces: 3,
      expectTypes: ['hotel'],
    },
    {
      name: 'Time Out city guide',
      url: 'https://www.timeout.com/tokyo/restaurants/best-restaurants-in-tokyo',
      minPlaces: 5,
      expectTypes: ['restaurant'],
    },
  ];

  for (const test of urlTests) {
    const meta = detectInput(test.url);
    const platformLabel = getPlatformLabel(meta.platform);
    console.log(`  ${DIM}Testing: ${test.name} (${platformLabel})${RESET}`);
    console.log(`  ${DIM}URL: ${test.url}${RESET}`);

    try {
      // Step 1: Fetch
      const startFetch = Date.now();
      const content = await fetchAndClean(test.url);
      const fetchMs = Date.now() - startFetch;

      if (!content) {
        result(test.name, false, 'fetchAndClean returned null');
        continue;
      }

      result(`  Fetch`, true, `${content.length} chars in ${fetchMs}ms`);

      // Step 2: Extract with Claude
      const startExtract = Date.now();
      const extracted = await extractAndMatchPlaces(content, true);
      const extractMs = Date.now() - startExtract;

      const places = extracted.places || [];
      const region = extracted.region;

      const hasEnoughPlaces = places.length >= test.minPlaces;
      const hasExpectedTypes = test.expectTypes.some(t =>
        places.some(p => p.type === t)
      );

      result(
        `  Extract`,
        hasEnoughPlaces,
        `${places.length} places in ${extractMs}ms${region ? `, region: ${region}` : ''}`,
        !hasEnoughPlaces ? `Expected at least ${test.minPlaces} places` : undefined,
      );

      result(
        `  Types`,
        hasExpectedTypes,
        `found: ${[...new Set(places.map(p => p.type))].join(', ')}`,
        !hasExpectedTypes ? `Expected types: ${test.expectTypes.join(', ')}` : undefined,
      );

      // Step 3: Dedup
      const deduped = deduplicatePlaces(places);
      const dupeCount = places.length - deduped.length;
      result(
        `  Dedup`,
        true,
        dupeCount > 0 ? `removed ${dupeCount} duplicates → ${deduped.length} unique` : `${deduped.length} places, no duplicates`,
      );

      // Show extracted places
      printPlaces(deduped);

      console.log('');
    } catch (err) {
      result(test.name, false, `Error: ${(err as Error).message}`);
    }
  }
}

// ─── Test: Text List Extraction ─────────────────────────────────────────────

async function testTextImport() {
  header('TEXT LIST EXTRACTION');

  const textTests = [
    {
      name: 'Simple comma list',
      input: 'Aman Tokyo, Park Hyatt Tokyo, Hoshinoya Tokyo, The Peninsula Tokyo',
      minPlaces: 4,
      expectedCity: 'Tokyo',
    },
    {
      name: 'Multi-line list with notes',
      input: `Noma - Copenhagen (closed but worth mentioning)
Le Bernardin - NYC, amazing tasting menu
Gaggan Anand - Bangkok, molecular Indian
Den - Tokyo, innovative Japanese
Central - Lima, Peruvian biodiversity`,
      minPlaces: 4,
    },
    {
      name: 'Mixed place types',
      input: `Trip to Kyoto:
- Aman Kyoto (hotel, booked for March)
- Kikunoi (restaurant, need reservation)
- Nishiki Market (activity, morning visit)
- Gion district (neighborhood, evening stroll)
- Ippodo Tea (cafe, matcha)
- SOU SOU (shop, textiles)`,
      minPlaces: 5,
      expectTypes: ['hotel', 'restaurant', 'activity', 'cafe', 'shop'],
    },
    {
      name: 'Pipe-separated (inline list)',
      input: 'Best ramen in Tokyo: Fuunji | Kagari | Tsuta | Nakiryu | Mensho',
      minPlaces: 4,
    },
    {
      name: 'Bucket list with intent signals',
      input: `My travel bucket list 2026:
1. Aman Venice - dreaming, anniversary trip
2. Fogo Island Inn, Newfoundland - researching, summer 2026
3. Soneva Fushi, Maldives - planning with partner
4. Singita Kruger, South Africa - booked for October!`,
      minPlaces: 4,
    },
  ];

  for (const test of textTests) {
    console.log(`  ${DIM}Testing: ${test.name}${RESET}`);

    try {
      const startExtract = Date.now();
      const extracted = await extractAndMatchPlaces(test.input, false);
      const extractMs = Date.now() - startExtract;

      const places = extracted.places || [];
      const region = extracted.region;

      const hasEnoughPlaces = places.length >= test.minPlaces;
      const hasExpectedTypes = !test.expectTypes || test.expectTypes.some(t =>
        places.some(p => p.type === t)
      );

      result(
        test.name,
        hasEnoughPlaces,
        `${places.length} places in ${extractMs}ms${region ? `, region: ${region}` : ''}`,
        !hasEnoughPlaces ? `Expected at least ${test.minPlaces} places` : undefined,
      );

      if (test.expectTypes) {
        const foundTypes = [...new Set(places.map(p => p.type))];
        result(
          `  Type coverage`,
          hasExpectedTypes,
          `found: ${foundTypes.join(', ')}`,
        );
      }

      // Check for intent signals in bucket list test
      if (test.name.includes('Bucket list')) {
        const hasIntents = places.some(p => p.intentStatus && p.intentStatus !== 'dreaming');
        result(
          `  Intent signals`,
          hasIntents,
          `intents: ${places.map(p => `${p.name?.split(' ')[0]}=${p.intentStatus}`).join(', ')}`,
        );
      }

      printPlaces(places);
      console.log('');
    } catch (err) {
      result(test.name, false, `Error: ${(err as Error).message}`);
    }
  }
}

// ─── Test: Google Maps List ─────────────────────────────────────────────────

async function testMapsImport() {
  header('GOOGLE MAPS LIST');
  console.log(`  ${DIM}Note: Requires a real public Google Maps saved list URL.${RESET}`);
  console.log(`  ${DIM}Skipping live Maps API test (would need a valid list URL).${RESET}`);
  console.log(`  ${DIM}Detection tests covered in the detection section above.${RESET}`);

  // Test extractListId patterns (the internal function)
  const listIdTests = [
    { url: 'https://www.google.com/maps/@40.7,-74.0,15z/data=!4m3!11m2!2sCgsvZy8xMXRucXA1c2Y!3e3', expect: 'CgsvZy8xMXRucXA1c2Y' },
    { url: 'https://www.google.com/maps/placelists/list/ABC123xyz', expect: 'ABC123xyz' },
    { url: 'https://www.google.com/maps?share_token=MyToken123', expect: 'MyToken123' },
  ];

  // Import the function from maps-list route for testing
  // (We can't easily import from the route file, so test the regex patterns directly)
  function extractListId(url: string): string | null {
    const dataMatch = url.match(/!2s([A-Za-z0-9_-]+)/);
    if (dataMatch) return dataMatch[1];
    const placelistMatch = url.match(/\/maps\/placelists\/list\/([A-Za-z0-9_-]+)/);
    if (placelistMatch) return placelistMatch[1];
    const tokenMatch = url.match(/share_token=([A-Za-z0-9_-]+)/);
    if (tokenMatch) return tokenMatch[1];
    return null;
  }

  for (const { url, expect } of listIdTests) {
    const got = extractListId(url);
    result(`List ID from ${url.slice(0, 50)}...`, got === expect, `→ "${got}"`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${BOLD}Terrazzo Smart Import Test Suite${RESET}`);
  console.log(`${DIM}Testing the import pipeline with real URLs and inputs${RESET}`);
  console.log(`${DIM}Verbose: ${verbose}, Only: ${only || 'all'}${RESET}`);

  // Check for required env vars
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasFirecrawl = !!process.env.FIRECRAWL_API_KEY;
  const hasGooglePlaces = !!process.env.GOOGLE_PLACES_API_KEY;

  console.log(`\n${DIM}Environment:${RESET}`);
  console.log(`  Anthropic API: ${hasAnthropic ? PASS : FAIL}`);
  console.log(`  Firecrawl API: ${hasFirecrawl ? PASS : `${WARN} (will use raw fetch fallback)`}`);
  console.log(`  Google Places: ${hasGooglePlaces ? PASS : `${WARN} (enrichment will be skipped)`}`);

  if (!hasAnthropic && (only !== 'detect' && only !== 'maps')) {
    console.error(`\n${FAIL} ANTHROPIC_API_KEY is required for extraction tests`);
    process.exit(1);
  }

  try {
    if (!only || only === 'detect') await testDetection();
    if (!only || only === 'maps') await testMapsImport();
    if (!only || only === 'text') await testTextImport();
    if (!only || only === 'url') await testUrlImport();
  } catch (err) {
    console.error(`\n${FAIL} Unhandled error:`, err);
    failed++;
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  header('SUMMARY');
  console.log(`  ${PASS} ${passed} passed`);
  if (warned) console.log(`  ${WARN} ${warned} warnings`);
  if (failed) console.log(`  ${FAIL} ${failed} failed`);
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

main();
