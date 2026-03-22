#!/usr/bin/env node

/**
 * Audit Place ID Resolution
 *
 * Compares what we intended (seed name + location) against what Google resolved
 * (propertyName stored in PlaceIntelligence). Flags suspicious mismatches.
 *
 * Also does a spot-check: re-queries Google Places API for flagged places to
 * see if the stored name matches the current top result.
 *
 * Usage:
 *   node scripts/audit-place-ids.mjs                 # full audit
 *   node scripts/audit-place-ids.mjs --spot-check    # also re-query Google for flagged
 *   node scripts/audit-place-ids.mjs --spot-check-all # re-query ALL 398 (costs ~$1)
 */

import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';

const args = process.argv.slice(2);
const SPOT_CHECK = args.includes('--spot-check') || args.includes('--spot-check-all');
const SPOT_CHECK_ALL = args.includes('--spot-check-all');

// ─── Similarity helpers ─────────────────────────────────────────────────────

function normalize(s) {
  return s.toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordOverlap(a, b) {
  const wordsA = new Set(normalize(a).split(' ').filter(w => w.length > 2));
  const wordsB = new Set(normalize(b).split(' ').filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  return overlap / Math.max(wordsA.size, wordsB.size);
}

// Check if resolved name is a reasonable match for the seed
function isLikelyMatch(seedName, resolvedName) {
  const nSeed = normalize(seedName);
  const nResolved = normalize(resolvedName);

  // Exact or near-exact
  if (nResolved.includes(nSeed) || nSeed.includes(nResolved)) return { match: true, reason: 'substring' };

  // Word overlap > 50%
  const overlap = wordOverlap(seedName, resolvedName);
  if (overlap >= 0.5) return { match: true, reason: `word-overlap:${(overlap * 100).toFixed(0)}%` };

  // Check key brand words
  const brandWords = ['aman', 'four seasons', 'six senses', 'one&only', 'rosewood', 'mandarin', 'peninsula', 'ritz', 'st regis', 'waldorf', 'park hyatt', 'raffles', 'capella', 'singita', 'soneva', 'como', 'belmond', 'hoshinoya', 'anantara', 'banyan tree', 'oberoi', 'taj', 'leela'];
  const seedLower = seedName.toLowerCase();
  const resolvedLower = resolvedName.toLowerCase();
  for (const brand of brandWords) {
    if (seedLower.includes(brand) && resolvedLower.includes(brand)) {
      return { match: true, reason: `brand:${brand}` };
    }
  }

  return { match: false, reason: `low-overlap:${(overlap * 100).toFixed(0)}%` };
}

// ─── Google Places spot-check ───────────────────────────────────────────────

async function spotCheckPlace(googlePlaceId) {
  // Use Place Details to get the canonical name for this Place ID
  const url = `https://places.googleapis.com/v1/places/${googlePlaceId}`;
  const response = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': PLACES_API_KEY,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,types,primaryType',
    },
  });
  if (!response.ok) return null;
  return response.json();
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Place ID Resolution Audit\n');

  // 1. Pull all v3-backfill records from DB
  const client = await pool.connect();
  const dbResult = await client.query(
    `SELECT id, "googlePlaceId", "propertyName", "placeType"
     FROM "PlaceIntelligence"
     WHERE "lastTriggeredBy" = 'system-v3-backfill'
     ORDER BY "propertyName"`
  );
  client.release();

  console.log(`📊 Found ${dbResult.rows.length} records from v3-backfill\n`);

  // Note: We intentionally do NOT import from backfill-500-strategic.mjs here,
  // because that script has a top-level main() call that re-executes the backfill
  // as a side effect. Instead, we audit purely from DB state + Google API.

  const flagged = [];
  const clean = [];
  const suspicious = [];

  for (const row of dbResult.rows) {
    const name = row.propertyName;
    const placeId = row.googlePlaceId;

    // Flag patterns that suggest wrong resolution:
    const flags = [];

    // 1. Very generic names (likely resolved to wrong place)
    if (name.length < 5) flags.push('very-short-name');

    // 2. Name looks like a city/region rather than a property
    const genericWords = ['restaurant', 'cafe', 'shop', 'store', 'market', 'station', 'airport', 'hospital', 'school', 'university', 'church', 'mosque', 'temple', 'park', 'garden', 'museum', 'cinema', 'theatre'];
    const nameLower = name.toLowerCase();
    for (const word of genericWords) {
      if (nameLower.includes(word) && !nameLower.includes('hotel') && !nameLower.includes('resort') && !nameLower.includes('lodge')) {
        flags.push(`generic-word:${word}`);
      }
    }

    // 3. Place ID format check
    if (!placeId.startsWith('ChIJ') && !placeId.startsWith('Eh')) {
      flags.push('unusual-place-id-format');
    }

    // 4. Duplicate place IDs (different seeds resolved to same place)
    // We'll check after the loop

    if (flags.length > 0) {
      flagged.push({ ...row, flags });
    } else {
      clean.push(row);
    }
  }

  // Check for duplicate Place IDs
  const placeIdCounts = {};
  for (const row of dbResult.rows) {
    placeIdCounts[row.googlePlaceId] = (placeIdCounts[row.googlePlaceId] || []);
    placeIdCounts[row.googlePlaceId].push(row.propertyName);
  }

  const duplicates = Object.entries(placeIdCounts).filter(([_, names]) => names.length > 1);

  // Also check duplicates against the full PlaceIntelligence table (pre-existing)
  const client2 = await pool.connect();
  const allPIResult = await client2.query(
    `SELECT "googlePlaceId", "propertyName", "lastTriggeredBy"
     FROM "PlaceIntelligence"
     ORDER BY "propertyName"`
  );
  client2.release();

  const globalPlaceIdMap = {};
  for (const row of allPIResult.rows) {
    globalPlaceIdMap[row.googlePlaceId] = (globalPlaceIdMap[row.googlePlaceId] || []);
    globalPlaceIdMap[row.googlePlaceId].push({ name: row.propertyName, source: row.lastTriggeredBy });
  }
  const globalDuplicates = Object.entries(globalPlaceIdMap).filter(([_, entries]) => entries.length > 1);

  // ─── Report ─────────────────────────────────────────────────────────────────

  console.log('═══════════════════════════════════════════════════');
  console.log('  AUDIT RESULTS');
  console.log('═══════════════════════════════════════════════════\n');

  // Duplicates within batch
  if (duplicates.length > 0) {
    console.log(`⚠️  DUPLICATE PLACE IDs WITHIN BATCH (${duplicates.length}):`);
    for (const [placeId, names] of duplicates) {
      console.log(`   ${placeId}`);
      for (const name of names) console.log(`     → ${name}`);
    }
    console.log();
  } else {
    console.log('✅ No duplicate Place IDs within the v3-backfill batch\n');
  }

  // Global duplicates (including pre-existing)
  if (globalDuplicates.length > 0) {
    console.log(`⚠️  GLOBAL DUPLICATE PLACE IDs (${globalDuplicates.length}):`);
    for (const [placeId, entries] of globalDuplicates) {
      console.log(`   ${placeId}`);
      for (const e of entries) console.log(`     → ${e.name} (${e.source || 'unknown'})`);
    }
    console.log();
  } else {
    console.log('✅ No global duplicate Place IDs\n');
  }

  // Flagged records
  if (flagged.length > 0) {
    console.log(`🚩 FLAGGED RECORDS (${flagged.length}):`);
    for (const f of flagged) {
      console.log(`   "${f.propertyName}" [${f.placeType}]`);
      console.log(`     Place ID: ${f.googlePlaceId}`);
      console.log(`     Flags: ${f.flags.join(', ')}`);
    }
    console.log();
  } else {
    console.log('✅ No flagged records based on name patterns\n');
  }

  // Spot check
  if (SPOT_CHECK) {
    const toCheck = SPOT_CHECK_ALL ? dbResult.rows : flagged;
    console.log(`\n🔎 SPOT-CHECKING ${toCheck.length} places via Google Places API...\n`);

    const mismatches = [];
    let checked = 0;

    for (const row of toCheck) {
      const result = await spotCheckPlace(row.googlePlaceId);
      checked++;

      if (!result) {
        mismatches.push({ ...row, spotCheck: 'API_ERROR' });
        continue;
      }

      const googleName = result.displayName?.text || '';
      const matchResult = isLikelyMatch(row.propertyName, googleName);

      if (!matchResult.match) {
        mismatches.push({ ...row, spotCheck: googleName, reason: matchResult.reason });
        console.log(`  ❌ MISMATCH #${mismatches.length}`);
        console.log(`     DB name:     "${row.propertyName}"`);
        console.log(`     Google name: "${googleName}"`);
        console.log(`     Place ID:    ${row.googlePlaceId}`);
        console.log(`     Reason:      ${matchResult.reason}`);
        if (result.formattedAddress) console.log(`     Address:     ${result.formattedAddress}`);
        console.log();
      }

      if (checked % 50 === 0) console.log(`  ... checked ${checked}/${toCheck.length}`);

      // Rate limit
      await new Promise(r => setTimeout(r, 100));
    }

    console.log(`\n📊 Spot-check complete: ${checked} checked, ${mismatches.length} mismatches found`);

    if (mismatches.length > 0) {
      console.log('\n🚨 MISMATCHED PLACES:');
      for (const m of mismatches) {
        console.log(`   DB: "${m.propertyName}" → Google: "${m.spotCheck}" [${m.reason}]`);
        console.log(`   ID: ${m.id} | PlaceID: ${m.googlePlaceId}`);
      }
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Total records:          ${dbResult.rows.length}`);
  console.log(`  Clean:                  ${clean.length}`);
  console.log(`  Flagged (name pattern): ${flagged.length}`);
  console.log(`  Duplicate Place IDs:    ${duplicates.length}`);
  console.log(`  Global duplicates:      ${globalDuplicates.length}`);
  if (SPOT_CHECK) console.log(`  (Spot-check results shown above)`);
  else console.log(`  Run with --spot-check to verify flagged via Google API`);
  console.log(`  Run with --spot-check-all to verify ALL via Google API (~$1)`);
  console.log('═══════════════════════════════════════════════════\n');

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
