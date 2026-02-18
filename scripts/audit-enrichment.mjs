import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL });

const { rows } = await pool.query(`
  SELECT "propertyName" as name, status, "reliabilityScore" as reliability,
         "signalCount" as signals, "reviewCount" as reviews,
         "sourcesProcessed" as sources
  FROM "PlaceIntelligence"
  WHERE status = 'complete'
  ORDER BY "reliabilityScore" ASC NULLS FIRST
`);

console.log('=== Enrichment Audit ===\n');

const issues = [];

rows.forEach(r => {
  const sources = r.sources ? (typeof r.sources === 'string' ? JSON.parse(r.sources) : r.sources) : {};
  const reviewSignals = sources.review_new_signals || 0;
  const problems = [];

  if (r.reliability === null || r.reliability === 0) problems.push('no reliability score');
  if (r.reviews === 0) problems.push('0 reviews processed');
  if (r.signals <= 5) problems.push(`only ${r.signals} signals`);
  if (reviewSignals === 0 && r.signals > 0) problems.push('no review signals (only menu/editorial)');
  if (r.reliability !== null && r.reliability < 0.5) problems.push(`low reliability ${r.reliability.toFixed(3)}`);

  if (problems.length > 0) {
    issues.push({ ...r, sources, problems });
  }
});

if (issues.length === 0) {
  console.log('All places look healthy!');
} else {
  console.log(`Found ${issues.length} places with potential issues:\n`);
  issues.forEach(r => {
    console.log(`  ${r.name}`);
    console.log(`    Signals: ${r.signals} | Reviews: ${r.reviews} | Reliability: ${r.reliability !== null ? r.reliability.toFixed(3) : 'NULL'}`);
    console.log(`    Sources: ${JSON.stringify(r.sources)}`);
    console.log(`    Issues: ${r.problems.join(', ')}`);
    console.log();
  });
}

// Also check non-complete
const { rows: incomplete } = await pool.query(`
  SELECT "propertyName" as name, status
  FROM "PlaceIntelligence"
  WHERE status != 'complete'
  ORDER BY status, "propertyName"
`);

if (incomplete.length > 0) {
  console.log(`\n=== Still not complete (${incomplete.length}) ===`);
  incomplete.forEach(r => console.log(`  [${r.status}] ${r.name}`));
}

await pool.end();
