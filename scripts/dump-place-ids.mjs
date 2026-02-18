import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL });

const { rows } = await pool.query(`
  SELECT "propertyName" as name, "googlePlaceId" as id
  FROM "PlaceIntelligence"
  ORDER BY "propertyName"
`);

console.log('// Google Place ID mapping from PlaceIntelligence');
console.log('const PLACE_IDS: Record<string, string> = {');
rows.forEach(r => {
  console.log(`  ${JSON.stringify(r.name)}: ${JSON.stringify(r.id)},`);
});
console.log('};');

await pool.end();
