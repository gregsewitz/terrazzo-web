#!/usr/bin/env node

/**
 * Backfill Seed Wave 2 — Non-design-oriented and non-hotel properties.
 *
 * Fills gaps from Wave 1:
 * - Hotels where the draw is SERVICE, CHARACTER, FOOD, or LOCATION (not design)
 * - Casual/street food, markets, food halls
 * - Museums, galleries, cultural institutions
 * - Shops, bookstores, markets
 * - Standalone spas and bathhouses
 * - Outdoor experiences and activities
 * - Vineyards, breweries, wineries
 * - Family-friendly and accessible-price properties
 *
 * Usage:
 *   node scripts/backfill-seed-wave2.mjs
 *   node scripts/backfill-seed-wave2.mjs --dry-run
 *   node scripts/backfill-seed-wave2.mjs --batch=10
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { Inngest } from 'inngest';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const inngest = new Inngest({ id: 'terrazzo', name: 'Terrazzo Place Intelligence' });

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
const FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.primaryType,places.types,places.location,places.photos,places.rating,places.userRatingCount,places.priceLevel,places.websiteUri,places.googleMapsUri,places.editorialSummary';

async function searchPlace(query) {
  const url = 'https://places.googleapis.com/v1/places:searchText';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': PLACES_API_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1, languageCode: 'en' }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Places API ${response.status}: ${text.slice(0, 200)}`);
  }
  const data = await response.json();
  return (data.places || [])[0] || null;
}

async function ensureEnrichment(googlePlaceId, propertyName, userId, trigger) {
  const existing = await prisma.placeIntelligence.findUnique({
    where: { googlePlaceId },
    select: { id: true, status: true },
  });
  if (existing) {
    if (existing.status === 'enriching' || existing.status === 'complete') {
      return { id: existing.id, action: 'skipped' };
    }
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
  const intel = await prisma.placeIntelligence.create({
    data: { googlePlaceId, propertyName, status: 'pending', signals: '[]', lastTriggeredBy: userId },
  });
  await inngest.send({
    name: 'pipeline/run',
    data: { googlePlaceId, propertyName, placeIntelligenceId: intel.id, trigger, triggeredByUserId: userId },
  });
  return { id: intel.id, action: 'created' };
}

// ─── WAVE 2 Seed Data ────────────────────────────────────────────────────────

const SEED_PROPERTIES = [
  // ═══ SERVICE-LED HOTELS (not design-focused) ═══
  { name: 'Four Seasons Bora Bora', location: 'Bora Bora, French Polynesia', category: 'hotels', domain: 'Service' },
  { name: 'Oberoi Udaivilas', location: 'Udaipur, India', category: 'hotels', domain: 'Service' },
  { name: 'Raffles Hotel', location: 'Singapore', category: 'hotels', domain: 'Service' },
  { name: 'The Savoy', location: 'London, UK', category: 'hotels', domain: 'Service' },
  { name: 'Rosewood Hong Kong', location: 'Hong Kong', category: 'hotels', domain: 'Service' },

  // ═══ CHARACTER-LED HOTELS (heritage, story, not aesthetics) ═══
  { name: 'Hotel & Ryokan Sawanoya', location: 'Tokyo, Japan', category: 'hotels', domain: 'Character' },
  { name: 'Belmond Hotel Cipriani', location: 'Venice, Italy', category: 'hotels', domain: 'Character' },
  { name: 'The Gritti Palace', location: 'Venice, Italy', category: 'hotels', domain: 'Character' },
  { name: 'Riad Yasmine', location: 'Marrakech, Morocco', category: 'hotels', domain: 'Character' },
  { name: 'Hotel & Ristorante Grotta Palazzese', location: 'Polignano a Mare, Italy', category: 'hotels', domain: 'Location' },
  { name: 'Ice Hotel', location: 'Jukkasjärvi, Sweden', category: 'hotels', domain: 'Character' },
  { name: 'Giraffe Manor', location: 'Nairobi, Kenya', category: 'hotels', domain: 'Character' },

  // ═══ FAMILY/ADVENTURE/ACCESSIBLE HOTELS ═══
  { name: 'Finolhu Baa Atoll Maldives', location: 'Maldives', category: 'hotels', domain: 'Location' },
  { name: 'Mashpi Lodge', location: 'Mashpi, Ecuador', category: 'hotels', domain: 'Location' },
  { name: 'Clayoquot Wilderness Lodge', location: 'Tofino, Canada', category: 'hotels', domain: 'Location' },
  { name: 'Nayara Tented Camp', location: 'La Fortuna, Costa Rica', category: 'hotels', domain: 'Location' },
  { name: 'andBeyond Bateleur Camp', location: 'Masai Mara, Kenya', category: 'hotels', domain: 'Location' },

  // ═══ FOOD-LED HOTELS (food is the primary draw) ═══
  { name: 'Borgo Egnazia', location: 'Savelletri, Italy', category: 'hotels', domain: 'Food' },
  { name: 'Le Quartier Français', location: 'Franschhoek, South Africa', category: 'hotels', domain: 'Food' },
  { name: 'Hôtel de la Cité Carcassonne', location: 'Carcassonne, France', category: 'hotels', domain: 'Character' },
  { name: 'Babylonstoren', location: 'Franschhoek, South Africa', category: 'hotels', domain: 'Food' },

  // ═══ CASUAL / STREET FOOD / NON-FINE-DINING ═══
  { name: 'Jay Fai', location: 'Bangkok, Thailand', category: 'restaurants', domain: 'Food' },
  { name: 'Pizzeria Da Michele', location: 'Naples, Italy', category: 'restaurants', domain: 'Food' },
  { name: 'Tacos El Califa de León', location: 'Mexico City, Mexico', category: 'restaurants', domain: 'Food' },
  { name: 'Hawker Chan', location: 'Singapore', category: 'restaurants', domain: 'Food' },
  { name: 'Ichiran Ramen Shibuya', location: 'Tokyo, Japan', category: 'restaurants', domain: 'Food' },
  { name: 'Bún Chả Hương Liên', location: 'Hanoi, Vietnam', category: 'restaurants', domain: 'Food' },
  { name: 'Schwartz\'s Deli', location: 'Montreal, Canada', category: 'restaurants', domain: 'Character' },
  { name: 'La Cervecería de Barrio', location: 'Mexico City, Mexico', category: 'restaurants', domain: 'Character' },
  { name: 'The Breakfast Club', location: 'London, UK', category: 'cafes', domain: 'Character' },

  // ═══ MARKETS & FOOD HALLS ═══
  { name: 'Tsukiji Outer Market', location: 'Tokyo, Japan', category: 'neighborhoods', domain: 'Food' },
  { name: 'Borough Market', location: 'London, UK', category: 'neighborhoods', domain: 'Food' },
  { name: 'La Boqueria', location: 'Barcelona, Spain', category: 'neighborhoods', domain: 'Food' },
  { name: 'Mercado de San Miguel', location: 'Madrid, Spain', category: 'neighborhoods', domain: 'Food' },
  { name: 'Grand Bazaar', location: 'Istanbul, Turkey', category: 'neighborhoods', domain: 'Character' },
  { name: 'Chatuchak Weekend Market', location: 'Bangkok, Thailand', category: 'neighborhoods', domain: 'Character' },
  { name: 'Marrakech Medina Souks', location: 'Marrakech, Morocco', category: 'neighborhoods', domain: 'Character' },

  // ═══ MUSEUMS & GALLERIES ═══
  { name: 'Musée d\'Orsay', location: 'Paris, France', category: 'museums', domain: 'Design' },
  { name: 'Tate Modern', location: 'London, UK', category: 'museums', domain: 'Design' },
  { name: 'teamLab Borderless', location: 'Tokyo, Japan', category: 'museums', domain: 'Design' },
  { name: 'Museo Frida Kahlo', location: 'Mexico City, Mexico', category: 'museums', domain: 'Character' },
  { name: 'Zeitz MOCAA', location: 'Cape Town, South Africa', category: 'museums', domain: 'Design' },
  { name: 'Louisiana Museum of Modern Art', location: 'Humlebæk, Denmark', category: 'museums', domain: 'Design' },
  { name: 'Benesse Art Site Naoshima', location: 'Naoshima, Japan', category: 'museums', domain: 'Design' },
  { name: 'MONA', location: 'Hobart, Australia', category: 'museums', domain: 'Character' },

  // ═══ SHOPS & RETAIL ═══
  { name: 'Shakespeare and Company', location: 'Paris, France', category: 'shops', domain: 'Character' },
  { name: 'Daikanyama T-Site', location: 'Tokyo, Japan', category: 'shops', domain: 'Design' },
  { name: 'Merci', location: 'Paris, France', category: 'shops', domain: 'Design' },
  { name: 'Dover Street Market', location: 'London, UK', category: 'shops', domain: 'Design' },
  { name: 'Rough Trade East', location: 'London, UK', category: 'shops', domain: 'Character' },
  { name: 'Librería Acqua Alta', location: 'Venice, Italy', category: 'shops', domain: 'Character' },

  // ═══ STANDALONE SPAS & BATHHOUSES ═══
  { name: 'Széchenyi Thermal Bath', location: 'Budapest, Hungary', category: 'activity', domain: 'Wellness' },
  { name: 'Haman Al Andalus', location: 'Granada, Spain', category: 'activity', domain: 'Wellness' },
  { name: 'Oedo Onsen Monogatari', location: 'Tokyo, Japan', category: 'activity', domain: 'Wellness' },
  { name: 'Blue Lagoon', location: 'Grindavík, Iceland', category: 'activity', domain: 'Wellness' },
  { name: 'Friedrichsbad', location: 'Baden-Baden, Germany', category: 'activity', domain: 'Wellness' },

  // ═══ VINEYARDS & WINERIES ═══
  { name: 'Domaine de la Romanée-Conti', location: 'Vosne-Romanée, France', category: 'activity', domain: 'Food' },
  { name: 'Bodega Catena Zapata', location: 'Mendoza, Argentina', category: 'activity', domain: 'Food' },
  { name: 'Antinori nel Chianti Classico', location: 'Bargino, Italy', category: 'activity', domain: 'Food' },
  { name: 'Cloudy Bay Vineyards', location: 'Blenheim, New Zealand', category: 'activity', domain: 'Food' },

  // ═══ OUTDOOR EXPERIENCES ═══
  { name: 'Zhangjiajie National Forest Park', location: 'Zhangjiajie, China', category: 'activity', domain: 'Location' },
  { name: 'Trolltunga', location: 'Odda, Norway', category: 'activity', domain: 'Location' },
  { name: 'Milford Sound', location: 'Fiordland, New Zealand', category: 'activity', domain: 'Location' },
  { name: 'Salar de Uyuni', location: 'Uyuni, Bolivia', category: 'activity', domain: 'Location' },
  { name: 'Cenote Suytun', location: 'Valladolid, Mexico', category: 'activity', domain: 'Location' },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const batchSize = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1] || '0') || Infinity;

  if (!PLACES_API_KEY) {
    console.error('❌ GOOGLE_PLACES_API_KEY not set in .env');
    process.exit(1);
  }

  let properties = SEED_PROPERTIES.slice(0, batchSize);

  console.log(`\n🌱 Terrazzo Backfill Seed — Wave 2`);
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
  let created = 0, retriggered = 0, skipped = 0, failed = 0;

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
          const result = await ensureEnrichment(googlePlaceId, resolvedName, SYSTEM_USER_ID, 'backfill_seed');
          if (result.action === 'created') {
            console.log(`  ✅ ${resolvedName} (${googlePlaceId}) → pipeline triggered`);
            return 'created';
          } else if (result.action === 'retriggered') {
            console.log(`  🔄 ${resolvedName} (${googlePlaceId}) → re-triggered`);
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
      } else failed++;
    }
    if (i + CONCURRENCY < properties.length) await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n📊 Wave 2 Backfill Summary:`);
  console.log(`   ✅ Created:      ${created}`);
  console.log(`   🔄 Re-triggered: ${retriggered}`);
  console.log(`   ⏭️  Skipped:      ${skipped}`);
  console.log(`   ❌ Failed:       ${failed}`);
  console.log(`   Total:          ${properties.length}`);
  console.log(`\n🔄 Enrichment pipelines running in background via Inngest.\n`);

  await pool.end();
}

main().catch(async (err) => { console.error(err); await pool.end(); process.exit(1); });
