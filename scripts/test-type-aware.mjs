/**
 * Test script: Verify type-aware pipeline on one place per type.
 * Picks diverse types to confirm prompts, dimensions, and stage skipping work.
 *
 * Usage: node scripts/test-type-aware.mjs
 */

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

// One place per type — mix of already-enriched (will re-run) and new
const TYPE_TEST_PLACES = [
  { name: 'Ett Hem', location: 'Stockholm, Sweden', placeType: 'hotel' },
  { name: 'Contramar', location: 'Roma Norte, Mexico City', placeType: 'restaurant' },
  { name: 'Fotografiska', location: 'Stockholm, Sweden', placeType: 'museum' },
  { name: 'Södermalm', location: 'Stockholm, Sweden', placeType: 'neighborhood' },
  { name: 'Bar Pisellino', location: 'New York', placeType: 'bar' },
  { name: 'Café de Flore', location: 'Paris, France', placeType: 'cafe' },
];

async function searchPlace(query) {
  const url = 'https://places.googleapis.com/v1/places:searchText';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount',
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1, languageCode: 'en' }),
  });

  if (!response.ok) {
    console.error(`  ✗ Places API error for "${query}": ${response.status}`);
    return null;
  }

  const data = await response.json();
  return data.places?.[0] || null;
}

async function upsertPlaceIntelligence(pool, googlePlaceId, propertyName) {
  const check = await pool.query(
    `SELECT id, status FROM "PlaceIntelligence" WHERE "googlePlaceId" = $1`,
    [googlePlaceId]
  );

  if (check.rows.length > 0) {
    // Reset for re-run
    await pool.query(
      `UPDATE "PlaceIntelligence" SET status = 'pending', signals = '[]', "antiSignals" = '[]', "reviewCount" = 0, "signalCount" = 0, "reliabilityScore" = NULL, "propertyName" = $2 WHERE id = $1`,
      [check.rows[0].id, propertyName]
    );
    console.log(`  ↺ Reset existing record for re-run`);
    return check.rows[0].id;
  }

  const id = `cltype${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  await pool.query(
    `INSERT INTO "PlaceIntelligence" (id, "googlePlaceId", "propertyName", status, signals, "antiSignals", "pipelineVersion", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'pending', '[]', '[]', 'v3-type-aware', NOW(), NOW())`,
    [id, googlePlaceId, propertyName]
  );
  console.log(`  ✓ Created record: ${id}`);
  return id;
}

async function triggerPipeline(googlePlaceId, propertyName, placeIntelligenceId, placeType) {
  const response = await fetch('https://inn.gs/e/' + INNGEST_EVENT_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'pipeline/run',
      data: {
        googlePlaceId,
        propertyName,
        placeIntelligenceId,
        placeType,
        trigger: 'manual',
      },
    }),
  });

  if (!response.ok) {
    console.error(`  ✗ Inngest error: ${response.status}`);
    return false;
  }

  console.log(`  ✓ Pipeline triggered (type: ${placeType})`);
  return true;
}

async function pollAll(pool, places, maxWait = 600000) {
  const start = Date.now();
  const pending = new Set(places.map(p => p.googlePlaceId));

  while (pending.size > 0 && Date.now() - start < maxWait) {
    const result = await pool.query(
      `SELECT "googlePlaceId", "propertyName", status, "signalCount", "reviewCount", "reliabilityScore"
       FROM "PlaceIntelligence" WHERE "googlePlaceId" = ANY($1)`,
      [Array.from(pending)]
    );

    for (const row of result.rows) {
      if (row.status === 'complete' || row.status === 'failed') {
        const place = places.find(p => p.googlePlaceId === row.googlePlaceId);
        const icon = row.status === 'complete' ? '✓' : '✗';
        console.log(`  ${icon} [${place?.placeType}] ${row.propertyName}: ${row.signalCount} signals, ${row.reviewCount} reviews, reliability: ${row.reliabilityScore || 'n/a'}`);
        pending.delete(row.googlePlaceId);
      }
    }

    if (pending.size > 0) {
      const elapsed = Math.round((Date.now() - start) / 1000);
      const remaining = places.filter(p => pending.has(p.googlePlaceId)).map(p => p.name);
      process.stdout.write(`  ⏳ ${elapsed}s — waiting for: ${remaining.join(', ')}     \r`);
      await new Promise(r => setTimeout(r, 15000));
    }
  }

  if (pending.size > 0) {
    console.log(`\n  ⏰ Timed out. Still pending: ${Array.from(pending).join(', ')}`);
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Type-Aware Pipeline Test — 6 Place Types           ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  // Phase 1: Resolve place IDs
  console.log('── Phase 1: Resolving Google Place IDs ──\n');
  const resolved = [];
  for (const place of TYPE_TEST_PLACES) {
    const query = `${place.name} ${place.location}`;
    console.log(`🔍 [${place.placeType}] ${place.name}`);
    const result = await searchPlace(query);
    if (result) {
      console.log(`  ✓ ${result.displayName?.text} — ${result.formattedAddress}`);
      resolved.push({ ...place, googlePlaceId: result.id, resolvedName: result.displayName?.text });
    } else {
      console.log(`  ✗ Not found — skipping`);
    }
    console.log();
  }

  // Phase 2: Upsert and trigger
  console.log('── Phase 2: Triggering Pipelines ──\n');
  const triggered = [];
  for (const place of resolved) {
    console.log(`🚀 [${place.placeType}] ${place.name}`);
    const piId = await upsertPlaceIntelligence(pool, place.googlePlaceId, place.resolvedName || place.name);
    const ok = await triggerPipeline(place.googlePlaceId, place.resolvedName || place.name, piId, place.placeType);
    if (ok) triggered.push(place);
    console.log();
  }

  // Phase 3: Monitor
  console.log(`── Phase 3: Monitoring ${triggered.length} Pipelines (10 min timeout) ──\n`);
  await pollAll(pool, triggered);

  // Summary
  console.log('\n\n── Final Summary ──\n');
  const all = await pool.query(
    `SELECT "googlePlaceId", "propertyName", status, "signalCount", "antiSignalCount", "reviewCount", "reliabilityScore"
     FROM "PlaceIntelligence" WHERE "googlePlaceId" = ANY($1)`,
    [resolved.map(r => r.googlePlaceId)]
  );

  for (const row of all.rows) {
    const place = resolved.find(r => r.googlePlaceId === row.googlePlaceId);
    console.log(`[${place?.placeType?.padEnd(12)}] ${row.propertyName}: ${row.signalCount} signals, ${row.antiSignalCount} anti, ${row.reviewCount} reviews, reliability: ${row.reliabilityScore || 'n/a'} (${row.status})`);
  }

  await pool.end();
  console.log('\nDone!');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
