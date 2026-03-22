/**
 * Targeted Accolades Backfill
 *
 * Re-runs ONLY the character_analysis pipeline stage for places that have
 * completed enrichment but empty/null accolades, then patches the result
 * directly onto PlaceIntelligence. Much cheaper than a full re-enrichment
 * (~1 LLM call per place instead of ~10).
 *
 * The stage is called without cached reviews (those live in PipelineStageResult
 * and are internal to the worker). The LLM can still detect awards from:
 *   1. Its training knowledge of well-known award-winning places
 *   2. The existing signals passed as context (which often mention awards)
 * This means coverage is best for notable places (Michelin, 50 Best, etc.)
 * and weaker for obscure local lists. A full re-enrichment via the backfill
 * API would give the most comprehensive results at higher cost.
 *
 * Usage:
 *   npx tsx scripts/backfill-accolades.ts                  # dry run
 *   npx tsx scripts/backfill-accolades.ts --execute         # actually run
 *   npx tsx scripts/backfill-accolades.ts --execute --limit=20  # first 20 places
 *
 * Requires:
 *   PIPELINE_WORKER_URL env var (e.g. https://terrazzo-pipeline-worker-production.up.railway.app)
 *   DATABASE_URL env var (standard Prisma connection)
 */

import { prisma } from '../src/lib/prisma';

const PIPELINE_WORKER_URL = process.env.PIPELINE_WORKER_URL || '';
const args = process.argv.slice(2);
const execute = args.includes('--execute');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

async function main() {
  console.log(`\n📋 Accolades Backfill — ${execute ? 'EXECUTE MODE' : 'DRY RUN'}`);
  if (limit) console.log(`   Limit: ${limit} places`);
  console.log('');

  // Find places with completed enrichment but empty accolades
  const candidates = await prisma.placeIntelligence.findMany({
    where: {
      status: 'complete',
      OR: [
        { accolades: { equals: null } },
        { accolades: { equals: [] } },
      ],
    },
    select: {
      id: true,
      googlePlaceId: true,
      propertyName: true,
      signals: true,
      placeType: true,
    },
    orderBy: { lastEnrichedAt: 'desc' },
    ...(limit ? { take: limit } : {}),
  });

  console.log(`Found ${candidates.length} places with empty accolades\n`);

  if (candidates.length === 0) {
    console.log('Nothing to backfill!');
    process.exit(0);
  }

  // Show what we'd process
  for (const place of candidates) {
    console.log(`  ${place.propertyName} (${place.googlePlaceId}) — type: ${place.placeType || 'unknown'}`);
  }

  if (!execute) {
    console.log(`\n🔍 Dry run complete. Run with --execute to process these places.`);
    process.exit(0);
  }

  console.log(`\n🚀 Starting backfill...\n`);

  let success = 0;
  let errors = 0;
  let withAccolades = 0;

  for (const place of candidates) {
    try {
      console.log(`Processing: ${place.propertyName}...`);

      // Call the pipeline worker's /run endpoint with just the character_analysis stage
      const existingSignals = Array.isArray(place.signals) ? place.signals : [];

      const res = await fetch(`${PIPELINE_WORKER_URL}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: 'character_analysis',
          propertyName: place.propertyName,
          googlePlaceId: place.googlePlaceId,
          placeType: place.placeType || 'hotel',
          existingSignals: existingSignals.slice(0, 15),
          reviews: {}, // pipeline will use cached reviews from placesData
          placesData: {},
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.log(`  ❌ Pipeline returned ${res.status}: ${errText.slice(0, 100)}`);
        errors++;
        continue;
      }

      const result = await res.json() as {
        accolades?: Array<{ type: string; value: string; year?: string | null; category?: string }>;
        signals?: unknown[];
      };

      const accolades = result.accolades || [];
      console.log(`  ✓ Got ${accolades.length} accolades`);

      if (accolades.length > 0) {
        withAccolades++;
        // Patch directly onto PlaceIntelligence
        await prisma.placeIntelligence.update({
          where: { id: place.id },
          data: { accolades: accolades as any },
        });
        console.log(`  → Saved: ${accolades.map(a => `${a.type}${a.value ? ` (${a.value})` : ''}`).join(', ')}`);
      } else {
        // Mark as explicitly empty array so we don't re-process
        await prisma.placeIntelligence.update({
          where: { id: place.id },
          data: { accolades: [] },
        });
        console.log(`  → No accolades found, marked as []`);
      }

      success++;

      // Small delay to avoid hammering the pipeline worker
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.log(`  ❌ Error: ${err instanceof Error ? err.message : String(err)}`);
      errors++;
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Backfill complete:`);
  console.log(`  Processed: ${success}/${candidates.length}`);
  console.log(`  With accolades: ${withAccolades}`);
  console.log(`  Errors: ${errors}`);
  console.log(`${'='.repeat(50)}\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
