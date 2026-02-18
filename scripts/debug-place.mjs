import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({ path: '.env.local' });

const name = process.argv[2] || 'Le Servan';
const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL });

// Get PlaceIntelligence record
const { rows: intel } = await pool.query(`
  SELECT id, "googlePlaceId", "propertyName", status, "pipelineVersion",
         "signalCount", "antiSignalCount", "reviewCount", "reliabilityScore",
         "sourcesProcessed", "lastEnrichedAt", "createdAt", "updatedAt"
  FROM "PlaceIntelligence"
  WHERE "propertyName" ILIKE $1
`, [`%${name}%`]);

if (intel.length === 0) {
  console.log('No PlaceIntelligence found for:', name);
  await pool.end();
  process.exit(1);
}

const pi = intel[0];
console.log('=== PlaceIntelligence ===');
console.log('  Name:', pi.propertyName);
console.log('  Google Place ID:', pi.googlePlaceId);
console.log('  Status:', pi.status);
console.log('  Pipeline Version:', pi.pipelineVersion);
console.log('  Signals:', pi.signalCount, '| Anti-signals:', pi.antiSignalCount);
console.log('  Reviews:', pi.reviewCount, '| Reliability:', pi.reliabilityScore);
console.log('  Sources:', pi.sourcesProcessed);
console.log('  Last enriched:', pi.lastEnrichedAt);
console.log('  Updated:', pi.updatedAt);

// Get pipeline runs
const { rows: runs } = await pool.query(`
  SELECT id, status, "startedAt", "completedAt", "stagesCompleted", error, metadata
  FROM "PipelineRun"
  WHERE "placeIntelligenceId" = $1
  ORDER BY "startedAt" DESC
`, [pi.id]);

console.log(`\n=== Pipeline Runs (${runs.length}) ===`);
runs.forEach((r, i) => {
  console.log(`\n  Run ${i + 1}:`);
  console.log('    Status:', r.status);
  console.log('    Started:', r.startedAt);
  console.log('    Completed:', r.completedAt);
  console.log('    Stages:', r.stagesCompleted);
  if (r.error) console.log('    ERROR:', r.error);
  if (r.metadata) console.log('    Metadata:', typeof r.metadata === 'string' ? r.metadata.slice(0, 200) : JSON.stringify(r.metadata).slice(0, 200));
});

await pool.end();
