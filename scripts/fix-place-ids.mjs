#!/usr/bin/env node
/**
 * fix-place-ids.mjs
 *
 * Looks up correct Google Place IDs for places where the current ID
 * returns 0 reviews or null rating from the Google Places API.
 *
 * For each suspect place:
 *   1. Uses Google Places Text Search to find the correct place
 *   2. Verifies the new ID returns reviews
 *   3. Updates SavedPlace.googlePlaceId
 *   4. Updates PlaceIntelligence.googlePlaceId
 *   5. Resets PlaceIntelligence.status to "pending" so it gets re-enriched
 *
 * Usage: node scripts/fix-place-ids.mjs [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !GOOGLE_KEY) {
  console.error("Missing env vars. Need SUPABASE_URL, SUPABASE_SERVICE_KEY, GOOGLE_PLACES_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const DRY_RUN = process.argv.includes("--dry-run");

// Places with known bad place IDs (from audit)
// Format: { name, location, currentPlaceId, type }
const SUSPECT_PLACES = [
  // Group B — truly broken (0-3 scraped reviews)
  { name: "Onora Casa", location: "Roma Norte, Mexico City", type: "shop" },
  { name: "Palazzo Catanese", location: "Noto, Sicily", type: "restaurant" },
  { name: "Eha Retreat", location: "Hiiu, Estonia", type: "activity" },
  { name: "Vipp Shelter", location: "Copenhagen, Denmark", type: "activity" },
  // Group A — API returned 0 but scraper worked (still worth fixing for metadata)
  { name: "Chiltern Firehouse", location: "Marylebone, London", type: "restaurant" },
  { name: "Fotografiska", location: "Stockholm, Sweden", type: "museum" },
  { name: "Oaxen Krog", location: "Stockholm, Sweden", type: "restaurant" },
  { name: "Bar Brutus", location: "East Village, New York", type: "bar" },
  { name: "Woodstockholm", location: "Stockholm, Sweden", type: "restaurant" },
  { name: "Louisiana Museum", location: "Humlebæk, Denmark", type: "museum" },
  { name: "Aman Venice", location: "Venice, Italy", type: "hotel" },
  { name: "Palazzo Ferraioli", location: "Palermo, Sicily", type: "hotel" },
  { name: "Mikkeller Bar", location: "Copenhagen, Denmark", type: "bar" },
];

async function textSearchPlaceId(name, location) {
  const query = `${name} ${location}`;
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", query);
  url.searchParams.set("key", GOOGLE_KEY);

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "OK" || !data.results?.length) {
    return null;
  }

  const top = data.results[0];
  return {
    placeId: top.place_id,
    name: top.name,
    rating: top.rating,
    reviewCount: top.user_ratings_total,
    address: top.formatted_address,
  };
}

async function verifyPlaceId(placeId) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "name,rating,user_ratings_total,formatted_address");
  url.searchParams.set("key", GOOGLE_KEY);

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "OK") return null;
  return {
    name: data.result.name,
    rating: data.result.rating,
    reviewCount: data.result.user_ratings_total,
    address: data.result.formatted_address,
  };
}

async function main() {
  console.log(`\n🔍 Place ID Fixer ${DRY_RUN ? "(DRY RUN)" : ""}\n`);

  let fixed = 0;
  let skipped = 0;
  let failed = 0;

  for (const place of SUSPECT_PLACES) {
    process.stdout.write(`  ${place.name} (${place.location})... `);

    // Get current place ID from DB
    const { data: sp } = await supabase
      .from("SavedPlace")
      .select("googlePlaceId, id")
      .eq("name", place.name)
      .limit(1)
      .single();

    if (!sp) {
      console.log("❌ not found in SavedPlace");
      failed++;
      continue;
    }

    const oldId = sp.googlePlaceId;

    // Look up via text search
    const found = await textSearchPlaceId(place.name, place.location);
    if (!found) {
      console.log("❌ text search returned no results");
      failed++;
      continue;
    }

    // Verify the new ID actually returns data
    const verified = await verifyPlaceId(found.placeId);
    if (!verified || !verified.rating) {
      console.log(`❌ new ID also has no rating (${found.placeId})`);
      failed++;
      continue;
    }

    if (found.placeId === oldId) {
      console.log(`⏭️  same ID, skip (rating: ${verified.rating}, reviews: ${verified.reviewCount})`);
      skipped++;
      continue;
    }

    console.log("");
    console.log(`    OLD: ${oldId}`);
    console.log(`    NEW: ${found.placeId} → "${verified.name}" (${verified.rating}⭐, ${verified.reviewCount} reviews)`);
    console.log(`    ADDR: ${verified.address}`);

    if (!DRY_RUN) {
      // Update SavedPlace
      const { error: spErr } = await supabase
        .from("SavedPlace")
        .update({ googlePlaceId: found.placeId })
        .eq("googlePlaceId", oldId);

      if (spErr) {
        console.log(`    ❌ SavedPlace update failed: ${spErr.message}`);
        failed++;
        continue;
      }

      // Update PlaceIntelligence + reset to pending for re-enrichment
      const { error: piErr } = await supabase
        .from("PlaceIntelligence")
        .update({ googlePlaceId: found.placeId, status: "pending" })
        .eq("googlePlaceId", oldId);

      if (piErr) {
        console.log(`    ⚠️  PlaceIntelligence update failed: ${piErr.message}`);
      }

      console.log(`    ✅ updated + reset to pending`);
    } else {
      console.log(`    🏷️  would update (dry run)`);
    }

    fixed++;

    // Rate limit — don't hammer the API
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n📊 Results: ${fixed} fixed, ${skipped} unchanged, ${failed} failed\n`);
}

main().catch(console.error);
