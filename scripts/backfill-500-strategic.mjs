#!/usr/bin/env node

/**
 * Backfill 500 Strategic Places — v3 Cluster Diversification
 *
 * Seeds the database with 500 strategically chosen properties to:
 * - Fill geographic gaps (SE Asia, India, Middle East, Africa, South America, etc.)
 * - Introduce new property types (train journeys, farm stays, ryokans, tented camps)
 * - Strengthen thin existing clusters
 * - Add architecture diversity to force mega-cluster 28 to split
 *
 * Each property is resolved via Google Places API, inserted into PlaceIntelligence
 * with status='pending', then you kick off enrichment separately.
 *
 * Usage:
 *   node scripts/backfill-500-strategic.mjs --dry-run
 *   node scripts/backfill-500-strategic.mjs --batch=50
 *   node scripts/backfill-500-strategic.mjs --offset=100 --batch=50
 *   node scripts/backfill-500-strategic.mjs                  # all 500
 */

import 'dotenv/config';
import pg from 'pg';

// ─── Initialize clients ─────────────────────────────────────────────────────

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
const FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.primaryType,places.types,places.location,places.photos,places.rating,places.userRatingCount,places.priceLevel,places.websiteUri,places.googleMapsUri,places.editorialSummary';

// ─── Google Places Search ────────────────────────────────────────────────────

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
  return (data.places || [])[0] || null;
}

// ─── ensureEnrichment (raw SQL, no Prisma/Inngest needed) ────────────────────

function generateId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `cl500_${ts}${rand}`;
}

async function ensureEnrichment(client, googlePlaceId, propertyName, placeType) {
  const existing = await client.query(
    `SELECT id, status FROM "PlaceIntelligence" WHERE "googlePlaceId" = $1`,
    [googlePlaceId]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    if (row.status === 'enriching' || row.status === 'complete') {
      return { id: row.id, action: 'skipped' };
    }
    // Re-set to pending for failed/stale rows
    await client.query(
      `UPDATE "PlaceIntelligence" SET status = 'pending', "propertyName" = $2, "lastTriggeredBy" = 'system-v3-backfill', "updatedAt" = NOW() WHERE id = $1`,
      [row.id, propertyName]
    );
    return { id: row.id, action: 'retriggered' };
  }

  const id = generateId();
  await client.query(
    `INSERT INTO "PlaceIntelligence" (id, "googlePlaceId", "propertyName", status, "placeType", signals, "lastTriggeredBy", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'pending', $4, '[]'::jsonb, 'system-v3-backfill', NOW(), NOW())`,
    [id, googlePlaceId, propertyName, placeType]
  );

  return { id, action: 'created' };
}

// ─── 500 Strategic Places ────────────────────────────────────────────────────

const SEED_PROPERTIES = [
  { name: 'Amanoi', location: 'Ninh Thuận, Vietnam', category: 'hotels' },
  { name: 'Six Senses Ninh Van Bay', location: 'Khánh Hòa, Vietnam', category: 'hotels' },
  { name: 'The Nam Hai', location: 'Hội An, Vietnam', category: 'hotels' },
  { name: 'Four Seasons The Nam Hai', location: 'Hội An, Vietnam', category: 'hotels' },
  { name: 'Zannier Hotels Bãi San Hô', location: 'Phú Yên, Vietnam', category: 'hotels' },
  { name: 'Amanpuri', location: 'Phuket, Thailand', category: 'hotels' },
  { name: 'Soneva Kiri', location: 'Koh Kood, Thailand', category: 'hotels' },
  { name: 'Four Seasons Koh Samui', location: 'Koh Samui, Thailand', category: 'hotels' },
  { name: 'Rosewood Luang Prabang', location: 'Luang Prabang, Laos', category: 'hotels' },
  { name: 'Amansara', location: 'Siem Reap, Cambodia', category: 'hotels' },
  { name: 'Song Saa Private Island', location: 'Koh Rong, Cambodia', category: 'hotels' },
  { name: 'Capella Ubud', location: 'Ubud, Bali', category: 'hotels' },
  { name: 'COMO Shambhala Estate', location: 'Ubud, Bali', category: 'wellness' },
  { name: 'Ayana Resort', location: 'Jimbaran, Bali', category: 'hotels' },
  { name: 'Nihi Sumba', location: 'Sumba, Indonesia', category: 'hotels' },
  { name: 'The Datai Langkawi', location: 'Langkawi, Malaysia', category: 'hotels' },
  { name: 'One&Only Desaru Coast', location: 'Johor, Malaysia', category: 'hotels' },
  { name: 'Amanpulo', location: 'Palawan, Philippines', category: 'hotels' },
  { name: 'The Farm at San Benito', location: 'Batangas, Philippines', category: 'wellness' },
  { name: 'Shinta Mani Wild', location: 'Cardamom Mountains, Cambodia', category: 'hotels' },
  { name: 'Taj Lake Palace', location: 'Udaipur, India', category: 'hotels' },
  { name: 'Amanbagh', location: 'Rajasthan, India', category: 'hotels' },
  { name: 'RAAS Jodhpur', location: 'Jodhpur, India', category: 'hotels' },
  { name: 'Suján Jawai', location: 'Rajasthan, India', category: 'hotels' },
  { name: 'The Leela Palace', location: 'New Delhi, India', category: 'hotels' },
  { name: 'Taj Falaknuma Palace', location: 'Hyderabad, India', category: 'hotels' },
  { name: 'CGH Earth Brunton Boatyard', location: 'Kochi, India', category: 'hotels' },
  { name: 'Evolve Back Kabini', location: 'Karnataka, India', category: 'experiences' },
  { name: 'Wildflower Hall', location: 'Shimla, India', category: 'hotels' },
  { name: 'Amangalla', location: 'Galle, Sri Lanka', category: 'hotels' },
  { name: 'Amanwella', location: 'Tangalle, Sri Lanka', category: 'hotels' },
  { name: 'Cape Weligama', location: 'Weligama, Sri Lanka', category: 'hotels' },
  { name: 'Wild Coast Tented Lodge', location: 'Yala, Sri Lanka', category: 'hotels' },
  { name: 'Aman Al Ula', location: 'AlUla, Saudi Arabia', category: 'hotels' },
  { name: 'The Red Sea — AMAALA', location: 'AMAALA, Saudi Arabia', category: 'hotels' },
  { name: 'One&Only One Za\'abeel', location: 'Dubai, UAE', category: 'hotels' },
  { name: 'Jumeirah Al Naseem', location: 'Dubai, UAE', category: 'hotels' },
  { name: 'Bab Al Shams', location: 'Dubai Desert, UAE', category: 'hotels' },
  { name: 'Anantara Jabal Akhdar', location: 'Jabal Akhdar, Oman', category: 'hotels' },
  { name: 'Alila Jabal Akhdar', location: 'Jabal Akhdar, Oman', category: 'hotels' },
  { name: 'The Chedi Muscat', location: 'Muscat, Oman', category: 'hotels' },
  { name: 'Six Senses Zighy Bay', location: 'Musandam, Oman', category: 'hotels' },
  { name: 'Royal Mansour', location: 'Marrakech, Morocco', category: 'hotels' },
  { name: 'Amanjena', location: 'Marrakech, Morocco', category: 'hotels' },
  { name: 'Kasbah Tamadot', location: 'Atlas Mountains, Morocco', category: 'hotels' },
  { name: 'Bisate Lodge', location: 'Volcanoes NP, Rwanda', category: 'experiences' },
  { name: 'One&Only Gorilla\'s Nest', location: 'Volcanoes NP, Rwanda', category: 'experiences' },
  { name: 'One&Only Nyungwe House', location: 'Nyungwe Forest, Rwanda', category: 'experiences' },
  { name: 'La Résidence', location: 'Franschhoek, South Africa', category: 'hotels' },
  { name: 'Singita Lebombo', location: 'Kruger, South Africa', category: 'experiences' },
  { name: 'Singita Sweni', location: 'Kruger, South Africa', category: 'experiences' },
  { name: 'Babylonstoren', location: 'Franschhoek, South Africa', category: 'farms_estates' },
  { name: 'Royal Malewane', location: 'Thornybush, South Africa', category: 'experiences' },
  { name: 'Lekkerwater Beach Lodge', location: 'De Hoop, South Africa', category: 'hotels' },
  { name: 'Segera Retreat', location: 'Laikipia, Kenya', category: 'experiences' },
  { name: 'Angama Mara', location: 'Masai Mara, Kenya', category: 'experiences' },
  { name: 'Fogo Island Inn', location: 'Fogo Island, Canada', category: 'hotels' },
  { name: 'Gibb\'s Farm', location: 'Ngorongoro, Tanzania', category: 'farms_estates' },
  { name: 'Zanzibar White Sand', location: 'Zanzibar, Tanzania', category: 'hotels' },
  { name: 'Time + Tide Miavana', location: 'Nosy Ankao, Madagascar', category: 'hotels' },
  { name: 'North Island', location: 'Seychelles', category: 'hotels' },
  { name: 'Laucala Island', location: 'Laucala, Fiji', category: 'hotels' },
  { name: 'Amanyangyun', location: 'Shanghai, China', category: 'hotels' },
  { name: 'Aman Summer Palace', location: 'Beijing, China', category: 'hotels' },
  { name: 'The Temple House', location: 'Chengdu, China', category: 'hotels' },
  { name: 'Alila Yangshuo', location: 'Yangshuo, China', category: 'hotels' },
  { name: 'Naked Castle', location: 'Moganshan, China', category: 'hotels' },
  { name: 'Park Hyatt Kyoto', location: 'Kyoto, Japan', category: 'hotels' },
  { name: 'Beniya Mukayu', location: 'Kaga, Japan', category: 'hotels' },
  { name: 'Hoshinoya Tokyo', location: 'Tokyo, Japan', category: 'hotels' },
  { name: 'Hoshinoya Karuizawa', location: 'Karuizawa, Japan', category: 'hotels' },
  { name: 'Gora Kadan', location: 'Hakone, Japan', category: 'hotels' },
  { name: 'Zaborin', location: 'Niseko, Japan', category: 'hotels' },
  { name: 'The Peninsula Hong Kong', location: 'Hong Kong, China', category: 'hotels' },
  { name: 'Rosewood Hong Kong', location: 'Hong Kong, China', category: 'hotels' },
  { name: 'Capella Singapore', location: 'Sentosa, Singapore', category: 'hotels' },
  { name: 'Raffles Singapore', location: 'Singapore', category: 'hotels' },
  { name: 'Awasi Patagonia', location: 'Torres del Paine, Chile', category: 'hotels' },
  { name: 'Tierra Patagonia', location: 'Torres del Paine, Chile', category: 'hotels' },
  { name: 'Explora Atacama', location: 'Atacama Desert, Chile', category: 'hotels' },
  { name: 'Hotel Fasano Boa Vista', location: 'Porto Feliz, Brazil', category: 'hotels' },
  { name: 'UXUA Casa Hotel', location: 'Trancoso, Brazil', category: 'hotels' },
  { name: 'Nayara Tented Camp', location: 'Arenal, Costa Rica', category: 'hotels' },
  { name: 'Hotel Fasano São Paulo', location: 'São Paulo, Brazil', category: 'hotels' },
  { name: 'Inkaterra Machu Picchu', location: 'Machu Picchu, Peru', category: 'hotels' },
  { name: 'Titilaka', location: 'Lake Titicaca, Peru', category: 'hotels' },
  { name: 'Awasi Iguazu', location: 'Iguazú Falls, Argentina', category: 'hotels' },
  { name: 'Estancia Vik', location: 'José Ignacio, Uruguay', category: 'farms_estates' },
  { name: 'Mashpi Lodge', location: 'Mashpi Cloud Forest, Ecuador', category: 'hotels' },
  { name: 'Pikaia Lodge', location: 'Galápagos, Ecuador', category: 'hotels' },
  { name: 'Saffire Freycinet', location: 'Tasmania, Australia', category: 'hotels' },
  { name: 'Southern Ocean Lodge', location: 'Kangaroo Island, Australia', category: 'hotels' },
  { name: 'Longitude 131', location: 'Uluru, Australia', category: 'hotels' },
  { name: 'qualia', location: 'Hamilton Island, Australia', category: 'hotels' },
  { name: 'Emirates One&Only Wolgan Valley', location: 'Blue Mountains, Australia', category: 'hotels' },
  { name: 'The Lodge at Kauri Cliffs', location: 'Bay of Islands, New Zealand', category: 'hotels' },
  { name: 'Robertson Lodges Matakauri', location: 'Queenstown, New Zealand', category: 'hotels' },
  { name: 'Blanket Bay', location: 'Glenorchy, New Zealand', category: 'hotels' },
  { name: 'Huka Lodge', location: 'Taupō, New Zealand', category: 'hotels' },
  { name: 'The Brando', location: 'Tetiaroa, French Polynesia', category: 'hotels' },
  { name: 'Four Seasons Bora Bora', location: 'Bora Bora, French Polynesia', category: 'hotels' },
  { name: 'Kokomo Private Island', location: 'Yaukuve, Fiji', category: 'hotels' },
  { name: 'Aman Sveti Stefan', location: 'Sveti Stefan, Montenegro', category: 'hotels' },
  { name: 'One&Only Portonovi', location: 'Boka Bay, Montenegro', category: 'hotels' },
  { name: 'San Clemente Palace Kempinski', location: 'Venice Islands, Italy', category: 'hotels' },
  { name: 'Esplanade Zagreb', location: 'Zagreb, Croatia', category: 'hotels' },
  { name: 'Rocksresort', location: 'Laax, Switzerland', category: 'hotels' },
  { name: 'Schloss Elmau', location: 'Elmau, Germany', category: 'hotels' },
  { name: 'Hotel & Residence & Spa Rosa Alpina', location: 'San Cassiano, Italy', category: 'hotels' },
  { name: 'Lefay Resort & Spa Dolomiti', location: 'Pinzolo, Italy', category: 'wellness' },
  { name: 'São Lourenço do Barrocal', location: 'Alentejo, Portugal', category: 'farms_estates' },
  { name: 'Sublime Comporta', location: 'Comporta, Portugal', category: 'hotels' },
  { name: 'Bairro Alto Hotel', location: 'Lisbon, Portugal', category: 'hotels' },
  { name: 'The Yeatman', location: 'Porto, Portugal', category: 'hotels' },
  { name: 'Ventura Terra', location: 'Lisbon, Portugal', category: 'hotels' },
  { name: 'Finca Cortesin', location: 'Málaga, Spain', category: 'hotels' },
  { name: 'Cap Rocat', location: 'Mallorca, Spain', category: 'hotels' },
  { name: 'Atzaró Agroturismo', location: 'Ibiza, Spain', category: 'farms_estates' },
  { name: 'Hotel Marqués de Riscal', location: 'Rioja, Spain', category: 'hotels' },
  { name: 'Canaves Oia Epitome', location: 'Santorini, Greece', category: 'hotels' },
  { name: 'Amanzoe', location: 'Porto Heli, Greece', category: 'hotels' },
  { name: 'Costa Navarino', location: 'Messinia, Greece', category: 'hotels' },
  { name: 'Grace Hotel Santorini', location: 'Santorini, Greece', category: 'hotels' },
  { name: 'Kalesma', location: 'Mykonos, Greece', category: 'hotels' },
  { name: 'Bill & Coo', location: 'Mykonos, Greece', category: 'hotels' },
  { name: 'Eden Rock', location: 'St. Barths, Caribbean', category: 'hotels' },
  { name: 'Jade Mountain', location: 'St. Lucia, Resort', category: 'hotels' },
  { name: 'Sugar Beach Viceroy', location: 'St. Lucia, Caribbean', category: 'hotels' },
  { name: 'GoldenEye', location: 'Oracabessa, Jamaica', category: 'hotels' },
  { name: 'Chablé Yucatán', location: 'Chocholá, Mexico', category: 'hotels' },
  { name: 'Azulik', location: 'Tulum, Mexico', category: 'hotels' },
  { name: 'Hotel Esencia', location: 'Riviera Maya, Mexico', category: 'hotels' },
  { name: 'One&Only Palmilla', location: 'Los Cabos, Mexico', category: 'hotels' },
  { name: 'Belmond Maroma', location: 'Riviera Maya, Mexico', category: 'hotels' },
  { name: 'Amanyara', location: 'Turks & Caicos, Caribbean', category: 'hotels' },
  { name: 'Rosewood Baha Mar', location: 'Nassau, Bahamas', category: 'hotels' },
  { name: 'COMO Parrot Cay', location: 'Turks & Caicos, Caribbean', category: 'hotels' },
  { name: 'Montage Kapalua Bay', location: 'Maui, USA', category: 'hotels' },
  { name: 'Halekulani', location: 'Honolulu, USA', category: 'hotels' },
  { name: 'The Commodore Perry Estate', location: 'Austin, USA', category: 'hotels' },
  { name: 'Blackberry Mountain', location: 'Walland, TN, USA', category: 'hotels' },
  { name: 'Blackberry Farm', location: 'Walland, TN, USA', category: 'farms_estates' },
  { name: 'Post Ranch Inn', location: 'Big Sur, USA', category: 'hotels' },
  { name: 'Twin Farms', location: 'Barnard, VT, USA', category: 'hotels' },
  { name: 'The Resort at Paws Up', location: 'Greenough, MT, USA', category: 'hotels' },
  { name: 'Brush Creek Ranch', location: 'Saratoga, WY, USA', category: 'hotels' },
  { name: 'San Ysidro Ranch', location: 'Santa Barbara, USA', category: 'hotels' },
  { name: 'Montage Palmetto Bluff', location: 'Bluffton, SC, USA', category: 'hotels' },
  { name: 'Dunton Hot Springs', location: 'Dunton, CO, USA', category: 'hotels' },
  { name: 'The Little Nell', location: 'Aspen, USA', category: 'hotels' },
  { name: 'Lodge at Blue Sky', location: 'Park City, UT, USA', category: 'hotels' },
  { name: 'Sheldon Chalet', location: 'Denali, USA', category: 'hotels' },
  { name: 'Gleneagles', location: 'Perthshire, UK', category: 'hotels' },
  { name: 'The Fife Arms', location: 'Braemar, UK', category: 'hotels' },
  { name: 'Lime Wood', location: 'New Forest, UK', category: 'hotels' },
  { name: 'Heckfield Place', location: 'Hampshire, UK', category: 'hotels' },
  { name: 'The Pig Hotel', location: 'Hampshire, UK', category: 'hotels' },
  { name: 'Cliveden House', location: 'Berkshire, UK', category: 'hotels' },
  { name: 'Ballyfin Demesne', location: 'Laois, Ireland', category: 'hotels' },
  { name: 'Ashford Castle', location: 'Cong, Ireland', category: 'hotels' },
  { name: 'Adare Manor', location: 'Limerick, Ireland', category: 'hotels' },
  { name: 'Fogo Island Inn', location: 'Newfoundland, Canada', category: 'hotels' },
  { name: 'Disfrutar', location: 'Barcelona, Spain', category: 'restaurants' },
  { name: 'Asador Etxebarri', location: 'Axpe, Spain', category: 'restaurants' },
  { name: 'DiverXO', location: 'Madrid, Spain', category: 'restaurants' },
  { name: 'Maido', location: 'Lima, Peru', category: 'restaurants' },
  { name: 'Central', location: 'Lima, Peru', category: 'restaurants' },
  { name: 'Boragó', location: 'Santiago, Chile', category: 'restaurants' },
  { name: 'Den', location: 'Tokyo, Japan', category: 'restaurants' },
  { name: 'Florilège', location: 'Tokyo, Japan', category: 'restaurants' },
  { name: 'Narisawa', location: 'Tokyo, Japan', category: 'restaurants' },
  { name: 'Gaggan Anand', location: 'Bangkok, Thailand', category: 'restaurants' },
  { name: 'Le Du', location: 'Bangkok, Thailand', category: 'restaurants' },
  { name: 'Odette', location: 'Singapore', category: 'restaurants' },
  { name: 'Quintonil', location: 'Mexico City, Mexico', category: 'restaurants' },
  { name: 'Pujol', location: 'Mexico City, Mexico', category: 'restaurants' },
  { name: 'Atomix', location: 'New York, USA', category: 'restaurants' },
  { name: 'SingleThread', location: 'Healdsburg, USA', category: 'restaurants' },
  { name: 'Atelier Crenn', location: 'San Francisco, USA', category: 'restaurants' },
  { name: 'The Restaurant at Meadowood', location: 'Napa Valley, USA', category: 'restaurants' },
  { name: 'Wolfgat', location: 'Paternoster, South Africa', category: 'restaurants' },
  { name: 'Ikoyi', location: 'London, UK', category: 'restaurants' },
  { name: 'Jay Fai', location: 'Bangkok, Thailand', category: 'restaurants' },
  { name: 'Raan Jay Fai', location: 'Bangkok, Thailand', category: 'restaurants' },
  { name: 'Tsuta', location: 'Tokyo, Japan', category: 'restaurants' },
  { name: 'Tim Ho Wan', location: 'Hong Kong, China', category: 'restaurants' },
  { name: 'Hawker Chan', location: 'Singapore', category: 'restaurants' },
  { name: 'Cervecería Catalana', location: 'Barcelona, Spain', category: 'restaurants' },
  { name: 'Tacos El Califa de León', location: 'Mexico City, Mexico', category: 'restaurants' },
  { name: 'Bo Innovation', location: 'Hong Kong, China', category: 'restaurants' },
  { name: 'Lido 84', location: 'Gardone Riviera, Italy', category: 'restaurants' },
  { name: 'Burnt Ends', location: 'Singapore', category: 'restaurants' },
  { name: 'Paradiso', location: 'Barcelona, Spain', category: 'bars' },
  { name: 'Handshake Speakeasy', location: 'Mexico City, Mexico', category: 'bars' },
  { name: 'Jigger & Pony', location: 'Singapore', category: 'bars' },
  { name: 'Atlas Bar', location: 'Singapore', category: 'bars' },
  { name: 'BKK Social Club', location: 'Bangkok, Thailand', category: 'bars' },
  { name: 'Bar Benfiddich', location: 'Tokyo, Japan', category: 'bars' },
  { name: 'High Five', location: 'Tokyo, Japan', category: 'bars' },
  { name: 'The Clumsies', location: 'Athens, Greece', category: 'bars' },
  { name: 'Licorería Limantour', location: 'Mexico City, Mexico', category: 'bars' },
  { name: 'Coupette', location: 'London, UK', category: 'bars' },
  { name: 'Drink Kong', location: 'Rome, Italy', category: 'bars' },
  { name: 'Salmon Guru', location: 'Madrid, Spain', category: 'bars' },
  { name: 'Treehotel', location: 'Harads, Sweden', category: 'hotels' },
  { name: 'Kakslauttanen', location: 'Saariselkä, Finland', category: 'hotels' },
  { name: 'Arctic Treehouse Hotel', location: 'Rovaniemi, Finland', category: 'hotels' },
  { name: 'Icehotel', location: 'Jukkasjärvi, Sweden', category: 'hotels' },
  { name: 'The Muraka', location: 'Maldives, Underwater Villa', category: 'hotels' },
  { name: 'Bubble Lodges', location: 'Various, France', category: 'hotels' },
  { name: 'Giraffe Manor', location: 'Nairobi, Kenya', category: 'hotels' },
  { name: 'Skylodge Adventure Suites', location: 'Sacred Valley, Peru', category: 'hotels' },
  { name: 'Whitepod', location: 'Valais, Switzerland', category: 'hotels' },
  { name: 'Null Stern Hotel', location: 'Safiental, Switzerland', category: 'hotels' },
  { name: 'Kruger Shalati Train', location: 'Kruger, South Africa', category: 'experiences' },
  { name: 'Pantanal Jaguar Camp', location: 'Pantanal, Brazil', category: 'experiences' },
  { name: 'Venice Simplon-Orient-Express', location: 'London–Venice, Europe', category: 'experiences' },
  { name: 'Belmond Royal Scotsman', location: 'Scottish Highlands, UK', category: 'experiences' },
  { name: 'Rovos Rail', location: 'Pretoria–Cape Town, South Africa', category: 'experiences' },
  { name: 'The Ghan', location: 'Adelaide–Darwin, Australia', category: 'experiences' },
  { name: 'Rocky Mountaineer', location: 'Vancouver–Banff, Canada', category: 'experiences' },
  { name: 'Maharajas\' Express', location: 'Various Routes, India', category: 'experiences' },
  { name: 'Glacier Express', location: 'Zermatt–St. Moritz, Switzerland', category: 'experiences' },
  { name: 'Seven Stars Kyushu', location: 'Kyushu, Japan', category: 'experiences' },
  { name: 'SHA Wellness Clinic', location: 'Alicante, Spain', category: 'wellness' },
  { name: 'Buchinger Wilhelmi', location: 'Lake Constance, Germany', category: 'wellness' },
  { name: 'Lanserhof Tegernsee', location: 'Tegernsee, Germany', category: 'wellness' },
  { name: 'Kamalaya', location: 'Koh Samui, Thailand', category: 'wellness' },
  { name: 'Ananda in the Himalayas', location: 'Rishikesh, India', category: 'wellness' },
  { name: 'Chiva-Som', location: 'Hua Hin, Thailand', category: 'wellness' },
  { name: 'Vana Malsi Estate', location: 'Dehradun, India', category: 'wellness' },
  { name: 'Sensei Lanai', location: 'Lanai, USA', category: 'wellness' },
  { name: 'Cal-a-Vie', location: 'Vista, CA, USA', category: 'wellness' },
  { name: 'Miraval Austin', location: 'Austin, USA', category: 'wellness' },
  { name: 'Therme Vals', location: 'Vals, Switzerland', category: 'wellness' },
  { name: 'Friedrichsbad', location: 'Baden-Baden, Germany', category: 'wellness' },
  { name: 'Blue Lagoon Retreat', location: 'Grindavík, Iceland', category: 'wellness' },
  { name: 'Euphoria Retreat', location: 'Mystras, Greece', category: 'wellness' },
  { name: 'Château Smith Haut Lafitte', location: 'Bordeaux, France', category: 'farms_estates' },
  { name: 'Marqués de Riscal Gehry', location: 'Rioja, Spain', category: 'farms_estates' },
  { name: 'Bodega Garzón', location: 'Garzón, Uruguay', category: 'farms_estates' },
  { name: 'Domaine des Etangs', location: 'Charente, France', category: 'farms_estates' },
  { name: 'Abadía Retuerta LeDomaine', location: 'Ribera del Duero, Spain', category: 'farms_estates' },
  { name: 'Cavas Wine Lodge', location: 'Mendoza, Argentina', category: 'farms_estates' },
  { name: 'Delaire Graff Estate', location: 'Stellenbosch, South Africa', category: 'farms_estates' },
  { name: 'Borgo Egnazia', location: 'Puglia, Italy', category: 'hotels' },
  { name: 'Il Borro', location: 'Tuscany, Italy', category: 'farms_estates' },
  { name: 'Château de Bagnols', location: 'Beaujolais, France', category: 'farms_estates' },
  { name: 'The Lodge', location: 'Verbier, Switzerland', category: 'hotels' },
  { name: 'Chalet Zermatt Peak', location: 'Zermatt, Switzerland', category: 'hotels' },
  { name: 'Les Trois Vallées', location: 'Courchevel-Méribel, France', category: 'hotels' },
  { name: 'Aman Le Mélézin', location: 'Courchevel, France', category: 'hotels' },
  { name: 'San Lorenzo Mountain Lodge', location: 'Dolomites, Italy', category: 'hotels' },
  { name: 'Cervo Mountain Resort', location: 'Zermatt, Switzerland', category: 'hotels' },
  { name: 'Deplar Farm', location: 'Troll Peninsula, Iceland', category: 'hotels' },
  { name: 'Hotel & Spa Das Stue', location: 'Berlin, Germany', category: 'hotels' },
  { name: 'Vigilius Mountain Resort', location: 'South Tyrol, Italy', category: 'hotels' },
  { name: 'Ace Hotel Kyoto', location: 'Kyoto, Japan', category: 'hotels' },
  { name: 'The Standard Bangkok', location: 'Bangkok, Thailand', category: 'hotels' },
  { name: 'Hotel V Nesplein', location: 'Amsterdam, Netherlands', category: 'hotels' },
  { name: 'CitizenM', location: 'Various, Global', category: 'hotels' },
  { name: '25hours Hotel Bikini', location: 'Berlin, Germany', category: 'hotels' },
  { name: 'The Hoxton', location: 'Various, Global', category: 'hotels' },
  { name: 'Mama Shelter', location: 'Various, Global', category: 'hotels' },
  { name: 'QT Hotel', location: 'Melbourne, Australia', category: 'hotels' },
  { name: 'Hotel Neiburgs', location: 'Riga, Latvia', category: 'hotels' },
  { name: 'Generator', location: 'Various, Europe', category: 'hotels' },
  { name: 'Noma Pop-Up', location: 'Various, Global', category: 'restaurants' },
  { name: 'Alchemist', location: 'Copenhagen, Denmark', category: 'restaurants' },
  { name: 'teamLab Borderless', location: 'Tokyo, Japan', category: 'experiences' },
  { name: 'Dark Sky Reserves', location: 'Various, Global', category: 'experiences' },
  { name: 'Aman Jet Expeditions', location: 'Various, Global', category: 'experiences' },
  { name: 'Antarctic Expeditions', location: 'Antarctica', category: 'experiences' },
  { name: 'Silversea Expedition Cruises', location: 'Arctic/Antarctic, Global', category: 'experiences' },
  { name: 'Belmond Afloat in France', location: 'Burgundy, France', category: 'bars' },
  { name: 'Abercrombie & Kent Galápagos', location: 'Galápagos, Ecuador', category: 'experiences' },
  { name: 'Soneva Soul', location: 'Maldives', category: 'experiences' },
  { name: 'Casa Brutale', location: 'Aegean Sea, Greece', category: 'hotels' },
  { name: 'Masseria Moroseta', location: 'Puglia, Italy', category: 'farms_estates' },
  { name: 'Juvet Landscape Hotel', location: 'Valldal, Norway', category: 'hotels' },
  { name: '7132 Hotel', location: 'Vals, Switzerland', category: 'hotels' },
  { name: 'Areias do Seixo', location: 'Torres Vedras, Portugal', category: 'hotels' },
  { name: 'Hotel Neri', location: 'Barcelona, Spain', category: 'hotels' },
  { name: 'Bvlgari Hotel Tokyo', location: 'Tokyo, Japan', category: 'hotels' },
  { name: 'Alila Villas Uluwatu', location: 'Bali, Indonesia', category: 'hotels' },
  { name: 'Ion Adventure Hotel', location: 'Thingvellir, Iceland', category: 'hotels' },
  { name: 'Hotel Marqués de Riscal', location: 'Elciego, Spain', category: 'hotels' },
  { name: 'The Silo', location: 'Cape Town, South Africa', category: 'hotels' },
  { name: 'Morpheus Hotel', location: 'Macau, China', category: 'hotels' },
  { name: 'Kisawa Sanctuary', location: 'Benguerra Island, Mozambique', category: 'hotels' },
  { name: 'Museum Hotel Antakya', location: 'Antakya, Turkey', category: 'hotels' },
  { name: 'Palazzo Margherita', location: 'Bernalda, Italy', category: 'hotels' },
  { name: 'Grace Kelly Suite, Hôtel de Paris', location: 'Monte Carlo, Monaco', category: 'hotels' },
  { name: 'The Chedi Andermatt', location: 'Andermatt, Switzerland', category: 'hotels' },
  { name: 'Baur au Lac', location: 'Zurich, Switzerland', category: 'hotels' },
  { name: 'La Mamounia', location: 'Marrakech, Morocco', category: 'hotels' },
  { name: 'Claridge\'s', location: 'London, UK', category: 'hotels' },
  { name: 'The Connaught', location: 'London, UK', category: 'hotels' },
  { name: 'Park Hyatt Tokyo', location: 'Tokyo, Japan', category: 'hotels' },
  { name: 'Aman Tokyo', location: 'Tokyo, Japan', category: 'hotels' },
  { name: 'Hotel Negresco', location: 'Nice, France', category: 'hotels' },
  { name: 'Hospes Palacio de los Patos', location: 'Granada, Spain', category: 'hotels' },
  { name: 'Belmond Hotel Cipriani', location: 'Venice, Italy', category: 'hotels' },
  { name: 'Soneva Fushi', location: 'Baa Atoll, Maldives', category: 'hotels' },
  { name: 'Cocoa Island by COMO', location: 'Maldives', category: 'hotels' },
  { name: 'Joali Being', location: 'Bodufushi, Maldives', category: 'wellness' },
  { name: 'Como Castello del Nero', location: 'Tuscany, Italy', category: 'hotels' },
  { name: 'JK Place Capri', location: 'Capri, Italy', category: 'hotels' },
  { name: 'Borgo Santo Pietro', location: 'Tuscany, Italy', category: 'farms_estates' },
  { name: 'Coombeshead Farm', location: 'Cornwall, UK', category: 'farms_estates' },
  { name: 'Domaine de Fontenille', location: 'Luberon, France', category: 'farms_estates' },
  { name: 'Monteverdi Tuscany', location: 'Val d\'Orcia, Italy', category: 'farms_estates' },
  { name: 'Eremito', location: 'Umbria, Italy', category: 'wellness' },
  { name: 'Jetwing Vil Uyana', location: 'Sigiriya, Sri Lanka', category: 'hotels' },
  { name: 'Hacienda de San Antonio', location: 'Colima, Mexico', category: 'farms_estates' },
  { name: 'Alila Villas Koh Russey', location: 'Koh Russey, Cambodia', category: 'hotels' },
  { name: 'Mandapa Ritz-Carlton', location: 'Ubud, Bali', category: 'hotels' },
  { name: 'Amandari', location: 'Ubud, Bali', category: 'hotels' },
  { name: 'The Siam', location: 'Bangkok, Thailand', category: 'hotels' },
  { name: '137 Pillars House', location: 'Chiang Mai, Thailand', category: 'hotels' },
  { name: 'Keemala', location: 'Phuket, Thailand', category: 'hotels' },
  { name: 'Pangulasian Island', location: 'El Nido, Philippines', category: 'hotels' },
  { name: 'Umaid Bhawan Palace', location: 'Jodhpur, India', category: 'hotels' },
  { name: 'Rambagh Palace', location: 'Jaipur, India', category: 'hotels' },
  { name: 'Samode Palace', location: 'Jaipur, India', category: 'hotels' },
  { name: 'The Oberoi Amarvilas', location: 'Agra, India', category: 'hotels' },
  { name: 'Ahilya Fort', location: 'Maheshwar, India', category: 'hotels' },
  { name: 'Dwarika\'s Hotel', location: 'Kathmandu, Nepal', category: 'hotels' },
  { name: 'Amankora', location: 'Various, Bhutan', category: 'hotels' },
  { name: 'Gangtey Lodge', location: 'Phobjikha Valley, Bhutan', category: 'hotels' },
  { name: 'Al Maha Desert Resort', location: 'Dubai, UAE', category: 'hotels' },
  { name: 'Sharaan Resort', location: 'AlUla, Saudi Arabia', category: 'hotels' },
  { name: 'Dar Ahlam', location: 'Ouarzazate, Morocco', category: 'hotels' },
  { name: 'Feynan Ecolodge', location: 'Dana Reserve, Jordan', category: 'hotels' },
  { name: 'Beresheet Hotel', location: 'Mitzpe Ramon, Israel', category: 'hotels' },
  { name: 'Shipwreck Lodge', location: 'Skeleton Coast, Namibia', category: 'hotels' },
  { name: 'Hoanib Skeleton Coast Camp', location: 'Skeleton Coast, Namibia', category: 'experiences' },
  { name: 'Zannier Hotels Sonop', location: 'Namib Desert, Namibia', category: 'hotels' },
  { name: 'Volcanoes Safaris Bwindi', location: 'Bwindi, Uganda', category: 'experiences' },
  { name: 'Lewa Safari Camp', location: 'Lewa Conservancy, Kenya', category: 'experiences' },
  { name: 'Tongabezi', location: 'Victoria Falls, Zambia', category: 'hotels' },
  { name: 'Benguerra Island', location: 'Bazaruto, Mozambique', category: 'hotels' },
  { name: 'Longitude 131', location: 'Uluru, Australia', category: 'hotels' },
  { name: 'Awasi Atacama', location: 'San Pedro, Chile', category: 'hotels' },
  { name: 'Alto Atacama', location: 'Atacama, Chile', category: 'hotels' },
  { name: 'Belmond Hotel das Cataratas', location: 'Iguazú, Brazil', category: 'hotels' },
  { name: 'Hotel Antumalal', location: 'Pucón, Chile', category: 'hotels' },
  { name: 'Tierra Atacama', location: 'Atacama, Chile', category: 'hotels' },
  { name: 'Kura Design Villas', location: 'Uvita, Costa Rica', category: 'hotels' },
  { name: 'Nayara Springs', location: 'Arenal, Costa Rica', category: 'hotels' },
  { name: 'Belmond Sanctuary Lodge', location: 'Machu Picchu, Peru', category: 'hotels' },
  { name: 'Explora Valle Sagrado', location: 'Sacred Valley, Peru', category: 'hotels' },
  { name: 'Tierra Chiloé', location: 'Chiloé Island, Chile', category: 'hotels' },
  { name: 'Amangiri Utah Expansion (Camp Sarika)', location: 'Canyon Point, USA', category: 'hotels' },
  { name: 'Borgo Pignano', location: 'Volterra, Italy', category: 'farms_estates' },
  { name: 'Castiglion del Bosco', location: 'Montalcino, Italy', category: 'farms_estates' },
  { name: 'Hotel de Russie', location: 'Rome, Italy', category: 'hotels' },
  { name: 'Portrait Roma', location: 'Rome, Italy', category: 'hotels' },
  { name: 'Château Marmont', location: 'Los Angeles, USA', category: 'hotels' },
  { name: 'The Ned', location: 'London, UK', category: 'hotels' },
  { name: 'Ham Yard Hotel', location: 'London, UK', category: 'hotels' },
  { name: 'Hôtel Plaza Athénée', location: 'Paris, France', category: 'hotels' },
  { name: 'Le Bristol Paris', location: 'Paris, France', category: 'hotels' },
  { name: 'Ritz Paris', location: 'Paris, France', category: 'hotels' },
  { name: 'Conservatorium Hotel', location: 'Amsterdam, Netherlands', category: 'hotels' },
  { name: 'Sir Albert Hotel', location: 'Amsterdam, Netherlands', category: 'hotels' },
  { name: 'The Thief', location: 'Oslo, Norway', category: 'hotels' },
  { name: 'Hotel & Spa & Villas Nai Harn', location: 'Phuket, Thailand', category: 'hotels' },
  { name: 'Andronis Concept', location: 'Santorini, Greece', category: 'hotels' },
  { name: 'Geranium', location: 'Copenhagen, Denmark', category: 'restaurants' },
  { name: 'Table by Bruno Verjus', location: 'Paris, France', category: 'restaurants' },
  { name: 'Trèsind Studio', location: 'Dubai, UAE', category: 'restaurants' },
  { name: 'The Chairman', location: 'Hong Kong, China', category: 'restaurants' },
  { name: 'Frantzén', location: 'Stockholm, Sweden', category: 'restaurants' },
  { name: 'Don Julio', location: 'Buenos Aires, Argentina', category: 'restaurants' },
  { name: 'Belcanto', location: 'Lisbon, Portugal', category: 'restaurants' },
  { name: 'Rosetta', location: 'Mexico City, Mexico', category: 'restaurants' },
  { name: 'Schloss Schauenstein', location: 'Fürstenau, Switzerland', category: 'restaurants' },
  { name: 'The Test Kitchen', location: 'Cape Town, South Africa', category: 'restaurants' },
  { name: 'Elkano', location: 'Getaria, Spain', category: 'restaurants' },
  { name: 'D.O.M.', location: 'São Paulo, Brazil', category: 'restaurants' },
  { name: 'Le Calandre', location: 'Rubano, Italy', category: 'restaurants' },
  { name: 'Mugaritz', location: 'San Sebastián, Spain', category: 'restaurants' },
  { name: 'Restaurant de l\'Hôtel de Ville', location: 'Crissier, Switzerland', category: 'restaurants' },
  { name: 'Connaught Bar', location: 'London, UK', category: 'bars' },
  { name: 'Tayēr + Elementary', location: 'London, UK', category: 'bars' },
  { name: 'Sips', location: 'Barcelona, Spain', category: 'bars' },
  { name: 'Katana Kitten', location: 'New York, USA', category: 'bars' },
  { name: 'Maybe Sammy', location: 'Sydney, Australia', category: 'bars' },
  { name: 'Florería Atlántico', location: 'Buenos Aires, Argentina', category: 'bars' },
  { name: 'Himkok', location: 'Oslo, Norway', category: 'bars' },
  { name: 'Line', location: 'Athens, Greece', category: 'bars' },
  { name: 'Habitas Namibia', location: 'NamibRand, Namibia', category: 'hotels' },
  { name: 'Bajo el Sol Gallery Hotel', location: 'Puerto Vallarta, Mexico', category: 'hotels' },
  { name: 'Zeavola', location: 'Phi Phi Island, Thailand', category: 'hotels' },
  { name: 'Longitude 131°', location: 'Uluru, Australia', category: 'hotels' },
  { name: 'The Pig on the Beach', location: 'Studland, UK', category: 'hotels' },
  { name: 'Treehouse Hotel London', location: 'London, UK', category: 'hotels' },
  { name: 'Hoshinoya Fuji', location: 'Fujikawaguchiko, Japan', category: 'hotels' },
  { name: 'Soneva Secret', location: 'Maldives', category: 'hotels' },
  { name: 'Panchoran Retreat', location: 'Bali, Indonesia', category: 'wellness' },
  { name: 'Shinta Mani Angkor', location: 'Siem Reap, Cambodia', category: 'hotels' },
  { name: 'Six Senses Fort Barwara', location: 'Rajasthan, India', category: 'hotels' },
  { name: 'Alila Fort Bishangarh', location: 'Rajasthan, India', category: 'hotels' },
  { name: 'Awei Pila', location: 'Mergui, Myanmar', category: 'hotels' },
  { name: 'Chena Huts by Uga', location: 'Yala, Sri Lanka', category: 'hotels' },
  { name: 'Belmond Cap Juluca', location: 'Anguilla, Caribbean', category: 'hotels' },
  { name: 'Half Moon', location: 'Montego Bay, Jamaica', category: 'hotels' },
  { name: 'Jade Mountain St. Lucia', location: 'Soufrière, St. Lucia', category: 'hotels' },
  { name: 'Necker Island', location: 'British Virgin Islands, Caribbean', category: 'hotels' },
  { name: 'Song Saa Private Island', location: 'Koh Rong, Cambodia', category: 'hotels' },
  { name: 'Arctic Bath', location: 'Harads, Sweden', category: 'hotels' },
  { name: 'Svart Hotel', location: 'Svartisen, Norway', category: 'hotels' },
  { name: 'Explora Rapa Nui', location: 'Easter Island, Chile', category: 'hotels' },
  { name: 'Clayoquot Wilderness Lodge', location: 'Tofino, Canada', category: 'hotels' },
  { name: 'Nimmo Bay Wilderness Resort', location: 'Great Bear Rainforest, Canada', category: 'hotels' },
  { name: 'Fogo Island Inn', location: 'Newfoundland, Canada', category: 'hotels' },
  { name: 'Xigera Safari Lodge', location: 'Okavango Delta, Botswana', category: 'experiences' },
  { name: '&Beyond Sandibe', location: 'Okavango Delta, Botswana', category: 'experiences' },
  { name: 'Chinzombo', location: 'South Luangwa, Zambia', category: 'experiences' },
  { name: 'Arijiju Private Wilderness', location: 'Laikipia, Kenya', category: 'hotels' },
  { name: 'Noma Residence', location: 'Copenhagen, Denmark', category: 'restaurants' },
  { name: 'Treehotel Mirror Cube', location: 'Harads, Sweden', category: 'hotels' },
  { name: 'Juvet Landscape Hotel', location: 'Gudbrandsjuvet, Norway', category: 'hotels' },
  { name: 'Niehku Mountain Villa', location: 'Riksgränsen, Sweden', category: 'hotels' },
  { name: 'Post Ranch Inn', location: 'Big Sur, USA', category: 'hotels' },
  { name: 'Museum Hotel Cappadocia', location: 'Ürgüp, Turkey', category: 'hotels' },
  { name: 'Argos in Cappadocia', location: 'Uçhisar, Turkey', category: 'hotels' },
  { name: 'Mandarin Oriental Bodrum', location: 'Bodrum, Turkey', category: 'hotels' },
  { name: 'Amanruya', location: 'Bodrum, Turkey', category: 'hotels' },
  { name: 'Matangi Private Island', location: 'Fiji', category: 'hotels' },
  { name: 'Amanwana', location: 'Moyo Island, Indonesia', category: 'hotels' },
  { name: 'Misool Eco Resort', location: 'Raja Ampat, Indonesia', category: 'hotels' },
  { name: 'Jumby Bay Island', location: 'Antigua, Caribbean', category: 'hotels' },
  { name: 'Petit St. Vincent', location: 'Grenadines, Caribbean', category: 'hotels' },
  { name: 'Anse Chastanet', location: 'St. Lucia, Caribbean', category: 'hotels' },
  { name: 'Under Canvas Yellowstone', location: 'West Yellowstone, USA', category: 'hotels' },
  { name: 'Kenoza Hall', location: 'Sullivan County, NY, USA', category: 'hotels' },
  { name: 'The Ranch at Rock Creek', location: 'Philipsburg, MT, USA', category: 'hotels' },
  { name: 'Castle Hot Springs', location: 'Morristown, AZ, USA', category: 'hotels' },
  { name: 'Ventana Big Sur', location: 'Big Sur, USA', category: 'hotels' },
  { name: 'Auberge du Soleil', location: 'Napa Valley, USA', category: 'hotels' },
  { name: 'The Surf Lodge', location: 'Montauk, USA', category: 'hotels' },
  { name: 'Hiša Franko', location: 'Kobarid, Slovenia', category: 'restaurants' },
  { name: 'Kol', location: 'London, UK', category: 'restaurants' },
  { name: 'Etxebarri Grill Room', location: 'Axpe, Spain', category: 'restaurants' },
  { name: 'Noor', location: 'Córdoba, Spain', category: 'restaurants' },
  { name: 'Ultraviolet by Paul Pairet', location: 'Shanghai, China', category: 'restaurants' },
  { name: 'Ryugin', location: 'Tokyo, Japan', category: 'restaurants' },
  { name: 'Indian Accent', location: 'New Delhi, India', category: 'restaurants' },
  { name: 'Cosme', location: 'New York, USA', category: 'restaurants' },
  { name: 'Septime', location: 'Paris, France', category: 'restaurants' },
  { name: 'Alain Ducasse au Plaza Athénée', location: 'Paris, France', category: 'restaurants' },
  { name: 'Arzak', location: 'San Sebastián, Spain', category: 'restaurants' },
  { name: 'Eleven Madison Park', location: 'New York, USA', category: 'restaurants' },
  { name: 'Sukiyabashi Jiro', location: 'Tokyo, Japan', category: 'restaurants' },
  { name: 'Alinea', location: 'Chicago, USA', category: 'restaurants' },
  { name: 'Saison', location: 'San Francisco, USA', category: 'restaurants' },
  { name: 'Two Schmucks', location: 'Barcelona, Spain', category: 'bars' },
  { name: 'Bemelmans Bar', location: 'New York, USA', category: 'bars' },
  { name: 'American Bar at The Savoy', location: 'London, UK', category: 'bars' },
  { name: 'Charles H', location: 'Seoul, South Korea', category: 'bars' },
  { name: 'Manhattan Bar', location: 'Singapore', category: 'bars' },
  { name: 'Bar Trigona', location: 'Kuala Lumpur, Malaysia', category: 'bars' },
  { name: 'Native', location: 'Singapore', category: 'bars' },
  { name: 'Argo', location: 'Hong Kong, China', category: 'bars' },
  { name: 'Silversea Antarctica Bridge Cruise', location: 'Antarctica', category: 'experiences' },
  { name: 'Scenic Eclipse Submarine', location: 'Various, Global', category: 'experiences' },
  { name: 'Aman Private Jet Japan', location: 'Various, Japan', category: 'experiences' },
  { name: 'Natural Selection Camps', location: 'Botswana', category: 'experiences' },
  { name: 'Volcanoes National Park Hike', location: 'Hawaii, USA', category: 'experiences' },
  { name: 'Wadi Rum Bubble Camp', location: 'Wadi Rum, Jordan', category: 'hotels' },
  { name: 'Northern Lights Chase', location: 'Tromsø, Norway', category: 'experiences' },
  { name: 'Aman Zoe Fitness Retreat', location: 'Porto Heli, Greece', category: 'wellness' },
  { name: 'Great Migration Balloon', location: 'Serengeti, Tanzania', category: 'experiences' },
  { name: 'Pelagic Safari', location: 'Galápagos, Ecuador', category: 'experiences' },
  { name: 'Trans-Siberian Railway', location: 'Moscow–Vladivostok, Russia', category: 'experiences' },
  { name: 'Belmond Hiram Bingham', location: 'Cusco–Machu Picchu, Peru', category: 'experiences' },
  { name: 'Palazzo Danieli', location: 'Venice, Italy', category: 'hotels' },
  { name: 'Aman Kyoto', location: 'Kyoto, Japan', category: 'hotels' },
  { name: 'Mandarin Oriental Bangkok', location: 'Bangkok, Thailand', category: 'hotels' },
  { name: 'Singita Sasakwa', location: 'Grumeti, Tanzania', category: 'experiences' },
  { name: 'andBeyond Ngorongoro Crater Lodge', location: 'Ngorongoro, Tanzania', category: 'experiences' },
  { name: 'Singita Boulders', location: 'Sabi Sand, South Africa', category: 'experiences' },
  { name: 'Belmond Eagle Island Lodge', location: 'Okavango, Botswana', category: 'experiences' },
  { name: 'Hoshinoya Bali', location: 'Ubud, Bali', category: 'hotels' },
  { name: 'Oberoi Sukhvilas', location: 'Chandigarh, India', category: 'hotels' },
  { name: 'The Oberoi Udaivilas', location: 'Udaipur, India', category: 'hotels' },
  { name: 'Tswalu Kalahari', location: 'Kalahari, South Africa', category: 'experiences' },
  { name: 'Great Plains Conservation', location: 'Various, Africa', category: 'experiences' },
  { name: 'Park Hyatt Maldives', location: 'Hadahaa, Maldives', category: 'hotels' },
  { name: 'Soneva Jani', location: 'Noonu Atoll, Maldives', category: 'hotels' },
  { name: 'Velaa Private Island', location: 'Noonu Atoll, Maldives', category: 'hotels' },
  { name: 'Waldorf Astoria Maldives', location: 'Ithaafushi, Maldives', category: 'hotels' },
  { name: 'Cheval Blanc Randheli', location: 'Noonu Atoll, Maldives', category: 'hotels' },
  { name: 'Patina Maldives', location: 'Fari Islands, Maldives', category: 'hotels' },
  { name: 'Reethi Rah One&Only', location: 'North Malé, Maldives', category: 'hotels' },
  { name: 'Como Maalifushi', location: 'Thaa Atoll, Maldives', category: 'hotels' },
  { name: 'Joali Maldives', location: 'Raa Atoll, Maldives', category: 'hotels' },
  { name: 'Six Senses Shaharut', location: 'Negev Desert, Israel', category: 'hotels' },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const categoryFilter = args.find(a => a.startsWith('--category='))?.split('=')[1] || null;
  const batchSize = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1] || '0') || Infinity;
  const offset = parseInt(args.find(a => a.startsWith('--offset='))?.split('=')[1] || '0') || 0;

  if (!PLACES_API_KEY) {
    console.error('❌ GOOGLE_PLACES_API_KEY not set in .env');
    process.exit(1);
  }

  let properties = SEED_PROPERTIES;
  if (categoryFilter) {
    properties = properties.filter(p => p.category === categoryFilter);
  }
  properties = properties.slice(offset, offset + batchSize);

  console.log(`\n🌱 Terrazzo v3 Cluster Diversification Backfill`);
  console.log(`   Total in list: ${SEED_PROPERTIES.length}`);
  console.log(`   Processing: ${properties.length} (offset=${offset})`);
  console.log(`   Categories: ${[...new Set(properties.map(p => p.category))].join(', ')}`);
  if (dryRun) console.log(`   🏜️  DRY RUN — no database changes`);
  console.log();

  if (dryRun) {
    for (const p of properties) {
      console.log(`  [dry-run] ${p.name} — ${p.location} (${p.category})`);
    }
    console.log(`\n✅ Dry run complete. ${properties.length} properties would be seeded.`);
    // No pool needed for dry run
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set in .env');
    process.exit(1);
  }

  const client = await pool.connect();
  let created = 0, retriggered = 0, skipped = 0, failed = 0;

  try {
    const CONCURRENCY = 5;
    for (let i = 0; i < properties.length; i += CONCURRENCY) {
      const batch = properties.slice(i, i + CONCURRENCY);
      const batchNum = Math.floor(i / CONCURRENCY) + 1;
      const totalBatches = Math.ceil(properties.length / CONCURRENCY);
      console.log(`  ── Batch ${batchNum}/${totalBatches} (${i + 1}–${Math.min(i + CONCURRENCY, properties.length)} of ${properties.length}) ──`);

      const results = await Promise.allSettled(
        batch.map(async (prop) => {
          const query = `${prop.name}, ${prop.location}`;
          try {
            const googleResult = await searchPlace(query);
            if (!googleResult?.id) {
              console.log(`  ❌ ${prop.name} — no Google Places result`);
              return 'failed';
            }

            const googlePlaceId = googleResult.id;
            const resolvedName = googleResult.displayName?.text || prop.name;
            // Infer placeType from category
            const placeType = prop.category === 'restaurants' ? 'restaurant'
              : prop.category === 'bars' ? 'bar'
              : prop.category === 'experiences' ? 'experience'
              : prop.category === 'wellness' ? 'hotel'
              : prop.category === 'farms_estates' ? 'hotel'
              : 'hotel';

            const result = await ensureEnrichment(client, googlePlaceId, resolvedName, placeType);

            const icon = result.action === 'created' ? '✅' : result.action === 'retriggered' ? '🔄' : '⏭️';
            console.log(`  ${icon} ${resolvedName} (${googlePlaceId}) → ${result.action}`);
            return result.action;
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

      if (i + CONCURRENCY < properties.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  } finally {
    client.release();
  }

  console.log(`\n📊 Backfill Summary:`);
  console.log(`   ✅ Created:      ${created}`);
  console.log(`   🔄 Re-triggered: ${retriggered}`);
  console.log(`   ⏭️  Skipped:      ${skipped}`);
  console.log(`   ❌ Failed:       ${failed}`);
  console.log(`   Total:          ${properties.length}`);
  console.log(`\n📌 All new rows have status='pending'. Run your enrichment command to process them.`);

  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
