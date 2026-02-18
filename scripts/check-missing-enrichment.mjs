/**
 * Check which places in demo data are missing from PlaceIntelligence
 * and optionally trigger enrichment for them.
 *
 * Usage:
 *   node scripts/check-missing-enrichment.mjs          # just check
 *   node scripts/check-missing-enrichment.mjs --enrich  # check + trigger
 */
import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL });

// All placeIds from demoTrips.ts and demoSaved.ts
const ALL_DEMO_PLACE_IDS = [
  // demoTrips.ts (77 places)
  'ChIJ5dbUPWqdX0YRmE5enY3QHQk', 'ChIJhwomM2edX0YR9gW2q53gJRg',
  'ChIJjRRMnFydX0YR1B4u6G720yk', 'ChIJ7QBKvuV3X0YRHP5IH4gh4jw',
  'ChIJc6euFuV3X0YRQmY6ng8b2Ho', 'ChIJhaN0M_l3X0YRpOq8uRb_RcA',
  'ChIJ5y_62_l3X0YRncn3q5XuTZw', 'ChIJrZBLWMR3X0YR-K4amPgKyas',
  'ChIJS0lDDPt3X0YRUkxtWrFqcr4', 'ChIJBz7hJkFCX0YROzC0Oj37GyI',
  'ChIJc9vs0n6vVkYRZhWuwxhjo2c', 'ChIJpYCQZztTUkYRFOE368Xs6kI',
  'ChIJpYCQZztTUkYRb2QOlnW8vvE', 'ChIJ1Y52MZlTUkYRuDl4FNhYh_U',
  'ChIJq5pUwwc3UkYRTpARr0S5L2o', 'ChIJZ7zZTlNSUkYRyLDqc9LDb8U',
  'ChIJfdikRRFTUkYRDaGpK1d168U', 'ChIJdetm4dJTUkYR_I877IH5twI',
  'ChIJW8qasmlTUkYRsQoTFA-cyzQ',
  // Mexico City
  'ChIJy1_Zbir50YURUnwJLPPiGcw', 'ChIJWZ2zdav40YURFvsU_rU3uaE',
  'ChIJez8vvy__0YURP0rx5WhEig4', 'ChIJ_3DO2x7_0YURvIlJiTo6cds',
  'ChIJ0Q5aE0D_0YURSgPnuAqiwlY', 'ChIJX03s9zr_0YURHdcjFe9hbiE',
  'ChIJdw0B4zv_0YURK8xSHYwyp2E', 'ChIJczgiA9X-0YURqRON9mN1nMA',
  'ChIJBaY0hUH_0YURUKakmtuhj78', 'ChIJb8brj_n_0YURP6P7j8_u4J0',
  'ChIJ0Z9P0z7_0YURVqrnz-OpFms', 'ChIJdSGAWgP_0YURwNtY7rftf2E',
  'ChIJUYDQNgL_0YURYhvNnCzntYY', 'ChIJr52Eqz7_0YURVTs9tKiIYTg',
  'ChIJ0xMLW9D_0YURzLNI-8h3_2s', 'ChIJXcr6SVf_0YUR8EnDiX-bXqI',
  'ChIJxa1_2i7_0YURgd4u9aNEAiY', 'ChIJScjIILQB0oURJMVub-MaI4Q',
  'ChIJv0LcYRoC0oURwXXz3593qE8', 'ChIJAd0jvtz_0YURkB_9OyD0xd4',
  // Paris
  'ChIJq537gddx5kcR_3PhRd2muxg', 'ChIJWRpFMgdu5kcRsRVTLrySPkE',
  'ChIJ5-Wt8AZu5kcRwI6zQEwdXv4', 'ChIJh8xrJAdu5kcRa9A63MddGww',
  'ChIJZ23k0_9t5kcRZDrPK2jsCgs', 'ChIJaXXlBgBu5kcRzeSQ0Um9YSg',
  'ChIJZbQv_-dx5kcRARl8yz3wTu0', 'ChIJE6kCUghy5kcRmWSg3RUHIwM',
  'ChIJDxNp1_Bt5kcRfBQ1nlGxQoQ', 'ChIJq6qeN_1t5kcRBB41bdSmwgc',
  'ChIJ__8PhT1u5kcR0iPz_AGQoIk', 'ChIJ_aCXeQBy5kcR4ZxoRALxHhY',
  'ChIJl2seqwpu5kcRbK__DgbbBcM', 'ChIJF4z0gwZu5kcRmxOUEU2R8Iw',
  'ChIJDSzfrABu5kcRJTf3iV__JCg', 'ChIJ6UrOzQNu5kcRRp5vRIClzzg',
  'ChIJo6qq6i5u5kcRCpYBp4rQP9w', 'ChIJC0I3-eZv5kcRHaMcXnrRLsk',
  'ChIJB7rdOORv5kcR-wErkFxC9nw', 'ChIJT1_m5D1u5kcRJEdj4Ln_wCY',
  // Sicily
  'ChIJ5QrHTJ8RFBMRUzfUaMkAT6o', 'ChIJt1ptUvPlGRMRJ1lE1mqEcJA',
  'ChIJwStnHC_jExMRlVux7ojgnyY', 'ChIJqzQ-W64pEhMRcvc7t5uIW7s',
  'ChIJweeeS64pEhMRyINd-HSggzA', 'ChIJT0_-TxrMExMRWvRZDC70lEk',
  'ChIJAVj3phzNExMR4zKozbWaxnI', 'ChIJnSAg76nlGRMRreH53Vtx0ss',
  'ChIJzctdA3iZERMR_umre_dNRko', 'ChIJ-Ubp9aQRFBMRia-tUElz2Ug',
  'ChIJt0ILdWg4FxMRcuNoDGcESIc', 'ChIJbTZFgdk7FxMRElGDX_ywuqI',
  'ChIJPeXWjezJEBMRDMn0Uejr6cM', 'ChIJy24F2rZ-FhMR_0Z8ZJWasnM',
  'ChIJ45G0-1qqFhMRuw00x205jQc', 'ChIJS-Q2slCBGRMRl_oVvG-xwKo',
  'ChIJt6XuxTOCEBMRnrwHMdW4k_Y', 'ChIJcdpBykp5GhMRLgLTCaHpkMM',
  'ChIJq1fSrxOKERMRUxbJHthqquw',
  // demoSaved.ts (new)
  'ChIJr7FOf5NZwokRu3CDYtzVmuQ', 'ChIJJyPbJe1ZwokRu8dDEOqAYDc',
  'ChIJDbQMBIdZwokRVS4L8B8V5SA', 'ChIJEWbXz6ZZwokRLKmKrtPfVFY',
  'ChIJ2fdTNEBZwokRcAtK9PyqDAs', 'ChIJHUufNvVZwokRaO5ke5RQ46c',
  'ChIJyw5j84lZwokRnUI_UknPSNA', 'ChIJfxC19JVZwokRX2uKgQAL17c',
  'ChIJ-7AOKpRZwokRMq0XnG_eehU', 'ChIJxy0SM0xZwokR5vC0f4wVlP0',
  'ChIJWxHBP2JZwokRAAym2RpX-OQ', 'ChIJmSvG_ZFZwokRTOFeiLXzkmA',
  'ChIJKUrdFZRZwokRZVtxUGr1A3A', 'ChIJI25hF09ZwokRnmmiXXONRf4',
  'ChIJ3bmAHghZwokRRXYO57yLuss', 'ChIJq6r-exhawokRKgBzzPkn57U',
  'ChIJMywZv36FdUgRABdFDwGzVms', 'ChIJO5qTOL0pxkcRnF-GPvSpAAQ',
  'ChIJF2p7bUpZwokRPE_FYw6iL4M',
];

const uniqueIds = [...new Set(ALL_DEMO_PLACE_IDS)];

console.log(`Total unique Place IDs in demo data: ${uniqueIds.length}\n`);

// Check which are in PlaceIntelligence
const { rows } = await pool.query(`
  SELECT "googlePlaceId", "propertyName", status, "reliabilityScore", "signalCount"
  FROM "PlaceIntelligence"
  WHERE "googlePlaceId" = ANY($1)
`, [uniqueIds]);

const enrichedMap = new Map(rows.map(r => [r.googlePlaceId, r]));

const missing = uniqueIds.filter(id => !enrichedMap.has(id));
const incomplete = rows.filter(r => r.status !== 'complete');

console.log(`In PlaceIntelligence: ${rows.length}`);
console.log(`Missing from PlaceIntelligence: ${missing.length}`);
console.log(`Incomplete enrichment: ${incomplete.length}\n`);

if (missing.length > 0) {
  console.log('MISSING (need to be added to PlaceIntelligence):');
  missing.forEach(id => console.log(`  ${id}`));
}

if (incomplete.length > 0) {
  console.log('\nINCOMPLETE:');
  incomplete.forEach(r => console.log(`  ${r.propertyName}: ${r.status} (signals: ${r.signalCount})`));
}

if (missing.length === 0 && incomplete.length === 0) {
  console.log('✓ All demo places are fully enriched!');
}

await pool.end();
