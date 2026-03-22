/**
 * Test script: Resolve Google Place IDs and trigger enrichment pipeline
 * for a small batch of demo places.
 *
 * Usage: node scripts/test-pipeline.mjs
 */

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

// 5 diverse test places across our demo trips
const TEST_PLACES = [
  { name: 'Ett Hem', location: 'Stockholm, Sweden', trip: 'Stockholm+Copenhagen' },
  { name: 'Contramar', location: 'Roma Norte, Mexico City', trip: 'Mexico City' },
  { name: 'Septime', location: 'Paris, France', trip: 'Paris' },
  { name: 'Caffè Sicilia Noto', location: 'Noto, Sicily, Italy', trip: 'Sicily' },
  { name: 'Via Carota', location: 'West Village, New York', trip: 'Standalone Saved' },
];

// ── Step 1: Search Google Places API ──
async function searchPlace(query) {
  const url = 'https://places.googleapis.com/v1/places:searchText';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.primaryTypeDisplayName',
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 1,
      languageCode: 'en',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`  ✗ Places API error for "${query}": ${response.status} ${errText}`);
    return null;
  }

  const data = await response.json();
  return data.places?.[0] || null;
}

// ── Step 2: Upsert PlaceIntelligence in Supabase ──
async function upsertPlaceIntelligence(pool, googlePlaceId, propertyName) {
  // Check if already exists
  const check = await pool.query(
    `SELECT id, status, "signalCount", "lastEnrichedAt" FROM "PlaceIntelligence" WHERE "googlePlaceId" = $1`,
    [googlePlaceId]
  );

  if (check.rows.length > 0) {
    const row = check.rows[0];
    console.log(`  ℹ Already exists: status=${row.status}, signals=${row.signalCount}, enriched=${row.lastEnrichedAt || 'never'}`);
    if (row.status === 'complete') {
      console.log(`  ✓ Skipping — already enriched`);
      return { id: row.id, skipped: true };
    }
    // Reset to pending for re-run
    await pool.query(
      `UPDATE "PlaceIntelligence" SET status = 'pending', "propertyName" = $2 WHERE id = $1`,
      [row.id, propertyName]
    );
    return { id: row.id, skipped: false };
  }

  // Create new
  const id = `cltest${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  await pool.query(
    `INSERT INTO "PlaceIntelligence" (id, "googlePlaceId", "propertyName", status, signals, "pipelineVersion", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'pending', '[]', 'v3-ri', NOW(), NOW())`,
    [id, googlePlaceId, propertyName]
  );
  console.log(`  ✓ Created PlaceIntelligence record: ${id}`);
  return { id, skipped: false };
}

// ── Step 3: Send Inngest event to trigger pipeline ──
async function triggerPipeline(googlePlaceId, propertyName, placeIntelligenceId) {
  const response = await fetch('https://inn.gs/e/' + INNGEST_EVENT_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'pipeline/run',
      data: {
        googlePlaceId,
        propertyName,
        placeIntelligenceId,
        trigger: 'manual',
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`  ✗ Inngest error: ${response.status} ${errText}`);
    return false;
  }

  const result = await response.json();
  console.log(`  ✓ Pipeline triggered via Inngest: ${JSON.stringify(result)}`);
  return true;
}

// ── Step 4: Poll for results ──
async function pollStatus(pool, googlePlaceId, maxWait = 300000, interval = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const result = await pool.query(
      `SELECT status, "signalCount", "antiSignalCount", "reviewCount", "reliabilityScore", "lastEnrichedAt"
       FROM "PlaceIntelligence" WHERE "googlePlaceId" = $1`,
      [googlePlaceId]
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];

    if (row.status === 'complete') {
      return row;
    }
    if (row.status === 'failed') {
      console.log(`  ✗ Pipeline failed`);
      return row;
    }

    const elapsed = Math.round((Date.now() - start) / 1000);
    process.stdout.write(`  ⏳ ${elapsed}s — status: ${row.status}...\r`);
    await new Promise(r => setTimeout(r, interval));
  }
  console.log(`  ⏰ Timed out after ${maxWait / 1000}s`);
  return null;
}

// ── Main ──
async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  Terrazzo Pipeline Test — 5 Demo Places         ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // Connect to Supabase
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  try {
    await pool.query('SELECT 1');
    console.log('✓ Connected to Supabase\n');
  } catch (err) {
    console.error('✗ Database connection failed:', err.message);
    process.exit(1);
  }

  const results = [];

  // Phase 1: Resolve all Google Place IDs
  console.log('── Phase 1: Resolving Google Place IDs ──\n');
  for (const place of TEST_PLACES) {
    const query = `${place.name} ${place.location}`;
    console.log(`🔍 ${place.name} (${place.trip})`);
    const result = await searchPlace(query);
    if (result) {
      console.log(`  ✓ ${result.displayName?.text} — ${result.formattedAddress}`);
      console.log(`  ID: ${result.id} | Rating: ${result.rating} (${result.userRatingCount} reviews)`);
      results.push({ ...place, googlePlaceId: result.id, googleName: result.displayName?.text });
    } else {
      console.log(`  ✗ Not found`);
    }
    console.log();
  }

  console.log(`\n✓ Resolved ${results.length}/${TEST_PLACES.length} places\n`);

  // Phase 2: Create records and trigger pipelines
  console.log('── Phase 2: Triggering Enrichment Pipelines ──\n');
  const triggered = [];
  for (const place of results) {
    console.log(`🚀 ${place.name}`);
    const intel = await upsertPlaceIntelligence(pool, place.googlePlaceId, place.googleName || place.name);
    if (!intel.skipped) {
      const ok = await triggerPipeline(place.googlePlaceId, place.googleName || place.name, intel.id);
      if (ok) triggered.push(place);
    }
    console.log();
  }

  if (triggered.length === 0) {
    console.log('No new pipelines triggered (all already complete or skipped).\n');
    await pool.end();
    return;
  }

  console.log(`\n✓ Triggered ${triggered.length} pipelines. Monitoring...\n`);

  // Phase 3: Poll for completion
  console.log('── Phase 3: Monitoring Pipeline Progress ──\n');
  console.log('(Each pipeline takes ~3-5 min. Polling every 15s...)\n');

  for (const place of triggered) {
    console.log(`⏳ Waiting for: ${place.name}`);
    const result = await pollStatus(pool, place.googlePlaceId);
    if (result?.status === 'complete') {
      console.log(`  ✓ COMPLETE — ${result.signalCount} signals, ${result.antiSignalCount} anti-signals, ${result.reviewCount} reviews`);
      console.log(`  Reliability: ${result.reliabilityScore}`);
    } else {
      console.log(`  Status: ${result?.status || 'unknown'}`);
    }
    console.log();
  }

  // Summary
  console.log('\n── Summary ──\n');
  const allIntel = await pool.query(
    `SELECT "googlePlaceId", "propertyName", status, "signalCount", "antiSignalCount", "reviewCount", "reliabilityScore"
     FROM "PlaceIntelligence"
     WHERE "googlePlaceId" = ANY($1)`,
    [results.map(r => r.googlePlaceId)]
  );

  for (const row of allIntel.rows) {
    const status = row.status === 'complete' ? '✓' : row.status === 'enriching' ? '⏳' : '✗';
    console.log(`${status} ${row.propertyName}: ${row.signalCount} signals | ${row.reviewCount} reviews | reliability: ${row.reliabilityScore || 'n/a'}`);
  }

  await pool.end();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
