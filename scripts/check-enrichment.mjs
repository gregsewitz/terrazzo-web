import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL });

// PlaceIntelligence holds the enrichment data
const { rows } = await pool.query(`
  SELECT "propertyName" as name, status, "reliabilityScore" as reliability,
         "signalCount" as signals, "reviewCount" as reviews
  FROM "PlaceIntelligence"
  ORDER BY "reliabilityScore" DESC NULLS LAST
`);

const byStatus = {};
rows.forEach(r => {
  byStatus[r.status] = (byStatus[r.status] || 0) + 1;
});
console.log('Total:', rows.length);
console.log('By status:', JSON.stringify(byStatus, null, 2));

const complete = rows.filter(r => r.status === 'complete');
console.log(`\nComplete (${complete.length}):`);
complete.forEach(r =>
  console.log(`  ${r.name} — ${r.signals} signals, ${r.reviews} reviews, reliability ${(r.reliability || 0).toFixed(3)}`)
);

const other = rows.filter(r => r.status !== 'complete');
if (other.length) {
  console.log(`\nNot complete (${other.length}):`);
  other.forEach(r => console.log(`  [${r.status}] ${r.name}`));
}

await pool.end();
