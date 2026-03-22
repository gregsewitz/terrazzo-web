/**
 * Cleanup script for PlaceIntelligence issues found during audit.
 *
 * Handles four categories:
 * 1. Reset ~63 records stuck in "enriching" status → back to "pending"
 * 2. Reset ~15 legacy "complete" records with empty signals → back to "pending"
 * 3. Create PlaceIntelligence records for 8 SavedPlaces with no link
 * 4. Reset ~35 "complete" records with null reliabilityScore → back to "pending" for re-enrichment
 *
 * Usage: node scripts/cleanup-enrichment.mjs
 * Requires: DIRECT_URL in .env.local
 */

import dotenv from 'dotenv';
import pg from 'pg';
import crypto from 'crypto';
dotenv.config({ path: '.env.local' });

function generateId() {
  return 'cl' + crypto.randomBytes(12).toString('base64url').toLowerCase().slice(0, 23);
}

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL });

async function main() {
  const client = await pool.connect();

  try {
    // ─── 1. Reset stuck "enriching" records ───
    console.log('=== 1. Resetting stuck "enriching" records ===');
    const { rows: stuckEnriching } = await client.query(`
      UPDATE "PlaceIntelligence"
      SET status = 'pending', "updatedAt" = NOW()
      WHERE status = 'enriching'
        AND ("signalCount" = 0 OR "signalCount" IS NULL)
      RETURNING id, "propertyName", "googlePlaceId"
    `);
    console.log(`  Reset ${stuckEnriching.length} stuck enriching records to pending`);
    for (const r of stuckEnriching.slice(0, 5)) {
      console.log(`    - ${r.propertyName || r.googlePlaceId}`);
    }
    if (stuckEnriching.length > 5) console.log(`    ... and ${stuckEnriching.length - 5} more`);

    // ─── 2. Reset legacy "complete" records with empty signals ───
    console.log('\n=== 2. Resetting legacy "complete" records with empty data ===');
    const { rows: legacyEmpty } = await client.query(`
      UPDATE "PlaceIntelligence"
      SET status = 'pending', "signalCount" = 0, "updatedAt" = NOW()
      WHERE status = 'complete'
        AND "signalCount" > 0
        AND (
          signals IS NULL
          OR signals::text = '[]'
          OR signals::text = 'null'
        )
        AND "antiSignals" IS NULL
        AND "reliabilityScore" IS NULL
      RETURNING id, "propertyName", "googlePlaceId"
    `);
    console.log(`  Reset ${legacyEmpty.length} legacy records with empty data to pending`);
    for (const r of legacyEmpty) {
      console.log(`    - ${r.propertyName || r.googlePlaceId}`);
    }

    // ─── 3. Create PlaceIntelligence for unlinked SavedPlaces ───
    console.log('\n=== 3. Creating PlaceIntelligence for unlinked SavedPlaces ===');
    const { rows: unlinked } = await client.query(`
      SELECT sp.id as sp_id, sp.name, sp."googlePlaceId"
      FROM "SavedPlace" sp
      WHERE sp."placeIntelligenceId" IS NULL
        AND sp."deletedAt" IS NULL
        AND sp."googlePlaceId" IS NOT NULL
    `);
    console.log(`  Found ${unlinked.length} unlinked SavedPlaces`);

    let linked = 0;
    for (const sp of unlinked) {
      // Check if a PlaceIntelligence already exists for this googlePlaceId
      const { rows: existing } = await client.query(
        `SELECT id FROM "PlaceIntelligence" WHERE "googlePlaceId" = $1`,
        [sp.googlePlaceId]
      );

      let piId;
      if (existing.length > 0) {
        piId = existing[0].id;
        console.log(`    - ${sp.name}: linking to existing PI ${piId}`);
      } else {
        piId = generateId();
        await client.query(`
          INSERT INTO "PlaceIntelligence" ("id", "googlePlaceId", "propertyName", "status", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, 'pending', NOW(), NOW())
        `, [piId, sp.googlePlaceId, sp.name]);
        console.log(`    - ${sp.name}: created new PI ${piId}`);
      }

      await client.query(
        `UPDATE "SavedPlace" SET "placeIntelligenceId" = $1 WHERE id = $2`,
        [piId, sp.sp_id]
      );
      linked++;
    }
    console.log(`  Linked ${linked} SavedPlaces`);

    // ─── 4. Reset "complete" records with null reliabilityScore ───
    console.log('\n=== 4. Resetting "complete" records with null reliabilityScore ===');
    const { rows: nullReliability } = await client.query(`
      UPDATE "PlaceIntelligence"
      SET status = 'pending', "updatedAt" = NOW()
      WHERE status = 'complete'
        AND "reliabilityScore" IS NULL
        AND "signalCount" > 0
        AND signals::text != '[]'
        AND signals IS NOT NULL
      RETURNING id, "propertyName", "googlePlaceId"
    `);
    console.log(`  Reset ${nullReliability.length} records with null reliabilityScore to pending`);
    for (const r of nullReliability.slice(0, 10)) {
      console.log(`    - ${r.propertyName || r.googlePlaceId}`);
    }
    if (nullReliability.length > 10) console.log(`    ... and ${nullReliability.length - 10} more`);

    // ─── Summary ───
    console.log('\n=== Summary ===');
    const { rows: [counts] } = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'enriching') as enriching,
        COUNT(*) FILTER (WHERE status = 'complete') as complete
      FROM "PlaceIntelligence"
    `);
    console.log(`  pending: ${counts.pending}, enriching: ${counts.enriching}, complete: ${counts.complete}`);

    const { rows: [unlinkedCount] } = await client.query(`
      SELECT COUNT(*) as count
      FROM "SavedPlace"
      WHERE "placeIntelligenceId" IS NULL AND "deletedAt" IS NULL
    `);
    console.log(`  Unlinked SavedPlaces remaining: ${unlinkedCount.count}`);

    console.log('\nDone! All reset records are now "pending" and ready for re-enrichment.');
    console.log('Trigger enrichment by deploying and letting Inngest process them,');
    console.log('or run: node scripts/enrich-all.mjs');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
