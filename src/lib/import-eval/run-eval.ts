#!/usr/bin/env npx tsx
/**
 * Import Pipeline Evaluation Runner
 * ──────────────────────────────────
 * Tests extraction + enrichment against all test cases and generates a scored report.
 * Tracks scores over time so you can measure the impact of prompt/logic changes.
 *
 * Usage:
 *   npx tsx src/lib/import-eval/run-eval.ts                         # run all tests
 *   npx tsx src/lib/import-eval/run-eval.ts bucket-list              # run one test by id
 *   npx tsx src/lib/import-eval/run-eval.ts --label "baseline"       # save run with label
 *   npx tsx src/lib/import-eval/run-eval.ts --url "https://..."      # ad-hoc URL test (no scoring)
 *   npx tsx src/lib/import-eval/run-eval.ts --no-enrich              # skip Google Places enrichment
 *   npx tsx src/lib/import-eval/run-eval.ts --no-history             # skip history save
 *
 * Requires ANTHROPIC_API_KEY (and optionally GOOGLE_PLACES_API_KEY, FIRECRAWL_API_KEY) in .env.local
 */

import { config } from 'dotenv';
import path from 'path';

// Load env vars — dotenv v17+ may not populate process.env automatically,
// so we explicitly merge parsed values into process.env.
const dotenvResult = config({ path: path.resolve(process.cwd(), '.env.local') });
if (dotenvResult.parsed) {
  for (const [key, value] of Object.entries(dotenvResult.parsed)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

import { extractPlaces, ExtractionResult } from '../anthropic';
import { fetchAndClean, enrichWithGooglePlaces } from '../import-pipeline';
import { TEST_CASES, TestCase, ExpectedPlace, ExpectedEnrichment } from './test-cases';
import { saveEntry, getLastEntry, computeDiffs, formatDiffLine, HistoryEntry } from './eval-history';

// ─── CLI Args ─────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  let filter: string | null = null;
  let label: string | null = null;
  let adHocUrl: string | null = null;
  let skipEnrich = false;
  let skipHistory = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--label' && args[i + 1]) { label = args[++i]; continue; }
    if (args[i] === '--url' && args[i + 1]) { adHocUrl = args[++i]; continue; }
    if (args[i] === '--no-enrich') { skipEnrich = true; continue; }
    if (args[i] === '--no-history') { skipHistory = true; continue; }
    if (!args[i].startsWith('--')) filter = args[i];
  }

  return { filter, label, adHocUrl, skipEnrich, skipHistory };
}

// ─── Scoring Functions ──────────────────────────────────────────────────────────

interface PlaceResult {
  name: string;
  type: string;
  city?: string;
  description?: string;
  userContext?: string;
  travelWith?: string;
  timing?: string;
  intentStatus?: string;
}

interface EnrichedResult extends PlaceResult {
  google?: {
    placeId?: string;
    address?: string;
    lat?: number;
    lng?: number;
  };
  enrichment?: {
    confidence?: number;
  };
  location?: string;
}

interface MatchResult {
  expected: ExpectedPlace;
  found: PlaceResult | null;
  nameMatch: boolean;
  typeMatch: boolean;
  cityMatch: boolean;
  contextMatch: boolean;
  descriptionMatch: boolean;
  intentMatch: boolean;
  score: number;
}

const REGION_ALIASES: Record<string, string[]> = {
  'turkey': ['türkiye', 'turkiye'],
  'türkiye': ['turkey', 'turkiye'],
};

function fuzzyMatch(haystack: string, needle: string): boolean {
  const h = haystack.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const n = needle.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  if (h.includes(n) || n.includes(h)) return true;
  const hFull = haystack.toLowerCase();
  const nFull = needle.toLowerCase();
  for (const [key, aliases] of Object.entries(REGION_ALIASES)) {
    if (hFull.includes(key) && aliases.some(a => nFull.includes(a))) return true;
    if (nFull.includes(key) && aliases.some(a => hFull.includes(a))) return true;
  }
  return false;
}

function findBestMatch(expected: ExpectedPlace, results: PlaceResult[]): PlaceResult | null {
  let found = results.find(r => r.name.toLowerCase() === expected.name.toLowerCase());
  if (found) return found;
  found = results.find(r => fuzzyMatch(r.name, expected.name));
  if (found) return found;
  const expectedWords = expected.name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  found = results.find(r => {
    const resultWords = r.name.toLowerCase().split(/\s+/);
    const overlap = expectedWords.filter(w => resultWords.some(rw => rw.includes(w) || w.includes(rw)));
    return overlap.length >= Math.min(2, expectedWords.length);
  });
  return found || null;
}

function scorePlace(expected: ExpectedPlace, found: PlaceResult | null): MatchResult {
  if (!found) {
    return {
      expected, found: null,
      nameMatch: false, typeMatch: false, cityMatch: false,
      contextMatch: false, descriptionMatch: false, intentMatch: false,
      score: 0,
    };
  }

  const nameMatch = fuzzyMatch(found.name, expected.name);
  const typeMatch = found.type === expected.type;
  const cityMatch = !expected.city || (found.city ? fuzzyMatch(found.city, expected.city) : false);
  const contextMatch: boolean = !expected.mustHaveUserContext || Boolean(
    (found.userContext && found.userContext.toLowerCase().includes(expected.mustHaveUserContext.toLowerCase())) ||
    (found.description && found.description.toLowerCase().includes(expected.mustHaveUserContext.toLowerCase()))
  );
  const descriptionMatch: boolean = !expected.mustHaveDescription || Boolean(
    found.description?.toLowerCase().includes(expected.mustHaveDescription.toLowerCase())
  );
  const intentMatch: boolean = !expected.intentStatus || found.intentStatus === expected.intentStatus;

  const weights = { name: 0.25, type: 0.20, city: 0.15, context: 0.20, description: 0.10, intent: 0.10 };
  const score =
    (nameMatch ? weights.name : 0) +
    (typeMatch ? weights.type : 0) +
    (cityMatch ? weights.city : 0) +
    (contextMatch ? weights.context : 0) +
    (descriptionMatch ? weights.description : 0) +
    (intentMatch ? weights.intent : 0);

  return { expected, found, nameMatch, typeMatch, cityMatch, contextMatch, descriptionMatch, intentMatch, score };
}

// ─── Anti-pattern & Dedup ─────────────────────────────────────────────────────

function checkAntiPatterns(results: PlaceResult[], antiPatterns: string[]): string[] {
  const violations: string[] = [];
  for (const pattern of antiPatterns) {
    const pLower = pattern.toLowerCase();
    const found = results.find(r => {
      const rLower = r.name.toLowerCase();
      if (rLower === pLower) return true;
      if (rLower.includes(pLower)) {
        return pLower.length / rLower.length > 0.75;
      }
      return false;
    });
    if (found) {
      violations.push(`"${found.name}" should not be a place (anti-pattern: "${pattern}")`);
    }
  }
  return violations;
}

function checkDuplicates(results: PlaceResult[]): string[] {
  const seen = new Map<string, number>();
  const dupes: string[] = [];
  for (const r of results) {
    const key = r.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const count = (seen.get(key) || 0) + 1;
    seen.set(key, count);
    if (count === 2) dupes.push(`"${r.name}" appears ${count}+ times`);
  }
  return dupes;
}

// ─── Enrichment Scoring ─────────────────────────────────────────────────────────

interface EnrichmentScore {
  total: number;
  countryCorrect: number;
  confidenceCorrect: number;
  resolved: number;           // how many got a Google placeId at all
  accuracy: number;           // 0-1 composite
  details: string[];
}

function scoreEnrichment(
  expectedEnrichment: ExpectedEnrichment[] | undefined,
  enrichedResults: EnrichedResult[],
): EnrichmentScore {
  if (!expectedEnrichment || expectedEnrichment.length === 0) {
    return { total: 0, countryCorrect: 0, confidenceCorrect: 0, resolved: 0, accuracy: 1, details: [] };
  }

  let countryCorrect = 0;
  let confidenceCorrect = 0;
  let resolved = 0;
  const details: string[] = [];

  for (const exp of expectedEnrichment) {
    const enriched = enrichedResults.find(r => fuzzyMatch(r.name, exp.name));
    if (!enriched) {
      details.push(`✗ ${exp.name}: not found in enriched results`);
      continue;
    }

    const address = (enriched.google?.address || enriched.location || '').toLowerCase();
    const hasPlaceId = !!enriched.google?.placeId;
    if (hasPlaceId) resolved++;

    if (exp.mustBeInCountry) {
      if (address.includes(exp.mustBeInCountry.toLowerCase())) {
        countryCorrect++;
      } else {
        details.push(`✗ ${exp.name}: expected country "${exp.mustBeInCountry}" in "${address}"`);
      }
    } else {
      countryCorrect++; // no country constraint = pass
    }

    if (exp.expectedConfidence) {
      const conf = enriched.enrichment?.confidence ?? 0.8;
      const isLow = conf < 0.5;
      const expectedLow = exp.expectedConfidence === 'low';
      if (isLow === expectedLow) {
        confidenceCorrect++;
      } else {
        details.push(`✗ ${exp.name}: expected confidence "${exp.expectedConfidence}", got ${conf}`);
      }
    } else {
      confidenceCorrect++; // no constraint = pass
    }
  }

  const total = expectedEnrichment.length;
  const accuracy = total > 0
    ? (countryCorrect / total * 0.6) + (confidenceCorrect / total * 0.4)
    : 1;

  return { total, countryCorrect, confidenceCorrect, resolved, accuracy, details };
}

// ─── Run One Test Case ──────────────────────────────────────────────────────────

interface TestResult {
  testCase: TestCase;
  extraction: ExtractionResult;
  matches: MatchResult[];
  missingPlaces: ExpectedPlace[];
  extraPlaces: PlaceResult[];
  antiPatternViolations: string[];
  duplicates: string[];
  enrichmentScore: EnrichmentScore;
  fetchedContent?: { length: number; isMarkdown: boolean };
  scores: {
    recall: number;
    typeAccuracy: number;
    contextPreservation: number;
    enrichmentAccuracy: number;
    overallScore: number;
    regionCorrect: boolean;
  };
  durationMs: number;
}

async function runTestCase(tc: TestCase, skipEnrich: boolean): Promise<TestResult> {
  const start = Date.now();
  console.log(`\n  Running: ${tc.name}...`);

  // ── Step 1: Content fetching (for URL-based tests) ──
  let inputText = tc.input;
  let fetchedContent: { length: number; isMarkdown: boolean } | undefined;

  if (tc.sourceUrl) {
    console.log(`    Fetching URL: ${tc.sourceUrl}`);
    const content = await fetchAndClean(tc.sourceUrl);
    if (!content) {
      if (tc.input) {
        console.log(`    ✗ Failed to fetch URL — falling back to inline input`);
      } else {
        console.log(`    ✗ Failed to fetch URL — skipping test`);
        throw new Error(`Could not fetch ${tc.sourceUrl}`);
      }
    }

    if (content) {
      fetchedContent = {
        length: content.length,
        isMarkdown: content.includes('#') || content.includes('**') || content.includes('- '),
      };
      console.log(`    Fetched ${content.length} chars (markdown: ${fetchedContent.isMarkdown})`);
    }

    // When a test case has BOTH sourceUrl AND inline input, always prefer the
    // inline input for extraction — it's hand-curated ground truth without
    // navigation chrome or truncation. The fetch result is still logged above
    // to track URL pipeline health.
    if (tc.input) {
      console.log(`    Using inline input (${tc.input.length} chars) for extraction`);
    } else if (content) {
      inputText = content;
    }
  }

  // ── Step 2: Extraction ──
  const extraction = await extractPlaces(inputText, tc.isArticle ?? false);
  const results = extraction.places as PlaceResult[];
  console.log(`    → ${results.length} places extracted`);

  // ── Step 3: Enrichment (optional) ──
  let enrichedResults: EnrichedResult[] = [];
  if (!skipEnrich && tc.expectedEnrichment && tc.expectedEnrichment.length > 0) {
    console.log(`    Enriching ${results.length} places with Google Places...`);
    try {
      const enriched = await enrichWithGooglePlaces(
        extraction.places,
        tc.sourceUrl ? 'url' : 'text',
        extraction.region,
      );
      enrichedResults = enriched as unknown as EnrichedResult[];
      console.log(`    → ${enrichedResults.length} enriched`);
    } catch (err) {
      console.log(`    ⚠ Enrichment failed: ${err}`);
    }
  }

  const durationMs = Date.now() - start;

  // ── Step 4: Score extraction ──
  const matches = tc.expectedPlaces.map(exp => {
    const found = findBestMatch(exp, results);
    return scorePlace(exp, found);
  });

  const missingPlaces = matches.filter(m => !m.found).map(m => m.expected);
  const matchedNames = new Set(matches.filter(m => m.found).map(m => m.found!.name.toLowerCase()));
  const extraPlaces = results.filter(r => !matchedNames.has(r.name.toLowerCase()));
  const antiPatternViolations = checkAntiPatterns(results, tc.antiPatterns);
  const duplicates = tc.qualityCriteria.deduplicationRequired ? checkDuplicates(results) : [];

  // ── Step 5: Score enrichment ──
  const enrichmentScore = scoreEnrichment(tc.expectedEnrichment, enrichedResults);

  // ── Step 6: Composite score ──
  const foundCount = matches.filter(m => m.found).length;
  const recall = tc.expectedPlaces.length > 0 ? foundCount / tc.expectedPlaces.length : 1;
  const typeCorrect = matches.filter(m => m.found && m.typeMatch).length;
  const typeAccuracy = foundCount > 0 ? typeCorrect / foundCount : 0;
  const contextExpected = matches.filter(m => m.expected.mustHaveUserContext);
  const contextCorrect = contextExpected.filter(m => m.contextMatch).length;
  const contextPreservation = contextExpected.length > 0 ? contextCorrect / contextExpected.length : 1;
  const globalSynonyms = ['global', 'worldwide', 'international', 'various', 'multiple countries'];
  const regionCorrect = tc.expectedRegion === null
    ? extraction.region === null || extraction.region === '' ||
      globalSynonyms.some(s => (extraction.region || '').toLowerCase().includes(s))
    : extraction.region !== null && fuzzyMatch(extraction.region, tc.expectedRegion);

  const hasEnrichment = tc.expectedEnrichment && tc.expectedEnrichment.length > 0;
  const enrichmentAccuracy = enrichmentScore.accuracy;

  // Weighted composite — enrichment weight only applies when tested
  const overallScore = hasEnrichment
    ? (recall * 0.30) + (typeAccuracy * 0.15) + (contextPreservation * 0.20) +
      (regionCorrect ? 0.10 : 0) + (antiPatternViolations.length === 0 ? 0.05 : 0) +
      (duplicates.length === 0 ? 0.05 : 0) + (enrichmentAccuracy * 0.15)
    : (recall * 0.35) + (typeAccuracy * 0.20) + (contextPreservation * 0.25) +
      (regionCorrect ? 0.10 : 0) + (antiPatternViolations.length === 0 ? 0.05 : 0) +
      (duplicates.length === 0 ? 0.05 : 0);

  return {
    testCase: tc, extraction, matches, missingPlaces, extraPlaces,
    antiPatternViolations, duplicates, enrichmentScore, fetchedContent,
    scores: { recall, typeAccuracy, contextPreservation, enrichmentAccuracy, overallScore, regionCorrect },
    durationMs,
  };
}

// ─── Ad-Hoc URL Mode ──────────────────────────────────────────────────────────

async function runAdHocUrl(url: string) {
  console.log(`\n  Ad-hoc URL test: ${url}\n`);

  console.log('  Step 1: Fetching content...');
  const content = await fetchAndClean(url);
  if (!content) {
    console.error('  ✗ Failed to fetch URL');
    process.exit(1);
  }
  const isMarkdown = content.includes('#') || content.includes('**');
  console.log(`  → ${content.length} chars (markdown: ${isMarkdown})`);
  console.log(`  Preview: ${content.slice(0, 200).replace(/\n/g, ' ')}...\n`);

  console.log('  Step 2: Extracting places...');
  const extraction = await extractPlaces(content, true);
  console.log(`  → Region: "${extraction.region}"`);
  console.log(`  → ${extraction.places.length} places:\n`);

  for (const p of extraction.places) {
    const place = p as PlaceResult;
    console.log(`    ${place.name} [${place.type}]`);
    if (place.city) console.log(`      city: ${place.city}`);
    if (place.description) console.log(`      desc: ${place.description.slice(0, 100)}`);
    if (place.userContext) console.log(`      ctx:  ${place.userContext.slice(0, 100)}`);
    console.log('');
  }

  console.log('  ─────────────────────────────────────────────');
  console.log(`  Tip: To formalize this as a test case, add it to test-cases.ts with:`);
  console.log(`    sourceUrl: "${url}",`);
  console.log(`    expectedPlaces: [${extraction.places.slice(0, 3).map(p => `{ name: "${(p as PlaceResult).name}", type: "${(p as PlaceResult).type}" }`).join(', ')}, ...]`);
  console.log('');
}

// ─── Report Generation ──────────────────────────────────────────────────────────

function printReport(results: TestResult[], previousRun: HistoryEntry | null) {
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('  TERRAZZO IMPORT PIPELINE — EVALUATION REPORT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const currentScores: Record<string, number> = {};
  let totalScore = 0;

  for (const r of results) {
    const tc = r.testCase;
    const s = r.scores;
    totalScore += s.overallScore;
    currentScores[tc.id] = s.overallScore;

    const grade = s.overallScore >= 0.9 ? 'A' : s.overallScore >= 0.8 ? 'B' : s.overallScore >= 0.7 ? 'C' : s.overallScore >= 0.6 ? 'D' : 'F';
    const gradeColor = grade === 'A' ? '\x1b[32m' : grade === 'B' ? '\x1b[33m' : '\x1b[31m';

    // Diff against previous run
    const prevScore = previousRun?.results[tc.id] ?? null;
    const diff = prevScore !== null ? computeDiffs({ [tc.id]: s.overallScore }, previousRun) : null;
    const diffStr = diff?.diffs[0] ? formatDiffLine(diff.diffs[0]) : '';

    console.log(`┌─ ${tc.name} [${tc.category}]`);
    console.log(`│  ${gradeColor}Grade: ${grade} (${(s.overallScore * 100).toFixed(0)}%)\x1b[0m  ${diffStr}  |  ${r.extraction.places.length} extracted  |  ${r.durationMs}ms`);
    console.log(`│`);
    console.log(`│  Recall:       ${(s.recall * 100).toFixed(0)}% (${r.matches.filter(m => m.found).length}/${tc.expectedPlaces.length} expected places found)`);
    console.log(`│  Type accuracy: ${(s.typeAccuracy * 100).toFixed(0)}%`);
    console.log(`│  Context:      ${(s.contextPreservation * 100).toFixed(0)}%`);
    console.log(`│  Region:       ${s.regionCorrect ? '✓' : '✗'} (got: "${r.extraction.region}", expected: "${tc.expectedRegion}")`);

    // Fetch info (URL tests)
    if (r.fetchedContent) {
      console.log(`│  Fetch:        ${r.fetchedContent.length} chars, markdown: ${r.fetchedContent.isMarkdown ? '✓' : '✗'}`);
    }

    // Enrichment info
    if (r.enrichmentScore.total > 0) {
      console.log(`│  Enrichment:   ${(s.enrichmentAccuracy * 100).toFixed(0)}% (country: ${r.enrichmentScore.countryCorrect}/${r.enrichmentScore.total}, confidence: ${r.enrichmentScore.confidenceCorrect}/${r.enrichmentScore.total})`);
      if (r.enrichmentScore.details.length > 0) {
        r.enrichmentScore.details.forEach(d => console.log(`│    ${d}`));
      }
    }

    if (r.missingPlaces.length > 0) {
      console.log(`│`);
      console.log(`│  ✗ MISSING (${r.missingPlaces.length}):`);
      r.missingPlaces.forEach(p => console.log(`│    - ${p.name} (${p.type})`));
    }

    if (r.antiPatternViolations.length > 0) {
      console.log(`│`);
      console.log(`│  ⚠ ANTI-PATTERN VIOLATIONS:`);
      r.antiPatternViolations.forEach(v => console.log(`│    - ${v}`));
    }

    if (r.duplicates.length > 0) {
      console.log(`│`);
      console.log(`│  ⚠ DUPLICATES:`);
      r.duplicates.forEach(d => console.log(`│    - ${d}`));
    }

    const typeMismatches = r.matches.filter(m => m.found && !m.typeMatch);
    if (typeMismatches.length > 0) {
      console.log(`│`);
      console.log(`│  ⚠ TYPE MISMATCHES:`);
      typeMismatches.forEach(m => console.log(`│    - ${m.expected.name}: expected "${m.expected.type}", got "${m.found!.type}"`));
    }

    const contextMisses = r.matches.filter(m => m.found && m.expected.mustHaveUserContext && !m.contextMatch);
    if (contextMisses.length > 0) {
      console.log(`│`);
      console.log(`│  ⚠ CONTEXT MISSED:`);
      contextMisses.forEach(m => {
        console.log(`│    - ${m.expected.name}: expected context containing "${m.expected.mustHaveUserContext}"`);
        console.log(`│      got userContext: "${m.found!.userContext || '(none)'}"`);
        console.log(`│      got description: "${m.found!.description?.slice(0, 80) || '(none)'}"`);
      });
    }

    console.log(`└${'─'.repeat(65)}\n`);
  }

  // Summary with diff
  const avgScore = totalScore / results.length;
  const avgGrade = avgScore >= 0.9 ? 'A' : avgScore >= 0.8 ? 'B' : avgScore >= 0.7 ? 'C' : 'D';

  const overallDiff = previousRun
    ? ` (was ${(previousRun.overall * 100).toFixed(0)}%, ${avgScore >= previousRun.overall ? '\x1b[32m+' : '\x1b[31m'}${((avgScore - previousRun.overall) * 100).toFixed(0)}%\x1b[0m)`
    : '';

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  OVERALL: ${avgGrade} (${(avgScore * 100).toFixed(0)}%)${overallDiff} across ${results.length} test cases`);
  console.log(`  Avg recall: ${(results.reduce((a, r) => a + r.scores.recall, 0) / results.length * 100).toFixed(0)}%`);
  console.log(`  Avg type accuracy: ${(results.reduce((a, r) => a + r.scores.typeAccuracy, 0) / results.length * 100).toFixed(0)}%`);
  console.log(`  Avg context: ${(results.reduce((a, r) => a + r.scores.contextPreservation, 0) / results.length * 100).toFixed(0)}%`);
  console.log(`  Total time: ${(results.reduce((a, r) => a + r.durationMs, 0) / 1000).toFixed(1)}s`);
  if (previousRun) {
    console.log(`  Compared to: ${previousRun.label || previousRun.timestamp}`);
  }
  console.log('═══════════════════════════════════════════════════════════════\n');

  return currentScores;
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { filter, label, adHocUrl, skipEnrich, skipHistory } = parseArgs();

  // Ad-hoc URL mode
  if (adHocUrl) {
    await runAdHocUrl(adHocUrl);
    return;
  }

  const casesToRun = filter
    ? TEST_CASES.filter(tc => tc.id.includes(filter) || tc.name.toLowerCase().includes(filter.toLowerCase()))
    : TEST_CASES;

  if (casesToRun.length === 0) {
    console.error(`No test cases matching "${filter}". Available: ${TEST_CASES.map(t => t.id).join(', ')}`);
    process.exit(1);
  }

  console.log(`\nRunning ${casesToRun.length} test case(s)...`);
  if (skipEnrich) console.log('  (enrichment disabled)');

  const previousRun = getLastEntry();
  const results: TestResult[] = [];

  for (const tc of casesToRun) {
    try {
      results.push(await runTestCase(tc, skipEnrich));
    } catch (err) {
      console.error(`  ✗ ${tc.name} FAILED:`, err);
    }
  }

  const currentScores = printReport(results, previousRun);

  // Save to history
  if (!skipHistory && results.length > 0) {
    const overall = Object.values(currentScores).reduce((a, b) => a + b, 0) / Object.values(currentScores).length;
    const entry: HistoryEntry = {
      timestamp: new Date().toISOString(),
      label: label || undefined,
      results: currentScores,
      overall,
      testCount: results.length,
    };
    saveEntry(entry);
    console.log(`  📊 Results saved to history${label ? ` (label: "${label}")` : ''}`);
  }
}

main().catch(console.error);
