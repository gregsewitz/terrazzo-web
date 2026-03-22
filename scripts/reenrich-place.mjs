import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({ path: '.env.local' });

const name = process.argv[2];
if (!name) {
  console.log('Usage: node scripts/reenrich-place.mjs "Place Name"');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL });

// Find the place intelligence record
const { rows } = await pool.query(`
  SELECT id, "googlePlaceId", "propertyName", status
  FROM "PlaceIntelligence"
  WHERE "propertyName" ILIKE $1
`, [`%${name}%`]);

if (rows.length === 0) {
  console.log('No PlaceIntelligence found for:', name);
  await pool.end();
  process.exit(1);
}

const pi = rows[0];
console.log(`Found: ${pi.propertyName} (${pi.googlePlaceId})`);
console.log(`Current status: ${pi.status}`);

// Reset to pending so the pipeline re-runs fully
await pool.query(`
  UPDATE "PlaceIntelligence"
  SET status = 'pending',
      signals = '[]',
      "antiSignals" = NULL,
      reliability = NULL,
      "reviewIntel" = NULL,
      "signalCount" = 0,
      "antiSignalCount" = 0,
      "reviewCount" = 0,
      "reliabilityScore" = NULL,
      "sourcesProcessed" = NULL,
      "lastEnrichedAt" = NULL
  WHERE id = $1
`, [pi.id]);

console.log('Reset to pending. Now triggering pipeline...');

// Trigger Inngest event
const inngestUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://terrazzo-web.vercel.app';
const eventKey = process.env.INNGEST_EVENT_KEY;

if (!eventKey) {
  console.log('No INNGEST_EVENT_KEY found — trigger manually or run enrich-all.mjs');
  await pool.end();
  process.exit(0);
}

const res = await fetch('https://inn.gs/e/' + eventKey, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'places/enrich.requested',
    data: {
      placeIntelligenceId: pi.id,
      googlePlaceId: pi.googlePlaceId,
      propertyName: pi.propertyName,
    },
  }),
});

if (res.ok) {
  console.log(`Triggered enrichment for ${pi.propertyName}`);
} else {
  console.log('Failed to trigger:', res.status, await res.text());
  console.log('Run enrich-all.mjs instead to pick it up.');
}

await pool.end();
