#!/usr/bin/env node

/**
 * Backfill Seed Script — Populate PlaceIntelligence with diverse properties.
 *
 * Seeds the database with a curated set of real properties across different:
 * - Property types (hotels, restaurants, bars, cafes, neighborhoods)
 * - Geographies (Europe, Asia, Americas, Middle East, Africa)
 * - Taste domains (design-forward, character-rich, food-driven, wellness, etc.)
 * - Price points (luxury, boutique, accessible)
 *
 * Each property is resolved via Google Places API and fed through the
 * enrichment pipeline (Inngest) to generate BriefingSignals.
 *
 * Usage:
 *   node scripts/backfill-seed-places.mjs
 *   node scripts/backfill-seed-places.mjs --dry-run        # Preview without creating
 *   node scripts/backfill-seed-places.mjs --category=hotels # Seed only hotels
 *   node scripts/backfill-seed-places.mjs --batch=10        # Limit batch size
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { Inngest } from 'inngest';

// ─── Initialize clients ─────────────────────────────────────────────────────

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const inngest = new Inngest({ id: 'terrazzo', name: 'Terrazzo Place Intelligence' });

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
const FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.primaryType,places.types,places.location,places.photos,places.rating,places.userRatingCount,places.priceLevel,places.websiteUri,places.googleMapsUri,places.editorialSummary';

// ─── Google Places Search (inline) ──────────────────────────────────────────

async function searchPlace(query) {
  const url = 'https://places.googleapis.com/v1/places:searchText';
  const body = { textQuery: query, maxResultCount: 1, languageCode: 'en' };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': PLACES_API_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Places API ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const places = data.places || [];
  return places[0] || null;
}

// ─── ensureEnrichment (inline) ───────────────────────────────────────────────

async function ensureEnrichment(googlePlaceId, propertyName, userId, trigger) {
  const existing = await prisma.placeIntelligence.findUnique({
    where: { googlePlaceId },
    select: { id: true, status: true },
  });

  if (existing) {
    if (existing.status === 'enriching' || existing.status === 'complete') {
      return { id: existing.id, action: 'skipped' };
    }
    // Failed or pending — re-trigger
    await prisma.placeIntelligence.update({
      where: { id: existing.id },
      data: { status: 'pending', propertyName, lastTriggeredBy: userId },
    });
    await inngest.send({
      name: 'pipeline/run',
      data: { googlePlaceId, propertyName, placeIntelligenceId: existing.id, trigger, triggeredByUserId: userId },
    });
    return { id: existing.id, action: 'retriggered' };
  }

  // Create new
  const intel = await prisma.placeIntelligence.create({
    data: { googlePlaceId, propertyName, status: 'pending', signals: '[]', lastTriggeredBy: userId },
  });

  await inngest.send({
    name: 'pipeline/run',
    data: { googlePlaceId, propertyName, placeIntelligenceId: intel.id, trigger, triggeredByUserId: userId },
  });

  return { id: intel.id, action: 'created' };
}

// ─── Seed Data ───────────────────────────────────────────────────────────────

const SEED_PROPERTIES = [
  // ── Design-forward hotels ──
  { name: 'Aman Tokyo', location: 'Tokyo, Japan', category: 'hotels', domain: 'Design' },
  { name: 'The Opposite House', location: 'Beijing, China', category: 'hotels', domain: 'Design' },
  { name: 'Casa Barragan', location: 'Mexico City, Mexico', category: 'hotels', domain: 'Design' },
  { name: 'Hotel Amour', location: 'Paris, France', category: 'hotels', domain: 'Character' },
  { name: 'Fogo Island Inn', location: 'Fogo Island, Canada', category: 'hotels', domain: 'Design' },
  { name: 'Hoshinoya Kyoto', location: 'Kyoto, Japan', category: 'hotels', domain: 'Wellness' },
  { name: 'The Ned', location: 'London, UK', category: 'hotels', domain: 'Character' },
  { name: 'Six Senses Zighy Bay', location: 'Musandam, Oman', category: 'hotels', domain: 'Wellness' },
  { name: 'Singita Lebombo Lodge', location: 'Kruger, South Africa', category: 'hotels', domain: 'Location' },
  { name: 'Post Ranch Inn', location: 'Big Sur, California', category: 'hotels', domain: 'Location' },
  { name: 'Hotel Il Pellicano', location: 'Porto Ercole, Italy', category: 'hotels', domain: 'Character' },
  { name: 'Ace Hotel Kyoto', location: 'Kyoto, Japan', category: 'hotels', domain: 'Design' },
  { name: 'Chiltern Firehouse', location: 'London, UK', category: 'hotels', domain: 'Character' },
  { name: 'Bensley Collection Shinta Mani Wild', location: 'Kirirom, Cambodia', category: 'hotels', domain: 'Location' },
  { name: 'The Brando', location: 'Tetiaroa, French Polynesia', category: 'hotels', domain: 'Wellness' },
  { name: 'Rooms Hotel Tbilisi', location: 'Tbilisi, Georgia', category: 'hotels', domain: 'Design' },
  { name: 'Santa Monica Proper', location: 'Santa Monica, California', category: 'hotels', domain: 'Design' },
  { name: 'Aman Venice', location: 'Venice, Italy', category: 'hotels', domain: 'Design' },
  { name: 'Canopy by Hilton Reykjavik', location: 'Reykjavik, Iceland', category: 'hotels', domain: 'Location' },
  { name: 'The Siam', location: 'Bangkok, Thailand', category: 'hotels', domain: 'Character' },

  // ── Destination restaurants ──
  { name: 'Noma', location: 'Copenhagen, Denmark', category: 'restaurants', domain: 'Food' },
  { name: 'Central', location: 'Lima, Peru', category: 'restaurants', domain: 'Food' },
  { name: 'Den', location: 'Tokyo, Japan', category: 'restaurants', domain: 'Food' },
  { name: 'Mirazur', location: 'Menton, France', category: 'restaurants', domain: 'Food' },
  { name: 'Septime', location: 'Paris, France', category: 'restaurants', domain: 'Food' },
  { name: 'Disfrutar', location: 'Barcelona, Spain', category: 'restaurants', domain: 'Food' },
  { name: 'Narisawa', location: 'Tokyo, Japan', category: 'restaurants', domain: 'Food' },
  { name: 'Geranium', location: 'Copenhagen, Denmark', category: 'restaurants', domain: 'Food' },
  { name: 'Pujol', location: 'Mexico City, Mexico', category: 'restaurants', domain: 'Food' },
  { name: "Lyle's", location: 'London, UK', category: 'restaurants', domain: 'Food' },
  { name: 'Contra', location: 'New York, USA', category: 'restaurants', domain: 'Food' },
  { name: 'Indian Accent', location: 'New Delhi, India', category: 'restaurants', domain: 'Food' },
  { name: 'The Test Kitchen', location: 'Cape Town, South Africa', category: 'restaurants', domain: 'Food' },
  { name: 'Maido', location: 'Lima, Peru', category: 'restaurants', domain: 'Food' },
  { name: 'Sühring', location: 'Bangkok, Thailand', category: 'restaurants', domain: 'Food' },

  // ── Character-driven bars & cafes ──
  { name: 'Bar Basso', location: 'Milan, Italy', category: 'bars', domain: 'Character' },
  { name: 'Attaboy', location: 'New York, USA', category: 'bars', domain: 'Character' },
  { name: 'Fuglen', location: 'Tokyo, Japan', category: 'cafes', domain: 'Design' },
  { name: 'The Clumsies', location: 'Athens, Greece', category: 'bars', domain: 'Character' },
  { name: 'Blue Bottle Coffee Kiyosumi', location: 'Tokyo, Japan', category: 'cafes', domain: 'Design' },
  { name: 'Café de Flore', location: 'Paris, France', category: 'cafes', domain: 'Character' },
  { name: 'Atlas Bar', location: 'Singapore', category: 'bars', domain: 'Design' },
  { name: 'Stumptown Coffee Roasters', location: 'Portland, Oregon', category: 'cafes', domain: 'Character' },
  { name: 'Maybe Sammy', location: 'Sydney, Australia', category: 'bars', domain: 'Character' },
  { name: 'Bar Termini', location: 'London, UK', category: 'bars', domain: 'Character' },

  // ── Wellness-forward properties ──
  { name: 'Therme Vals', location: 'Vals, Switzerland', category: 'hotels', domain: 'Wellness' },
  { name: 'Como Shambhala Estate', location: 'Bali, Indonesia', category: 'hotels', domain: 'Wellness' },
  { name: 'Sha Wellness Clinic', location: 'Alicante, Spain', category: 'hotels', domain: 'Wellness' },
  { name: 'Aire Ancient Baths', location: 'Barcelona, Spain', category: 'hotels', domain: 'Wellness' },
  { name: 'Lanserhof Tegernsee', location: 'Tegernsee, Germany', category: 'hotels', domain: 'Wellness' },

  // ── Location-driven properties ──
  { name: 'Azulik', location: 'Tulum, Mexico', category: 'hotels', domain: 'Location' },
  { name: 'Explora Atacama', location: 'San Pedro de Atacama, Chile', category: 'hotels', domain: 'Location' },
  { name: 'Longitude 131', location: 'Uluru, Australia', category: 'hotels', domain: 'Location' },
  { name: 'Song Saa Private Island', location: 'Koh Rong, Cambodia', category: 'hotels', domain: 'Location' },
  { name: 'Amangiri', location: 'Canyon Point, Utah', category: 'hotels', domain: 'Location' },

  // ── Service-forward properties ──
  { name: 'The Peninsula Hong Kong', location: 'Hong Kong', category: 'hotels', domain: 'Service' },
  { name: "Claridge's", location: 'London, UK', category: 'hotels', domain: 'Service' },
  { name: 'Mandarin Oriental Bangkok', location: 'Bangkok, Thailand', category: 'hotels', domain: 'Service' },
  { name: 'Park Hyatt Tokyo', location: 'Tokyo, Japan', category: 'hotels', domain: 'Service' },
  { name: 'The Ritz Paris', location: 'Paris, France', category: 'hotels', domain: 'Service' },

  // ── Neighborhoods (for variety) ──
  { name: 'Shimokitazawa', location: 'Tokyo, Japan', category: 'neighborhoods', domain: 'Character' },
  { name: 'Le Marais', location: 'Paris, France', category: 'neighborhoods', domain: 'Character' },
  { name: 'Roma Norte', location: 'Mexico City, Mexico', category: 'neighborhoods', domain: 'Character' },
  { name: 'Trastevere', location: 'Rome, Italy', category: 'neighborhoods', domain: 'Character' },
  { name: 'Tiong Bahru', location: 'Singapore', category: 'neighborhoods', domain: 'Design' },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const categoryFilter = args.find(a => a.startsWith('--category='))?.split('=')[1] || null;
  const batchSize = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1] || '0') || Infinity;

  if (!PLACES_API_KEY) {
    console.error('❌ GOOGLE_PLACES_API_KEY not set in .env');
    process.exit(1);
  }

  let properties = SEED_PROPERTIES;
  if (categoryFilter) {
    properties = properties.filter(p => p.category === categoryFilter);
  }
  properties = properties.slice(0, batchSize);

  console.log(`\n🌱 Terrazzo Backfill Seed`);
  console.log(`   Properties to seed: ${properties.length}`);
  console.log(`   Categories: ${[...new Set(properties.map(p => p.category))].join(', ')}`);
  console.log(`   Domains: ${[...new Set(properties.map(p => p.domain))].join(', ')}`);
  if (dryRun) console.log(`   🏜️  DRY RUN — no database changes`);
  console.log();

  if (dryRun) {
    for (const p of properties) {
      console.log(`  [dry-run] ${p.name} — ${p.location} (${p.category}, ${p.domain})`);
    }
    console.log(`\n✅ Dry run complete. ${properties.length} properties would be seeded.`);
    await pool.end();
    return;
  }

  const SYSTEM_USER_ID = 'system-backfill';
  let created = 0;
  let retriggered = 0;
  let skipped = 0;
  let failed = 0;

  // Process in batches of 5 to respect Google API rate limits
  const CONCURRENCY = 5;
  for (let i = 0; i < properties.length; i += CONCURRENCY) {
    const batch = properties.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (prop) => {
        const query = `${prop.name}, ${prop.location}`;
        try {
          const googleResult = await searchPlace(query);
          if (!googleResult?.id) {
            console.log(`  ❌ ${prop.name} — Google Places returned no result`);
            return 'failed';
          }

          const googlePlaceId = googleResult.id;
          const resolvedName = googleResult.displayName?.text || prop.name;

          const result = await ensureEnrichment(
            googlePlaceId,
            resolvedName,
            SYSTEM_USER_ID,
            'backfill_seed',
          );

          if (result.action === 'created') {
            console.log(`  ✅ ${resolvedName} (${googlePlaceId}) → pipeline triggered`);
            return 'created';
          } else if (result.action === 'retriggered') {
            console.log(`  🔄 ${resolvedName} (${googlePlaceId}) → pipeline re-triggered`);
            return 'retriggered';
          } else {
            console.log(`  ⏭️  ${resolvedName} — already enriched/enriching`);
            return 'skipped';
          }
        } catch (err) {
          console.log(`  ❌ ${prop.name} — ${err.message}`);
          return 'failed';
        }
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        if (r.value === 'created') created++;
        else if (r.value === 'retriggered') retriggered++;
        else if (r.value === 'skipped') skipped++;
        else failed++;
      } else {
        failed++;
      }
    }

    // Brief pause between batches
    if (i + CONCURRENCY < properties.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\n📊 Backfill Summary:`);
  console.log(`   ✅ Created:      ${created}`);
  console.log(`   🔄 Re-triggered: ${retriggered}`);
  console.log(`   ⏭️  Skipped:      ${skipped}`);
  console.log(`   ❌ Failed:       ${failed}`);
  console.log(`   Total:          ${properties.length}`);
  console.log(`\n🔄 Enrichment pipelines are running in the background via Inngest.`);
  console.log(`   Monitor at: https://app.inngest.com (or your local Inngest dashboard)\n`);

  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
