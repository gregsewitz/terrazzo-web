import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Reset Ett Hem
await pool.query(`UPDATE "PlaceIntelligence" SET status = 'pending', signals = '[]', "antiSignals" = '[]', "reviewCount" = 0, "signalCount" = 0, "reliabilityScore" = NULL WHERE "googlePlaceId" = 'ChIJ5dbUPWqdX0YRmE5enY3QHQk'`);
console.log('Reset Ett Hem to pending');

// Get the record ID
const { rows } = await pool.query(`SELECT id FROM "PlaceIntelligence" WHERE "googlePlaceId" = 'ChIJ5dbUPWqdX0YRmE5enY3QHQk'`);
const placeIntelligenceId = rows[0].id;

// Trigger pipeline
const res = await fetch('https://inn.gs/e/' + process.env.INNGEST_EVENT_KEY, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'pipeline/run', data: {
    googlePlaceId: 'ChIJ5dbUPWqdX0YRmE5enY3QHQk',
    propertyName: 'Ett Hem',
    placeIntelligenceId,
    trigger: 'manual'
  }})
});
console.log('Triggered:', await res.json());

// Poll for completion
const start = Date.now();
const interval = setInterval(async () => {
  const r = await pool.query(`SELECT status, "signalCount", "reviewCount", "reliabilityScore" FROM "PlaceIntelligence" WHERE "googlePlaceId" = 'ChIJ5dbUPWqdX0YRmE5enY3QHQk'`);
  const row = r.rows[0];
  const elapsed = Math.round((Date.now() - start) / 1000);
  if (row.status === 'complete') {
    console.log(`Done in ${elapsed}s — ${row.signalCount} signals, ${row.reviewCount} reviews, reliability: ${row.reliabilityScore}`);
    clearInterval(interval);
    pool.end();
  } else {
    console.log(`${elapsed}s — status: ${row.status}`);
  }
  if (Date.now() - start > 900000) { clearInterval(interval); pool.end(); }
}, 15000);
