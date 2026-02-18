/**
 * Add missing places to PlaceIntelligence and trigger enrichment.
 *
 * Usage: node scripts/enrich-missing.mjs
 */
import dotenv from 'dotenv';
import pg from 'pg';
import crypto from 'crypto';
dotenv.config({ path: '.env.local' });

// Generate a cuid-like ID (Prisma uses cuid by default)
function generateId() {
  return 'cl' + crypto.randomBytes(12).toString('base64url').toLowerCase().slice(0, 23);
}

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL });

const MISSING_PLACES = [
  { googlePlaceId: 'ChIJKUrdFZRZwokRZVtxUGr1A3A', name: "L'Artusi" },
  { googlePlaceId: 'ChIJMywZv36FdUgRABdFDwGzVms', name: 'Chiltern Firehouse' },
  { googlePlaceId: 'ChIJO5qTOL0pxkcRnF-GPvSpAAQ', name: 'Aman Venice' },
  { googlePlaceId: 'ChIJF2p7bUpZwokRPE_FYw6iL4M', name: 'Bar Brutus' },
];

for (const place of MISSING_PLACES) {
  try {
    // Insert into PlaceIntelligence with pending status
    await pool.query(`
      INSERT INTO "PlaceIntelligence" ("id", "googlePlaceId", "propertyName", "status", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, 'pending', NOW(), NOW())
      ON CONFLICT ("googlePlaceId") DO NOTHING
    `, [generateId(), place.googlePlaceId, place.name]);

    console.log(`✓ Added ${place.name} (${place.googlePlaceId})`);
  } catch (err) {
    console.error(`✗ Failed to add ${place.name}: ${err.message}`);
  }
}

// Now trigger enrichment via Inngest
const INNGEST_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
console.log(`\nTriggering enrichment via Inngest...`);

for (const place of MISSING_PLACES) {
  try {
    const res = await fetch(`${INNGEST_URL}/api/inngest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'terrazzo/enrichment.requested',
        data: { googlePlaceId: place.googlePlaceId, propertyName: place.name },
      }),
    });

    if (res.ok) {
      console.log(`✓ Triggered enrichment for ${place.name}`);
    } else {
      console.log(`⚠ Inngest trigger returned ${res.status} for ${place.name} — try triggering manually`);
    }
  } catch (err) {
    console.log(`⚠ Could not reach Inngest for ${place.name}: ${err.message}`);
    console.log(`  Run the dev server and try again, or trigger from the Inngest dashboard`);
  }
}

await pool.end();
console.log('\nDone. Run `node scripts/check-enrichment.mjs` to monitor progress.');
