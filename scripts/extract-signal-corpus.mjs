#!/usr/bin/env node
/**
 * extract-signal-corpus.mjs
 * Extracts the signal corpus from PlaceIntelligence for clustering.
 *
 * Outputs:
 *   signal-corpus.json      — [{s, d, df}, ...] signals with freq >= 2 (for K-means clustering)
 *   signal-singletons.json  — [{s, d}, ...] signals with freq == 1 (for centroid mapping)
 *   signal-dimensions.json  — [{s, d}, ...] all signals with domain mapping
 */
import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL in .env.local');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log('Extracting signal corpus from PlaceIntelligence...\n');

  // Extract ALL signals with their frequencies (no minimum threshold)
  const { rows } = await pool.query(`
    WITH exploded AS (
      SELECT
        s->>'signal' as signal,
        s->>'dimension' as dimension,
        "id" as place_id
      FROM "PlaceIntelligence",
        jsonb_array_elements(signals::jsonb) s
      WHERE status = 'complete' AND "signalCount" > 0
    ),
    freq AS (
      SELECT
        signal,
        dimension,
        COUNT(DISTINCT place_id) as doc_freq
      FROM exploded
      GROUP BY signal, dimension
    )
    SELECT signal, dimension, doc_freq::int as doc_freq
    FROM freq
    ORDER BY doc_freq DESC
  `);

  console.log(`Extracted ${rows.length} total unique signals\n`);

  // Domain distribution
  const domainCounts = {};
  for (const row of rows) {
    const d = row.dimension || 'Unknown';
    domainCounts[d] = (domainCounts[d] || 0) + 1;
  }
  console.log('Domain distribution:');
  for (const [d, c] of Object.entries(domainCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${d}: ${c} signals`);
  }

  // Frequency distribution
  const freqBuckets = { '2': 0, '3-5': 0, '6-10': 0, '11-20': 0, '21-50': 0, '50+': 0 };
  for (const row of rows) {
    const f = row.doc_freq;
    if (f === 2) freqBuckets['2']++;
    else if (f <= 5) freqBuckets['3-5']++;
    else if (f <= 10) freqBuckets['6-10']++;
    else if (f <= 20) freqBuckets['11-20']++;
    else if (f <= 50) freqBuckets['21-50']++;
    else freqBuckets['50+']++;
  }
  console.log('\nFrequency distribution:');
  for (const [bucket, count] of Object.entries(freqBuckets)) {
    console.log(`  ${bucket}: ${count} signals`);
  }

  // Normalize domain names (FoodDrink vs Food & Drink, etc.)
  const DOMAIN_MAP = {
    'Food & Drink': 'FoodDrink',
    'Food and Drink': 'FoodDrink',
    'Operations': null,  // skip
    'Value': null,        // skip
    'Amenity': null,      // skip
  };

  const corpus = [];       // freq >= 2: used for K-means clustering
  const singletons = [];   // freq == 1: mapped to nearest centroid post-clustering
  const dimensions = [];   // all signals with domain mapping
  for (const row of rows) {
    let dim = row.dimension;
    if (DOMAIN_MAP[dim] !== undefined) {
      dim = DOMAIN_MAP[dim];
      if (!dim) continue; // skip unmapped domains
    }
    dimensions.push({ s: row.signal, d: dim });
    if (row.doc_freq >= 2) {
      corpus.push({ s: row.signal, d: dim, df: row.doc_freq });
    } else {
      singletons.push({ s: row.signal, d: dim });
    }
  }

  // Save corpus (for clustering)
  fs.writeFileSync('signal-corpus.json', JSON.stringify(corpus, null, 2));
  console.log(`\nSaved signal-corpus.json (${corpus.length} signals, freq >= 2)`);

  // Save singletons (for centroid mapping)
  fs.writeFileSync('signal-singletons.json', JSON.stringify(singletons, null, 2));
  console.log(`Saved signal-singletons.json (${singletons.length} signals, freq == 1)`);

  // Save dimensions (all)
  fs.writeFileSync('signal-dimensions.json', JSON.stringify(dimensions, null, 2));
  console.log(`Saved signal-dimensions.json (${dimensions.length} total mappings)`);

  // Summary stats
  const totalProps = await pool.query(`
    SELECT COUNT(*) as n FROM "PlaceIntelligence"
    WHERE status = 'complete' AND "signalCount" > 0
  `);
  console.log(`\nTotal enriched properties: ${totalProps.rows[0].n}`);
  console.log(`Signals in corpus (freq >= 2): ${corpus.length}`);
  console.log(`Singletons (freq == 1): ${singletons.length}`);
  console.log(`Total unique signals: ${dimensions.length}`);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
