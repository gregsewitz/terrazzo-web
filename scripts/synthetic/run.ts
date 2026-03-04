#!/usr/bin/env tsx
/**
 * Terrazzo Synthetic User Pipeline — CLI Entry Point
 *
 * Usage:
 *   npx tsx scripts/synthetic/run.ts --mode full --archetypes 10 --variations 5
 *   npx tsx scripts/synthetic/run.ts --mode matching-only
 *   npx tsx scripts/synthetic/run.ts --mode extraction-audit --archetype minimalist-pilgrim
 *
 * Modes:
 *   full             — Persona generation → real onboarding extraction → post-onboarding
 *                      behavior → match scoring → feed allocation → diagnostics
 *   matching-only    — Load cached profiles → match scoring → feed allocation → diagnostics
 *   extraction-audit — Persona generation → real extraction → compare vs expected signals
 */

import { DEFAULT_CONFIG, parseCliArgs, type SyntheticConfig } from './config';
import { loadArchetypes, listArchetypeIds, type TasteArchetype } from './archetypes';
import { runArchetypeVariations, type SyntheticUserResult } from './simulator/orchestrator';
import {
  evaluateAllMatches,
  loadPropertiesFromFixture,
  loadPropertiesFromDb,
  type EnrichedProperty,
  type CrossArchetypeReport,
} from './simulator/match-runner';
import { checkExtractionAccuracy } from './evaluator/metrics';
import * as fs from 'fs';
import * as path from 'path';

// ─── Results directory ──────────────────────────────────────────────────────

const RESULTS_DIR = path.join(__dirname, 'results');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function ensureResultsDir() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

// ─── Property Loading ───────────────────────────────────────────────────────

async function loadProperties(): Promise<EnrichedProperty[]> {
  // Try fixture first (for CI / offline / development)
  const fixturePath = path.join(FIXTURES_DIR, 'enriched-properties.json');
  if (fs.existsSync(fixturePath)) {
    console.log(`  Loading properties from fixture: ${fixturePath}`);
    return loadPropertiesFromFixture(fixturePath);
  }

  // Fall back to Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('  No fixture found and no Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    console.error(`  Or create a fixture at: ${fixturePath}`);
    process.exit(1);
  }

  console.log('  Loading properties from Supabase...');
  return loadPropertiesFromDb(supabaseUrl, supabaseKey);
}

// ─── Cost Estimation Helper ─────────────────────────────────────────────────

function estimateDollarCost(cost: SyntheticUserResult['estimatedCost']): number {
  // Rough estimate: ~$0.01 per voice generation call (Haiku), ~$0.005 per analyze call (Sonnet short prompt)
  // ~$0.02 per synthesize call (Sonnet long prompt)
  return (cost.voiceGenerationCalls * 0.01) +
         (cost.analyzeApiCalls * 0.005) +
         (cost.synthesizeApiCalls * 0.02);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const cliOverrides = parseCliArgs(process.argv.slice(2));
  const config: SyntheticConfig = { ...DEFAULT_CONFIG, ...cliOverrides };

  // Fill in from env if not provided via CLI
  if (!config.anthropicApiKey) {
    config.anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';
  }

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║       TERRAZZO SYNTHETIC USER PIPELINE           ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
  console.log(`  Mode:        ${config.mode}`);
  console.log(`  Archetypes:  ${config.archetypes.length ? config.archetypes.join(', ') : 'all'}`);
  console.log(`  Variations:  ${config.variationsPerArchetype} per archetype`);
  console.log(`  API base:    ${config.apiBaseUrl}`);
  console.log(`  Post-onboard: ${config.includePostOnboarding}`);
  console.log(`  Persist to DB: ${config.persistToDb}`);
  console.log('');

  // Load archetypes
  const archetypes = loadArchetypes(config.archetypes.length ? config.archetypes : undefined);
  console.log(`Loaded ${archetypes.length} archetypes: ${archetypes.map(a => a.id).join(', ')}\n`);

  if (archetypes.length === 0) {
    console.log('Available archetypes:', listArchetypeIds().join(', '));
    console.error('\nNo archetypes found. Add JSON files to scripts/synthetic/archetypes/');
    process.exit(1);
  }

  switch (config.mode) {
    case 'full':
      await runFullPipeline(archetypes, config);
      break;
    case 'matching-only':
      await runMatchingOnly(archetypes, config);
      break;
    case 'extraction-audit':
      await runExtractionAudit(archetypes, config);
      break;
  }
}

// ─── MODE: FULL ──────────────────────────────────────────────────────────────

async function runFullPipeline(archetypes: TasteArchetype[], config: SyntheticConfig) {
  ensureResultsDir();

  if (!config.anthropicApiKey) {
    console.error('ANTHROPIC_API_KEY is required for full pipeline mode.');
    process.exit(1);
  }

  // ── Step 1: Generate synthetic users via hybrid onboarding ──
  console.log('── STEP 1: Running hybrid onboarding simulation ──\n');

  const allResults: SyntheticUserResult[] = [];

  for (const archetype of archetypes) {
    console.log(`\n▸ Archetype: ${archetype.name} (${archetype.id})`);
    console.log(`  Running ${config.variationsPerArchetype} variations...\n`);

    const results = await runArchetypeVariations(archetype, config);

    for (const result of results) {
      const signalCount = result.allSignals.length;
      const voiceSignals = result.allSignals.filter(s => s.confidence >= 0.5).length;
      const cost = estimateDollarCost(result.estimatedCost).toFixed(3);
      const profile = result.synthesizedProfile ? '✓' : '✗';
      console.log(`  Variation seed=${result.variation.seed}: ${signalCount} signals (${voiceSignals} high-conf), profile=${profile}, cost=$${cost}`);
    }

    allResults.push(...results);
  }

  // Cache profiles for future matching-only runs
  const cachedProfilesPath = path.join(RESULTS_DIR, 'cached-profiles.json');
  fs.writeFileSync(cachedProfilesPath, JSON.stringify(allResults.map(r => ({
    archetypeId: r.archetypeId,
    variation: r.variation,
    synthesizedProfile: r.synthesizedProfile,
    allSignals: r.allSignals,
    allMessages: r.allMessages,
    contradictions: r.contradictions,
    certainties: r.certainties,
    timing: r.timing,
    estimatedCost: r.estimatedCost,
  })), null, 2));
  console.log(`\n  Cached ${allResults.length} profiles to ${cachedProfilesPath}\n`);

  // ── Step 2: Match scoring ──
  console.log('── STEP 2: Evaluating matches ──\n');

  const properties = await loadProperties();
  console.log(`  Loaded ${properties.length} enriched properties\n`);

  if (properties.length === 0) {
    console.warn('  No properties found — skipping match evaluation.');
    console.warn('  Create a fixture at fixtures/enriched-properties.json or configure Supabase.\n');
  } else {
    const report = evaluateAllMatches(allResults, archetypes, properties, config);

    // ── Step 3: Generate diagnostics report ──
    console.log('── STEP 3: Generating diagnostics report ──\n');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(RESULTS_DIR, `report-full-${timestamp}.md`);
    const jsonPath = path.join(RESULTS_DIR, `report-full-${timestamp}.json`);

    const markdown = generateMarkdownReport(report, archetypes, properties.length, allResults);
    fs.writeFileSync(reportPath, markdown);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    console.log(`  Report saved to: ${reportPath}`);
    console.log(`  Raw data saved to: ${jsonPath}\n`);
  }

  // Summary
  const totalCost = allResults.reduce((sum, r) => sum + estimateDollarCost(r.estimatedCost), 0);
  const totalTime = allResults.reduce((sum, r) => sum + r.timing.totalMs, 0);
  console.log('── Summary ──');
  console.log(`  Total synthetic users: ${allResults.length}`);
  console.log(`  Estimated API cost: $${totalCost.toFixed(2)}`);
  console.log(`  Total time: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`  Avg time per user: ${(totalTime / allResults.length / 1000).toFixed(1)}s\n`);
}

// ─── MODE: MATCHING ONLY ─────────────────────────────────────────────────────

async function runMatchingOnly(archetypes: TasteArchetype[], config: SyntheticConfig) {
  ensureResultsDir();

  console.log('── Loading cached profiles ──\n');

  const cachedPath = path.join(RESULTS_DIR, 'cached-profiles.json');
  const fixtureCachedPath = path.join(FIXTURES_DIR, 'cached-profiles.json');

  let cachedResults: SyntheticUserResult[];

  if (fs.existsSync(cachedPath)) {
    console.log(`  Loading from: ${cachedPath}`);
    cachedResults = JSON.parse(fs.readFileSync(cachedPath, 'utf-8'));
  } else if (fs.existsSync(fixtureCachedPath)) {
    console.log(`  Loading from fixture: ${fixtureCachedPath}`);
    cachedResults = JSON.parse(fs.readFileSync(fixtureCachedPath, 'utf-8'));
  } else {
    console.error('  No cached profiles found. Run in "full" mode first, or create a fixture.');
    console.error(`  Expected at: ${cachedPath} or ${fixtureCachedPath}`);
    process.exit(1);
  }

  console.log(`  Loaded ${cachedResults.length} cached profiles\n`);

  if (config.archetypes.length > 0) {
    cachedResults = cachedResults.filter(r => config.archetypes.includes(r.archetypeId));
    console.log(`  Filtered to ${cachedResults.length} profiles for requested archetypes\n`);
  }

  console.log('── Evaluating matches ──\n');

  const properties = await loadProperties();
  console.log(`  Loaded ${properties.length} enriched properties\n`);

  if (properties.length === 0) {
    console.error('  No properties found. Cannot run matching-only mode without properties.');
    process.exit(1);
  }

  const report = evaluateAllMatches(cachedResults, archetypes, properties, config);

  console.log('── Generating diagnostics report ──\n');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(RESULTS_DIR, `report-matching-${timestamp}.md`);
  const jsonPath = path.join(RESULTS_DIR, `report-matching-${timestamp}.json`);

  const markdown = generateMarkdownReport(report, archetypes, properties.length, cachedResults);
  fs.writeFileSync(reportPath, markdown);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  console.log(`  Report saved to: ${reportPath}`);
  console.log(`  Raw data saved to: ${jsonPath}\n`);
}

// ─── MODE: EXTRACTION AUDIT ──────────────────────────────────────────────────

async function runExtractionAudit(archetypes: TasteArchetype[], config: SyntheticConfig) {
  ensureResultsDir();

  if (!config.anthropicApiKey) {
    console.error('ANTHROPIC_API_KEY is required for extraction audit mode.');
    process.exit(1);
  }

  console.log('── STEP 1: Running onboarding + extraction ──\n');

  const allResults: SyntheticUserResult[] = [];

  // For extraction audit, override to 1 variation at degree 0 (canonical)
  const auditConfig: SyntheticConfig = {
    ...config,
    variationsPerArchetype: 1,
    variationDegreeRange: [0, 0],
  };

  for (const archetype of archetypes) {
    console.log(`\n▸ Archetype: ${archetype.name} (${archetype.id})`);

    const results = await runArchetypeVariations(archetype, auditConfig);
    allResults.push(...results);
  }

  console.log('\n── STEP 2: Comparing extracted signals vs expectations ──\n');

  for (const result of allResults) {
    const archetype = archetypes.find(a => a.id === result.archetypeId);
    if (!archetype) continue;

    console.log(`▸ ${archetype.name} (${archetype.id}):`);

    // Check extraction accuracy
    const accuracy = checkExtractionAccuracy(
      archetype.expectedSignals,
      result.allSignals,
      archetype.contradictions.length,
      result.contradictions?.length || 0,
    );

    const hitCount = accuracy.foundSignals.filter(s => s.found).length;
    const totalExpected = accuracy.expectedSignals.length;
    const hitRate = totalExpected > 0 ? (hitCount / totalExpected * 100).toFixed(0) : '0';

    console.log(`  Signal recall: ${hitRate}% (${hitCount}/${totalExpected} expected signals found)`);

    if (accuracy.missedSignals.length > 0) {
      console.log(`  Missed signals:`);
      for (const missed of accuracy.missedSignals) {
        console.log(`    ✗ ${missed}`);
      }
    }

    if (accuracy.unexpectedAntiSignals.length > 0) {
      console.log(`  Unexpected anti-signals:`);
      for (const anti of accuracy.unexpectedAntiSignals) {
        console.log(`    ⚠ ${anti}`);
      }
    }

    console.log(`  Contradictions: found ${accuracy.contradictionsFound} / expected ${accuracy.contradictionsExpected}`);
    console.log(`  Pass: ${accuracy.pass ? '✓' : '✗'}`);
    console.log('');
  }

  // Save audit report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const auditPath = path.join(RESULTS_DIR, `audit-${timestamp}.json`);
  fs.writeFileSync(auditPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    archetypes: allResults.map(r => ({
      archetypeId: r.archetypeId,
      signalCount: r.allSignals.length,
      signals: r.allSignals,
      contradictions: r.contradictions,
      timing: r.timing,
      estimatedCost: r.estimatedCost,
    })),
  }, null, 2));

  console.log(`  Audit data saved to: ${auditPath}\n`);
}

// ─── Report Generation ──────────────────────────────────────────────────────

function generateMarkdownReport(
  report: CrossArchetypeReport,
  archetypes: TasteArchetype[],
  propertyCount: number,
  userResults: SyntheticUserResult[],
): string {
  const lines: string[] = [];
  const now = new Date().toISOString();

  lines.push('# Terrazzo Synthetic User Pipeline — Diagnostics Report');
  lines.push('');
  lines.push(`Generated: ${now}`);
  lines.push(`Archetypes: ${archetypes.length}`);
  lines.push(`Synthetic users: ${userResults.length}`);
  lines.push(`Properties scored: ${propertyCount}`);
  lines.push('');

  // ── Cross-archetype discrimination ──
  lines.push('## Cross-Archetype Discrimination');
  lines.push('');
  lines.push('Pairwise discrimination between archetypes. Higher mean score difference is better.');
  lines.push('');

  if (report.pairwiseDiscrimination.length > 0) {
    lines.push('| Archetype A | Archetype B | Mean Δ | Max Δ | A Wins | B Wins | Tied | Pass |');
    lines.push('|-------------|-------------|--------|-------|--------|--------|------|------|');

    for (const pair of report.pairwiseDiscrimination) {
      const r = pair.result;
      lines.push(`| ${pair.archetypeA} | ${pair.archetypeB} | ${r.meanScoreDifference.toFixed(1)} | ${r.maxScoreDifference.toFixed(1)} | ${r.propertiesWhereAWins} | ${r.propertiesWhereBWins} | ${r.propertiesWhereTied} | ${r.pass ? '✓' : '✗'} |`);
    }
    lines.push('');

    // Summary stats
    const avgMeanDiff = report.pairwiseDiscrimination.reduce((s, p) => s + p.result.meanScoreDifference, 0) / report.pairwiseDiscrimination.length;
    const passRate = report.pairwiseDiscrimination.filter(p => p.result.pass).length / report.pairwiseDiscrimination.length;
    lines.push(`Average pairwise mean Δ: ${avgMeanDiff.toFixed(1)}`);
    lines.push(`Discrimination pass rate: ${(passRate * 100).toFixed(0)}%`);
    lines.push('');

    // Worst pair
    const worstPair = [...report.pairwiseDiscrimination].sort((a, b) => a.result.meanScoreDifference - b.result.meanScoreDifference)[0];
    if (worstPair) {
      lines.push(`⚠️ Most similar pair: **${worstPair.archetypeA}** ↔ **${worstPair.archetypeB}** (mean Δ = ${worstPair.result.meanScoreDifference.toFixed(1)})`);
      lines.push('');
    }
  }

  // ── Per-archetype results ──
  lines.push('## Per-Archetype Results');
  lines.push('');

  for (const archetype of archetypes) {
    const reports = report.byArchetype[archetype.id];
    if (!reports || reports.length === 0) continue;

    lines.push(`### ${archetype.name} (\`${archetype.id}\`)`);
    lines.push('');

    const dist = reports[0].distribution;
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Mean score | ${dist.mean.toFixed(1)} |`);
    lines.push(`| Median score | ${dist.median.toFixed(1)} |`);
    lines.push(`| Std deviation | ${dist.stdDev.toFixed(1)} |`);
    lines.push(`| Min / Max | ${dist.min.toFixed(1)} / ${dist.max.toFixed(1)} |`);
    lines.push(`| Span | ${dist.span.toFixed(1)} |`);
    lines.push(`| Pass (span ≥ threshold) | ${dist.pass ? '✓' : '✗'} |`);
    lines.push('');

    // Top 5 matches for first variation
    if (reports[0].matches.length > 0) {
      lines.push('**Top 5 matches (variation 1):**');
      lines.push('');
      lines.push('| Rank | Property | Score | Top Dimension | Stretch? |');
      lines.push('|------|----------|-------|---------------|----------|');
      for (let i = 0; i < Math.min(5, reports[0].matches.length); i++) {
        const match = reports[0].matches[i];
        lines.push(`| ${i + 1} | ${match.propertyName} | ${match.overallScore.toFixed(1)} | ${match.topDimension} | ${match.isStretchPick ? '✓' : ''} |`);
      }
      lines.push('');
    }

    // Profile deviation
    if (reports[0].profileDeviation) {
      const dev = reports[0].profileDeviation;
      lines.push(`**Profile deviation** (expected vs synthesized): avg = ${dev.avgDeviation.toFixed(3)}, max = ${dev.maxDeviation.toFixed(3)} (${dev.maxDeviationDomain}), pass = ${dev.pass ? '✓' : '✗'}`);
      lines.push('');
    }

    // Feed health
    const health = report.feedHealth[archetype.id];
    if (health) {
      lines.push(`**Feed health**: ${health.sectionsPopulated} sections populated, stretch picks = ${health.hasStretchPick ? '✓' : '✗'}, duplicates = ${health.duplicateProperties}, pass = ${health.pass ? '✓' : '✗'}`);
      lines.push('');
    }
  }

  // ── Score compression check ──
  lines.push('## Score Compression Analysis');
  lines.push('');
  lines.push('Checking if score spans are wide enough for healthy discrimination:');
  lines.push('');

  for (const archetype of archetypes) {
    const reports = report.byArchetype[archetype.id];
    if (!reports || reports.length === 0) continue;
    const dist = reports[0].distribution;
    lines.push(`- **${archetype.id}**: span = ${dist.span.toFixed(1)}, stdDev = ${dist.stdDev.toFixed(1)} ${dist.pass ? '✓ OK' : '⚠️ COMPRESSED'}`);
  }
  lines.push('');

  return lines.join('\n');
}

// ─── ENTRY ───────────────────────────────────────────────────────────────────

main().catch(err => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
