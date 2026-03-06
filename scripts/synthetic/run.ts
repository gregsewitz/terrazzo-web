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

import 'dotenv/config';

import { DEFAULT_CONFIG, parseCliArgs, type SyntheticConfig } from './config';
import { loadArchetypes, listArchetypeIds, type TasteArchetype } from './archetypes';
import { runArchetypeVariations, type SyntheticUserResult } from './simulator/orchestrator';
import {
  evaluateAllMatches,
  loadPropertiesFromFixture,
  loadPropertiesFromDb,
  type EnrichedProperty,
  type CrossArchetypeReport,
  type PropertyMatch,
} from './simulator/match-runner';
import { checkExtractionAccuracy, auditDomainDistribution } from './evaluator/metrics';
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

  console.log('\n── STEP 2: Domain distribution audit ──\n');

  const auditResults: Record<string, unknown>[] = [];

  for (const result of allResults) {
    const archetype = archetypes.find(a => a.id === result.archetypeId);
    if (!archetype) continue;

    console.log(`▸ ${archetype.name} (${archetype.id}):`);

    // Domain-level audit
    const domainAudit = auditDomainDistribution(
      archetype.expectedProfile,
      result.allSignals,
      result.synthesizedProfile,
    );

    console.log(`  Synthesized archetype: ${domainAudit.synthesizedArchetype || '(none — synthesis failed)'}`);
    console.log(`  Expected top domains: ${domainAudit.expectedTopDomains.join(', ')}`);
    console.log(`  Actual top domains:   ${domainAudit.actualTopDomains.join(', ')}`);
    console.log(`  Domain overlap: ${(domainAudit.domainOverlap * 100).toFixed(0)}%`);

    console.log(`  Signal counts by domain:`);
    const sortedDomains = Object.entries(domainAudit.domainCounts)
      .sort(([, a], [, b]) => b - a);
    for (const [domain, count] of sortedDomains) {
      const antiCount = domainAudit.antiSignalCounts[domain] || 0;
      const antiStr = antiCount > 0 ? ` (+ ${antiCount} anti)` : '';
      console.log(`    ${domain}: ${count}${antiStr}`);
    }

    // Signal-level fuzzy matching
    const accuracy = checkExtractionAccuracy(
      archetype.expectedSignals,
      result.allSignals,
      archetype.contradictions.length,
      result.contradictions?.length || 0,
    );

    const hitCount = accuracy.foundSignals.filter(s => s.found).length;
    const totalExpected = accuracy.expectedSignals.length;
    const hitRate = totalExpected > 0 ? (hitCount / totalExpected * 100).toFixed(0) : '0';

    console.log(`  Signal recall (fuzzy): ${hitRate}% (${hitCount}/${totalExpected})`);

    if (accuracy.missedSignals.length > 0) {
      console.log(`  Missed signals:`);
      for (const missed of accuracy.missedSignals) {
        console.log(`    ✗ ${missed}`);
      }
    }

    if (accuracy.unexpectedAntiSignals.length > 0) {
      console.log(`  Unexpected anti-signals in non-rejection domains: ${accuracy.unexpectedAntiSignals.length}`);
    }

    console.log(`  Contradictions: found ${accuracy.contradictionsFound} / expected ${accuracy.contradictionsExpected}`);
    console.log(`  Total signals: ${result.allSignals.length} | Voice: ${result.timing.voiceMs}ms | Synthesis: ${result.timing.synthesisMs}ms`);

    const overallPass = domainAudit.pass && accuracy.pass;
    console.log(`  Pass: ${overallPass ? '✓' : '✗'}${!domainAudit.profileSynthesized ? ' (synthesis failed)' : ''}`);
    console.log('');

    auditResults.push({
      archetypeId: result.archetypeId,
      domainAudit,
      accuracy: {
        signalRecall: hitRate + '%',
        missedSignals: accuracy.missedSignals,
        unexpectedAntiSignalCount: accuracy.unexpectedAntiSignals.length,
      },
      signalCount: result.allSignals.length,
      signals: result.allSignals,
      synthesizedProfile: result.synthesizedProfile,
      contradictions: result.contradictions,
      messages: result.allMessages,
      timing: result.timing,
      estimatedCost: result.estimatedCost,
    });
  }

  // Save audit report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const auditPath = path.join(RESULTS_DIR, `audit-${timestamp}.json`);
  fs.writeFileSync(auditPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    archetypes: auditResults,
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

  // ── Per-archetype results with top matches ──
  lines.push('## Per-Archetype Top Matches');
  lines.push('');
  lines.push('The heart of the report: what does each archetype *actually see*? Review these to confirm different users get meaningfully different property rankings.');
  lines.push('');

  // Collect top-15 per archetype for cross-reference later
  const top15PerArchetype: Record<string, PropertyMatch[]> = {};

  for (const archetype of archetypes) {
    const reports = report.byArchetype[archetype.id];
    if (!reports || reports.length === 0) continue;

    const top15 = reports[0].matches.slice(0, 15);
    top15PerArchetype[archetype.id] = top15;

    lines.push(`### ${archetype.name} (\`${archetype.id}\`)`);
    lines.push('');

    // Quick score stats
    const dist = reports[0].distribution;
    lines.push(`Score range: ${dist.min.toFixed(1)} – ${dist.max.toFixed(1)} (mean ${dist.mean.toFixed(1)}, span ${dist.span.toFixed(1)}) ${dist.pass ? '✓' : '⚠️ COMPRESSED'}`);
    lines.push('');

    // Top 15 matches
    if (top15.length > 0) {
      lines.push('| # | Property | Score | Top Domain | Stretch? |');
      lines.push('|---|----------|-------|------------|----------|');
      for (let i = 0; i < top15.length; i++) {
        const match = top15[i];
        lines.push(`| ${i + 1} | ${match.propertyName} | ${match.overallScore.toFixed(1)} | ${match.topDimension} | ${match.isStretchPick ? '🔀' : ''} |`);
      }
      lines.push('');
    }

    // Bottom 5 matches (what they'd never see)
    if (reports[0].matches.length > 5) {
      lines.push('**Bottom 5 (lowest scores):**');
      lines.push('');
      const bottom5 = reports[0].matches.slice(-5).reverse();
      lines.push('| Property | Score | Top Domain |');
      lines.push('|----------|-------|------------|');
      for (const match of bottom5) {
        lines.push(`| ${match.propertyName} | ${match.overallScore.toFixed(1)} | ${match.topDimension} |`);
      }
      lines.push('');
    }

    // Domain distribution in top-15
    const domainCounts: Record<string, number> = {};
    for (const m of top15) {
      domainCounts[m.topDimension] = (domainCounts[m.topDimension] || 0) + 1;
    }
    const domainStr = Object.entries(domainCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([d, c]) => `${d}: ${c}`)
      .join(', ');
    lines.push(`**Top-15 domain mix**: ${domainStr}`);
    lines.push('');

    // Profile deviation
    if (reports[0].profileDeviation) {
      const dev = reports[0].profileDeviation;
      lines.push(`**Profile deviation**: avg = ${dev.avgDeviation.toFixed(3)}, max = ${dev.maxDeviation.toFixed(3)} (${dev.maxDeviationDomain}) ${dev.pass ? '✓' : '⚠️'}`);
      lines.push('');
    }

    // Feed health
    const health = report.feedHealth[archetype.id];
    if (health) {
      lines.push(`**Feed health**: ${health.sectionsPopulated}/8 sections, stretch picks = ${health.hasStretchPick ? '✓' : '✗'}, duplicates = ${health.duplicateProperties} ${health.pass ? '✓' : '⚠️'}`);
      lines.push('');
    }
  }

  // ── Signature Properties: unique to each archetype ──
  if (Object.keys(top15PerArchetype).length >= 2) {
    lines.push('## Signature Properties (Unique to Each Archetype)');
    lines.push('');
    lines.push('Properties in an archetype\'s top 15 that don\'t appear in ANY other archetype\'s top 15. These are the clearest taste signals — what makes each archetype *distinct*.');
    lines.push('');

    const allTop15Ids: Record<string, Set<string>> = {};
    for (const [aid, matches] of Object.entries(top15PerArchetype)) {
      allTop15Ids[aid] = new Set(matches.map(m => m.propertyId));
    }

    for (const archetype of archetypes) {
      const myTop15 = top15PerArchetype[archetype.id];
      if (!myTop15) continue;

      const otherIds = new Set<string>();
      for (const [aid, ids] of Object.entries(allTop15Ids)) {
        if (aid !== archetype.id) {
          for (const id of ids) otherIds.add(id);
        }
      }

      const signature = myTop15.filter(m => !otherIds.has(m.propertyId));

      if (signature.length > 0) {
        lines.push(`**${archetype.name}** (${signature.length} unique):`);
        for (const m of signature) {
          const rank = myTop15.findIndex(x => x.propertyId === m.propertyId) + 1;
          lines.push(`- #${rank} ${m.propertyName} (${m.overallScore.toFixed(1)}, ${m.topDimension})`);
        }
        lines.push('');
      } else {
        lines.push(`**${archetype.name}**: ⚠️ No unique properties in top 15 — too much overlap with other archetypes`);
        lines.push('');
      }
    }
  }

  // ── Head-to-Head: same property, different scores ──
  if (Object.keys(top15PerArchetype).length >= 2) {
    lines.push('## Head-to-Head: Biggest Score Swings');
    lines.push('');
    lines.push('Properties where archetypes disagree most. A property should score high for one archetype and low for another — these are the discriminating properties.');
    lines.push('');

    // Build a property → archetype → score lookup from the full match set
    const archetypeIds = Object.keys(report.byArchetype);
    const allPropertyScores: Record<string, Record<string, number>> = {};

    for (const aid of archetypeIds) {
      const reports = report.byArchetype[aid];
      if (!reports || reports.length === 0) continue;
      for (const match of reports[0].matches) {
        if (!allPropertyScores[match.propertyId]) {
          allPropertyScores[match.propertyId] = {};
          (allPropertyScores[match.propertyId] as any).__name = match.propertyName;
        }
        allPropertyScores[match.propertyId][aid] = match.overallScore;
      }
    }

    // Find properties with the biggest max-min spread across archetypes
    const swings: { propertyId: string; name: string; highArch: string; highScore: number; lowArch: string; lowScore: number; swing: number }[] = [];

    for (const [pid, scores] of Object.entries(allPropertyScores)) {
      const name = (scores as any).__name;
      let highArch = '', lowArch = '';
      let highScore = -Infinity, lowScore = Infinity;

      for (const aid of archetypeIds) {
        const s = scores[aid];
        if (s === undefined) continue;
        if (s > highScore) { highScore = s; highArch = aid; }
        if (s < lowScore) { lowScore = s; lowArch = aid; }
      }

      if (highArch !== lowArch) {
        swings.push({ propertyId: pid, name, highArch, highScore, lowArch, lowScore, swing: highScore - lowScore });
      }
    }

    swings.sort((a, b) => b.swing - a.swing);

    // Show top 20 biggest swings
    lines.push('| Property | Loves It | Score | Hates It | Score | Swing |');
    lines.push('|----------|----------|-------|----------|-------|-------|');
    for (const s of swings.slice(0, 20)) {
      lines.push(`| ${s.name} | ${s.highArch} | ${s.highScore.toFixed(1)} | ${s.lowArch} | ${s.lowScore.toFixed(1)} | ${s.swing.toFixed(1)} |`);
    }
    lines.push('');

    if (swings.length > 0) {
      const avgSwing = swings.slice(0, 50).reduce((s, x) => s + x.swing, 0) / Math.min(50, swings.length);
      lines.push(`Average swing (top 50 properties): ${avgSwing.toFixed(1)}`);
      lines.push('');
    }
  }

  // ── Overlap Analysis: shared top matches ──
  if (Object.keys(top15PerArchetype).length >= 2) {
    lines.push('## Overlap Analysis');
    lines.push('');
    lines.push('How many of each pair\'s top-15 properties overlap? Lower is better — high overlap means the archetypes are seeing too-similar feeds.');
    lines.push('');

    const archetypeIds = Object.keys(top15PerArchetype);
    lines.push('| Archetype A | Archetype B | Shared in Top 15 | Overlap % |');
    lines.push('|-------------|-------------|-------------------|-----------|');

    for (let i = 0; i < archetypeIds.length; i++) {
      for (let j = i + 1; j < archetypeIds.length; j++) {
        const aId = archetypeIds[i];
        const bId = archetypeIds[j];
        const aIds = new Set(top15PerArchetype[aId].map(m => m.propertyId));
        const bIds = new Set(top15PerArchetype[bId].map(m => m.propertyId));
        const shared = [...aIds].filter(id => bIds.has(id)).length;
        const overlapPct = (shared / 15 * 100).toFixed(0);
        const flag = shared > 5 ? ' ⚠️' : '';
        lines.push(`| ${aId} | ${bId} | ${shared} | ${overlapPct}%${flag} |`);
      }
    }
    lines.push('');
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
