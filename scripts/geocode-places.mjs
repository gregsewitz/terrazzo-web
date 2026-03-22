/**
 * Fetch lat/lng for all demo places using their Google Place IDs.
 * Uses the Google Places Details API.
 *
 * Usage: node scripts/geocode-places.mjs
 *
 * Outputs a JSON mapping of placeId -> { lat, lng } that can be
 * injected into demoTrips.ts
 */
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
if (!API_KEY) {
  console.error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local');
  process.exit(1);
}

// Read demoTrips.ts and extract all placeIds
const demoFile = fs.readFileSync('src/data/demoTrips.ts', 'utf8');
const placeIdMatches = [...demoFile.matchAll(/placeId:\s*'([^']+)'/g)];
const uniqueIds = [...new Set(placeIdMatches.map(m => m[1]))];

console.log(`Found ${uniqueIds.length} unique Place IDs to geocode\n`);

const results = {};
let success = 0;
let failed = 0;

for (const placeId of uniqueIds) {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,name&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === 'OK' && data.result?.geometry?.location) {
      const { lat, lng } = data.result.geometry.location;
      results[placeId] = { lat, lng, name: data.result.name };
      console.log(`  ✓ ${data.result.name}: ${lat}, ${lng}`);
      success++;
    } else {
      console.log(`  ✗ ${placeId}: ${data.status}`);
      failed++;
    }
  } catch (err) {
    console.log(`  ✗ ${placeId}: ${err.message}`);
    failed++;
  }

  // Rate limit - 10 per second is safe
  await new Promise(r => setTimeout(r, 100));
}

console.log(`\nGeocoded ${success}/${uniqueIds.length} (${failed} failed)`);

// Now inject lat/lng into demoTrips.ts
let updated = demoFile;
let injected = 0;

for (const [placeId, { lat, lng }] of Object.entries(results)) {
  // Find `placeId: 'XXX',` and add lat/lng after the google object's existing properties
  // Pattern: placeId: 'XXX', rating: ... } -> placeId: 'XXX', lat: Y, lng: Z, rating: ... }
  const pattern = `placeId: '${placeId}',`;
  if (updated.includes(pattern) && !updated.includes(`placeId: '${placeId}', lat:`)) {
    updated = updated.replaceAll(
      pattern,
      `placeId: '${placeId}', lat: ${lat}, lng: ${lng},`
    );
    injected++;
  }
}

fs.writeFileSync('src/data/demoTrips.ts', updated);
console.log(`Injected lat/lng for ${injected} places into demoTrips.ts`);
