/**
 * Batch enrichment: Resolve and enrich ALL demo places through the pipeline.
 *
 * Phase 1: Resolve Google Place IDs for all places
 * Phase 2: Upsert PlaceIntelligence records (skip already-complete ones)
 * Phase 3: Send Inngest events in batches of 5 (matching concurrency limit)
 * Phase 4: Poll until all complete
 *
 * Usage: node scripts/enrich-all.mjs [--force]
 *   --force  Re-enrich places that are already complete
 */

import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config({ path: '.env.local' });

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

const FORCE = process.argv.includes('--force');
const BATCH_SIZE = 5; // matches Inngest concurrency limit
const BATCH_DELAY_MS = 5000; // small delay between batches

// ── All demo places extracted from demoTrips.ts and demoSaved.ts ──
const ALL_PLACES = [
  // ─── Hotels ───
  { name: 'Ett Hem', location: 'Stockholm, Sweden', placeType: 'hotel' },
  { name: 'Hotel Sanders', location: 'Copenhagen, Denmark', placeType: 'hotel' },
  { name: 'Hôtel des Grands Boulevards', location: 'Paris, France', placeType: 'hotel' },
  { name: 'Círculo Mexicano', location: 'Centro Histórico, Mexico City', placeType: 'hotel' },
  { name: 'Belmond Grand Hotel Timeo', location: 'Taormina, Sicily, Italy', placeType: 'hotel' },
  { name: 'Masseria Susafa', location: 'Polizzi Generosa, Sicily, Italy', placeType: 'hotel' },
  { name: 'Therasia Resort', location: 'Vulcano, Aeolian Islands, Sicily, Italy', placeType: 'hotel' },
  { name: 'Palazzo Ferraioli', location: 'Noto, Sicily, Italy', placeType: 'hotel' },
  { name: 'The Ned NoMad', location: 'NoMad, New York', placeType: 'hotel' },
  { name: 'The Beekman', location: 'Financial District, New York', placeType: 'hotel' },

  // ─── Restaurants ───
  { name: 'Frantzén', location: 'Norrmalm, Stockholm', placeType: 'restaurant' },
  { name: 'Sturehof', location: 'Stureplan, Stockholm', placeType: 'restaurant' },
  { name: 'Woodstockholm', location: 'Södermalm, Stockholm', placeType: 'restaurant' },
  { name: 'Oaxen Slip', location: 'Djurgården, Stockholm', placeType: 'restaurant' },
  { name: 'Noma', location: 'Christianshavn, Copenhagen', placeType: 'restaurant' },
  { name: 'Barr', location: 'Christianshavn, Copenhagen', placeType: 'restaurant' },
  { name: 'Kadeau', location: 'Copenhagen, Denmark', placeType: 'restaurant' },
  { name: 'Studio', location: 'Copenhagen, Denmark', placeType: 'restaurant' },
  { name: 'Le Comptoir du Panthéon', location: 'Paris, France', placeType: 'restaurant' },
  { name: 'Clown Bar', location: 'Paris, France', placeType: 'restaurant' },
  { name: 'Septime', location: 'Paris, France', placeType: 'restaurant' },
  { name: 'Chez Janou', location: 'Le Marais, Paris, France', placeType: 'restaurant' },
  { name: 'Le Rigmarole', location: 'Oberkampf, Paris, France', placeType: 'restaurant' },
  { name: 'Bambou', location: 'Paris, France', placeType: 'restaurant' },
  { name: 'Le Servan', location: 'Oberkampf, Paris, France', placeType: 'restaurant' },
  { name: 'Contramar', location: 'Roma Norte, Mexico City', placeType: 'restaurant' },
  { name: 'Pujol', location: 'Polanco, Mexico City', placeType: 'restaurant' },
  { name: 'El Huequito', location: 'Centro Histórico, Mexico City', placeType: 'restaurant' },
  { name: 'Rosetta', location: 'Roma Norte, Mexico City', placeType: 'restaurant' },
  { name: 'Expendio de Maíz', location: 'Mexico City', placeType: 'restaurant' },
  { name: 'Páramo', location: 'Condesa, Mexico City', placeType: 'restaurant' },
  { name: 'Lago', location: 'Chapultepec, Mexico City', placeType: 'restaurant' },
  { name: 'Máximo Bistrot', location: 'Roma Norte, Mexico City', placeType: 'restaurant' },
  { name: 'Ristorante Duomo', location: 'Ragusa Ibla, Sicily, Italy', placeType: 'restaurant' },
  { name: 'Trattoria da Piero', location: 'Cefalù, Sicily, Italy', placeType: 'restaurant' },
  { name: 'Buatta Cucina Popolana', location: 'Catania, Sicily, Italy', placeType: 'restaurant' },
  { name: 'Manna Noto', location: 'Noto, Sicily, Italy', placeType: 'restaurant' },
  { name: 'Palazzo Catanese', location: 'Siracusa, Sicily, Italy', placeType: 'restaurant' },
  { name: 'Osteria Nero D\'Avola', location: 'Taormina, Sicily, Italy', placeType: 'restaurant' },
  { name: 'Via Carota', location: 'West Village, New York', placeType: 'restaurant' },
  { name: 'Dhamaka', location: 'Essex Market, New York', placeType: 'restaurant' },
  { name: 'Eleven Madison Park', location: 'Flatiron, New York', placeType: 'restaurant' },
  { name: 'Di An Di', location: 'Greenpoint, Brooklyn', placeType: 'restaurant' },
  { name: 'Le Coucou', location: 'SoHo, New York', placeType: 'restaurant' },
  { name: 'Don Angie', location: 'West Village, New York', placeType: 'restaurant' },
  { name: '4 Charles Prime Rib', location: 'West Village, New York', placeType: 'restaurant' },
  { name: 'Tatiana', location: 'Lincoln Center, New York', placeType: 'restaurant' },
  { name: 'Carbone', location: 'Greenwich Village, New York', placeType: 'restaurant' },
  { name: 'Atomix', location: 'NoMad, New York', placeType: 'restaurant' },
  { name: "L'Abeille", location: 'Paris, France', placeType: 'restaurant' },

  // ─── Bars ───
  { name: 'Tjoget', location: 'Södermalm, Stockholm', placeType: 'bar' },
  { name: 'Ruby', location: 'Copenhagen, Denmark', placeType: 'bar' },
  { name: 'Le Mary Celeste', location: 'Le Marais, Paris, France', placeType: 'bar' },
  { name: 'Candelaria', location: 'Le Marais, Paris, France', placeType: 'bar' },
  { name: 'Licorería Limantour', location: 'Roma Norte, Mexico City', placeType: 'bar' },
  { name: 'Baltra Bar', location: 'Mexico City', placeType: 'bar' },
  { name: 'Attaboy', location: 'Lower East Side, New York', placeType: 'bar' },
  { name: 'Double Chicken Please', location: 'Lower East Side, New York', placeType: 'bar' },
  { name: 'Bar Pisellino', location: 'West Village, New York', placeType: 'bar' },

  // ─── Cafés ───
  { name: 'Drop Coffee', location: 'Södermalm, Stockholm', placeType: 'cafe' },
  { name: 'Hart Bageri', location: 'Copenhagen, Denmark', placeType: 'cafe' },
  { name: 'Café de Flore', location: 'Saint-Germain, Paris, France', placeType: 'cafe' },
  { name: 'Boot Café', location: 'Le Marais, Paris, France', placeType: 'cafe' },
  { name: 'Fragments', location: 'Le Marais, Paris, France', placeType: 'cafe' },
  { name: 'La Fontaine de Belleville', location: 'Canal Saint-Martin, Paris, France', placeType: 'cafe' },
  { name: 'Café de Nadie', location: 'Roma Norte, Mexico City', placeType: 'cafe' },
  { name: 'Tierra Garat', location: 'Condesa, Mexico City', placeType: 'cafe' },
  { name: 'Caffè Sicilia', location: 'Noto, Sicily, Italy', placeType: 'cafe' },

  // ─── Museums ───
  { name: 'Fotografiska', location: 'Stockholm, Sweden', placeType: 'museum' },
  { name: 'Louisiana Museum of Modern Art', location: 'Humlebæk, Denmark', placeType: 'museum' },
  { name: 'Palais de Tokyo', location: 'Paris, France', placeType: 'museum' },
  { name: 'Museo Nacional de Antropología', location: 'Chapultepec, Mexico City', placeType: 'museum' },
  { name: 'Museo Jumex', location: 'Polanco, Mexico City', placeType: 'museum' },
  { name: "Musée de l'Orangerie", location: 'Paris, France', placeType: 'museum' },

  // ─── Neighborhoods ───
  { name: 'Södermalm', location: 'Stockholm, Sweden', placeType: 'neighborhood' },
  { name: 'Nørrebro', location: 'Copenhagen, Denmark', placeType: 'neighborhood' },
  { name: 'Le Marais', location: 'Paris, France', placeType: 'neighborhood' },
  { name: 'Coyoacán', location: 'Mexico City', placeType: 'neighborhood' },
  { name: 'Ortigia', location: 'Siracusa, Sicily, Italy', placeType: 'neighborhood' },
  { name: 'Cefalù', location: 'Sicily, Italy', placeType: 'neighborhood' },

  // ─── Activities ───
  { name: 'Vipp Shelter', location: 'Copenhagen, Denmark', placeType: 'activity' },
  { name: 'Marché des Enfants Rouges', location: 'Le Marais, Paris, France', placeType: 'activity' },
  { name: 'Mercado de la Merced', location: 'Mexico City', placeType: 'activity' },
  { name: 'Lucha Libre at Arena México', location: 'Mexico City', placeType: 'activity' },
  { name: 'Mercado Roma', location: 'Roma Norte, Mexico City', placeType: 'activity' },
  { name: 'Valley of the Temples', location: 'Agrigento, Sicily, Italy', placeType: 'activity' },
  { name: 'Scala dei Turchi', location: 'Realmonte, Sicily, Italy', placeType: 'activity' },
  { name: 'Mt. Etna Excursion', location: 'Sicily, Italy', placeType: 'activity' },
  { name: 'Tonnara di Scopello', location: 'Scopello, Sicily, Italy', placeType: 'activity' },
  { name: 'La Pescheria Market Tour', location: 'Catania, Sicily, Italy', placeType: 'activity' },
  { name: 'Buonivini Vineyard', location: 'Noto, Sicily, Italy', placeType: 'activity' },

  // ─── Shops ───
  { name: 'Grandpa', location: 'Södermalm, Stockholm', placeType: 'shop' },
  { name: 'Merci', location: 'Le Marais, Paris, France', placeType: 'shop' },
  { name: 'Onora Casa', location: 'Roma Norte, Mexico City', placeType: 'shop' },
  { name: 'Ceramiche de Simone', location: 'Caltagirone, Sicily, Italy', placeType: 'shop' },
];

// ── Google Places API ──
async function searchPlace(name, location) {
  const url = 'https://places.googleapis.com/v1/places:searchText';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
    },
    body: JSON.stringify({ textQuery: `${name} ${location}`, maxResultCount: 1, languageCode: 'en' }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.places?.[0] || null;
}

// ── Database ops ──
async function upsertPlace(pool, googlePlaceId, propertyName) {
  const check = await pool.query(
    `SELECT id, status, "signalCount" FROM "PlaceIntelligence" WHERE "googlePlaceId" = $1`,
    [googlePlaceId]
  );

  if (check.rows.length > 0) {
    const row = check.rows[0];
    if (row.status === 'complete' && !FORCE) {
      return { id: row.id, skipped: true, signals: row.signalCount };
    }
    // Reset for re-run
    await pool.query(
      `UPDATE "PlaceIntelligence" SET status = 'pending', signals = '[]', "antiSignals" = '[]', "reviewCount" = 0, "signalCount" = 0, "reliabilityScore" = NULL, "propertyName" = $2 WHERE id = $1`,
      [row.id, propertyName]
    );
    return { id: row.id, skipped: false };
  }

  const id = `clbatch${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  await pool.query(
    `INSERT INTO "PlaceIntelligence" (id, "googlePlaceId", "propertyName", status, signals, "antiSignals", "pipelineVersion", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'pending', '[]', '[]', 'v3-type-aware', NOW(), NOW())`,
    [id, googlePlaceId, propertyName]
  );
  return { id, skipped: false };
}

async function triggerBatch(events) {
  const response = await fetch('https://inn.gs/e/' + INNGEST_EVENT_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(events),
  });
  return response.ok;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Terrazzo Batch Enrichment — All Demo Places        ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  console.log(`Total places: ${ALL_PLACES.length} | Force re-enrich: ${FORCE}\n`);

  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  await pool.query('SELECT 1');
  console.log('✓ Connected to database\n');

  // Phase 1: Resolve Google Place IDs
  console.log('── Phase 1: Resolving Google Place IDs ──\n');
  const resolved = [];
  let resolveErrors = 0;

  for (let i = 0; i < ALL_PLACES.length; i++) {
    const place = ALL_PLACES[i];
    process.stdout.write(`  [${i + 1}/${ALL_PLACES.length}] ${place.name}...`);
    const result = await searchPlace(place.name, place.location);
    if (result) {
      resolved.push({
        ...place,
        googlePlaceId: result.id,
        resolvedName: result.displayName?.text || place.name,
      });
      console.log(` ✓ ${result.id.slice(0, 20)}...`);
    } else {
      resolveErrors++;
      console.log(` ✗ not found`);
    }
    // Rate limit: ~10 QPS for Places API
    if (i % 10 === 9) await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n✓ Resolved ${resolved.length}/${ALL_PLACES.length} (${resolveErrors} failed)\n`);

  // Phase 2: Upsert and filter
  console.log('── Phase 2: Creating/Updating Records ──\n');
  const toEnrich = [];
  let skipped = 0;

  for (const place of resolved) {
    const result = await upsertPlace(pool, place.googlePlaceId, place.resolvedName);
    if (result.skipped) {
      skipped++;
    } else {
      toEnrich.push({ ...place, placeIntelligenceId: result.id });
    }
  }

  console.log(`  Skipped (already complete): ${skipped}`);
  console.log(`  To enrich: ${toEnrich.length}\n`);

  if (toEnrich.length === 0) {
    console.log('Nothing to enrich!');
    await pool.end();
    return;
  }

  // Phase 3: Send events in batches of BATCH_SIZE
  console.log(`── Phase 3: Triggering Pipelines (batches of ${BATCH_SIZE}) ──\n`);
  let triggered = 0;

  for (let i = 0; i < toEnrich.length; i += BATCH_SIZE) {
    const batch = toEnrich.slice(i, i + BATCH_SIZE);
    const events = batch.map(p => ({
      name: 'pipeline/run',
      data: {
        googlePlaceId: p.googlePlaceId,
        propertyName: p.resolvedName,
        placeIntelligenceId: p.placeIntelligenceId,
        placeType: p.placeType,
        trigger: 'manual',
      },
    }));

    const ok = await triggerBatch(events);
    if (ok) {
      triggered += batch.length;
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.map(p => p.name).join(', ')}`);
    } else {
      console.log(`  ✗ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed!`);
    }

    if (i + BATCH_SIZE < toEnrich.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  console.log(`\n✓ Triggered ${triggered} pipelines\n`);

  // Phase 4: Poll
  console.log('── Phase 4: Monitoring Progress (20 min timeout) ──\n');
  const pending = new Set(toEnrich.map(p => p.googlePlaceId));
  const startTime = Date.now();
  const MAX_WAIT = 20 * 60 * 1000;
  let completed = 0;
  let failed = 0;

  while (pending.size > 0 && Date.now() - startTime < MAX_WAIT) {
    const result = await pool.query(
      `SELECT "googlePlaceId", "propertyName", status, "signalCount", "reviewCount", "reliabilityScore"
       FROM "PlaceIntelligence" WHERE "googlePlaceId" = ANY($1)`,
      [Array.from(pending)]
    );

    for (const row of result.rows) {
      if (row.status === 'complete') {
        const place = toEnrich.find(p => p.googlePlaceId === row.googlePlaceId);
        console.log(`  ✓ [${place?.placeType}] ${row.propertyName}: ${row.signalCount} signals, ${row.reviewCount} reviews, reliability: ${row.reliabilityScore || 'n/a'}`);
        pending.delete(row.googlePlaceId);
        completed++;
      } else if (row.status === 'failed') {
        console.log(`  ✗ ${row.propertyName}: FAILED`);
        pending.delete(row.googlePlaceId);
        failed++;
      }
    }

    if (pending.size > 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      process.stdout.write(`  ⏳ ${elapsed}s — ${completed}/${toEnrich.length} done, ${pending.size} remaining...    \r`);
      await new Promise(r => setTimeout(r, 15000));
    }
  }

  // Final summary
  console.log('\n\n── Final Summary ──\n');
  const allRecords = await pool.query(
    `SELECT "googlePlaceId", "propertyName", status, "signalCount", "antiSignalCount", "reviewCount", "reliabilityScore"
     FROM "PlaceIntelligence" WHERE "googlePlaceId" = ANY($1) ORDER BY "propertyName"`,
    [resolved.map(r => r.googlePlaceId)]
  );

  const stats = { complete: 0, enriching: 0, failed: 0, pending: 0 };
  for (const row of allRecords.rows) {
    stats[row.status] = (stats[row.status] || 0) + 1;
    const icon = row.status === 'complete' ? '✓' : row.status === 'enriching' ? '⏳' : '✗';
    const place = resolved.find(r => r.googlePlaceId === row.googlePlaceId);
    console.log(`  ${icon} [${(place?.placeType || '?').padEnd(12)}] ${row.propertyName}: ${row.signalCount || 0} signals, ${row.reviewCount || 0} reviews, reliability: ${row.reliabilityScore || 'n/a'}`);
  }

  console.log(`\n  Complete: ${stats.complete} | Enriching: ${stats.enriching} | Failed: ${stats.failed} | Pending: ${stats.pending}`);
  console.log(`  Total time: ${Math.round((Date.now() - startTime) / 1000)}s`);

  await pool.end();
  console.log('\nDone!');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
