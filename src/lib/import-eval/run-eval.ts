#!/usr/bin/env npx tsx
/**
 * Import Pipeline Evaluation Runner
 * ──────────────────────────────────
 * Tests the extractPlaces prompt against all test cases and generates a scored report.
 *
 * Usage:
 *   npx tsx src/lib/import-eval/run-eval.ts              # run all tests
 *   npx tsx src/lib/import-eval/run-eval.ts bucket-list   # run one test by id substring
 *
 * Requires ANTHROPIC_API_KEY in .env.local
 */

import { config } from 'dotenv';
import path from 'path';

// Load env vars
config({ path: path.resolve(process.cwd(), '.env.local') });

import { extractPlaces, ExtractionResult } from '../anthropic';
import { TEST_CASES, TestCase, ExpectedPlace } from './test-cases';

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

interface MatchResult {
  expected: ExpectedPlace;
  found: PlaceResult | null;
  nameMatch: boolean;
  typeMatch: boolean;
  cityMatch: boolean;
  contextMatch: boolean;
  descriptionMatch: boolean;
  intentMatch: boolean;
  score: number; // 0-1 per place
}

const REGION_ALIASES: Record<string, string[]> = {
  'turkey': ['türkiye', 'turkiye'],
  'türkiye': ['turkey', 'turkiye'],
};

function fuzzyMatch(haystack: string, needle: string): boolean {
  const h = haystack.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const n = needle.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  if (h.includes(n) || n.includes(h)) return true;
  // Check region aliases
  const hFull = haystack.toLowerCase();
  const nFull = needle.toLowerCase();
  for (const [key, aliases] of Object.entries(REGION_ALIASES)) {
    if (hFull.includes(key) && aliases.some(a => nFull.includes(a))) return true;
    if (nFull.includes(key) && aliases.some(a => hFull.includes(a))) return true;
  }
  return false;
}

function findBestMatch(expected: ExpectedPlace, results: PlaceResult[]): PlaceResult | null {
  // Try exact name match first
  let found = results.find(r => r.name.toLowerCase() === expected.name.toLowerCase());
  if (found) return found;

  // Try fuzzy name match
  found = results.find(r => fuzzyMatch(r.name, expected.name));
  if (found) return found;

  // Try partial match (at least 2 words overlap)
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

  // Weighted scoring
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

// ─── Anti-pattern Check ─────────────────────────────────────────────────────────

function checkAntiPatterns(results: PlaceResult[], antiPatterns: string[]): string[] {
  const violations: string[] = [];
  for (const pattern of antiPatterns) {
    const pLower = pattern.toLowerCase();
    const found = results.find(r => {
      const rLower = r.name.toLowerCase();
      // Exact match or near-exact (the extracted name IS essentially the anti-pattern)
      if (rLower === pLower) return true;
      // The name contains the pattern — only flag if the pattern makes up most of the name
      // e.g. "Raja Ampat Chartered Boat" should NOT be flagged by "Raja Ampat" (pattern is 40% of name)
      // but "The Souks" SHOULD be flagged by "The Souks" (exact match)
      if (rLower.includes(pLower)) {
        const ratio = pLower.length / rLower.length;
        return ratio > 0.75; // only flag if the anti-pattern is >75% of the place name
      }
      return false;
    });
    if (found) {
      violations.push(`"${found.name}" should not be a place (anti-pattern: "${pattern}")`);
    }
  }
  return violations;
}

// ─── Deduplication Check ────────────────────────────────────────────────────────

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

// ─── Run One Test Case ──────────────────────────────────────────────────────────

interface TestResult {
  testCase: TestCase;
  extraction: ExtractionResult;
  matches: MatchResult[];
  missingPlaces: ExpectedPlace[];
  extraPlaces: PlaceResult[]; // places found but not expected
  antiPatternViolations: string[];
  duplicates: string[];
  scores: {
    recall: number;           // % of expected places found
    typeAccuracy: number;     // % of found places with correct type
    contextPreservation: number; // % of expected context captured
    overallScore: number;     // weighted composite
    regionCorrect: boolean;
  };
  durationMs: number;
}

async function runTestCase(tc: TestCase): Promise<TestResult> {
  const start = Date.now();
  console.log(`\n  Running: ${tc.name}...`);

  const extraction = await extractPlaces(tc.input, tc.isArticle ?? false);
  const results = extraction.places as PlaceResult[];
  const durationMs = Date.now() - start;

  console.log(`    → ${results.length} places extracted in ${(durationMs / 1000).toFixed(1)}s`);

  // Score each expected place
  const matches = tc.expectedPlaces.map(exp => {
    const found = findBestMatch(exp, results);
    return scorePlace(exp, found);
  });

  const missingPlaces = matches.filter(m => !m.found).map(m => m.expected);
  const matchedNames = new Set(matches.filter(m => m.found).map(m => m.found!.name.toLowerCase()));
  const extraPlaces = results.filter(r => !matchedNames.has(r.name.toLowerCase()));

  const antiPatternViolations = checkAntiPatterns(results, tc.antiPatterns);
  const duplicates = tc.qualityCriteria.deduplicationRequired ? checkDuplicates(results) : [];

  // Aggregate scores
  const foundCount = matches.filter(m => m.found).length;
  const recall = foundCount / tc.expectedPlaces.length;
  const typeCorrect = matches.filter(m => m.found && m.typeMatch).length;
  const typeAccuracy = foundCount > 0 ? typeCorrect / foundCount : 0;
  const contextExpected = matches.filter(m => m.expected.mustHaveUserContext);
  const contextCorrect = contextExpected.filter(m => m.contextMatch).length;
  const contextPreservation = contextExpected.length > 0 ? contextCorrect / contextExpected.length : 1;
  const regionCorrect = tc.expectedRegion === null
    ? extraction.region === null || extraction.region === ''
    : extraction.region !== null && fuzzyMatch(extraction.region, tc.expectedRegion);

  const overallScore = (recall * 0.35) + (typeAccuracy * 0.20) + (contextPreservation * 0.25) +
    (regionCorrect ? 0.10 : 0) + (antiPatternViolations.length === 0 ? 0.05 : 0) +
    (duplicates.length === 0 ? 0.05 : 0);

  return {
    testCase: tc,
    extraction,
    matches,
    missingPlaces,
    extraPlaces,
    antiPatternViolations,
    duplicates,
    scores: { recall, typeAccuracy, contextPreservation, overallScore, regionCorrect },
    durationMs,
  };
}

// ─── Report Generation ──────────────────────────────────────────────────────────

function printReport(results: TestResult[]) {
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('  TERRAZZO IMPORT PIPELINE — EVALUATION REPORT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let totalScore = 0;

  for (const r of results) {
    const tc = r.testCase;
    const s = r.scores;
    totalScore += s.overallScore;

    const grade = s.overallScore >= 0.9 ? 'A' : s.overallScore >= 0.8 ? 'B' : s.overallScore >= 0.7 ? 'C' : s.overallScore >= 0.6 ? 'D' : 'F';
    const gradeColor = grade === 'A' ? '\x1b[32m' : grade === 'B' ? '\x1b[33m' : '\x1b[31m';

    console.log(`┌─ ${tc.name} [${tc.category}]`);
    console.log(`│  ${gradeColor}Grade: ${grade} (${(s.overallScore * 100).toFixed(0)}%)\x1b[0m  |  ${r.extraction.places.length} extracted  |  ${r.durationMs}ms`);
    console.log(`│`);
    console.log(`│  Recall:       ${(s.recall * 100).toFixed(0)}% (${r.matches.filter(m => m.found).length}/${tc.expectedPlaces.length} expected places found)`);
    console.log(`│  Type accuracy: ${(s.typeAccuracy * 100).toFixed(0)}%`);
    console.log(`│  Context:      ${(s.contextPreservation * 100).toFixed(0)}%`);
    console.log(`│  Region:       ${s.regionCorrect ? '✓' : '✗'} (got: "${r.extraction.region}", expected: "${tc.expectedRegion}")`);

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

    // Show type mismatches
    const typeMismatches = r.matches.filter(m => m.found && !m.typeMatch);
    if (typeMismatches.length > 0) {
      console.log(`│`);
      console.log(`│  ⚠ TYPE MISMATCHES:`);
      typeMismatches.forEach(m => console.log(`│    - ${m.expected.name}: expected "${m.expected.type}", got "${m.found!.type}"`));
    }

    // Show context misses
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

  // Summary
  const avgScore = totalScore / results.length;
  const avgGrade = avgScore >= 0.9 ? 'A' : avgScore >= 0.8 ? 'B' : avgScore >= 0.7 ? 'C' : 'D';

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  OVERALL: ${avgGrade} (${(avgScore * 100).toFixed(0)}%) across ${results.length} test cases`);
  console.log(`  Avg recall: ${(results.reduce((a, r) => a + r.scores.recall, 0) / results.length * 100).toFixed(0)}%`);
  console.log(`  Avg type accuracy: ${(results.reduce((a, r) => a + r.scores.typeAccuracy, 0) / results.length * 100).toFixed(0)}%`);
  console.log(`  Avg context: ${(results.reduce((a, r) => a + r.scores.contextPreservation, 0) / results.length * 100).toFixed(0)}%`);
  console.log(`  Total time: ${(results.reduce((a, r) => a + r.durationMs, 0) / 1000).toFixed(1)}s`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const filter = process.argv[2];
  const casesToRun = filter
    ? TEST_CASES.filter(tc => tc.id.includes(filter) || tc.name.toLowerCase().includes(filter.toLowerCase()))
    : TEST_CASES;

  if (casesToRun.length === 0) {
    console.error(`No test cases matching "${filter}". Available: ${TEST_CASES.map(t => t.id).join(', ')}`);
    process.exit(1);
  }

  console.log(`\nRunning ${casesToRun.length} test case(s)...`);

  const results: TestResult[] = [];
  for (const tc of casesToRun) {
    try {
      results.push(await runTestCase(tc));
    } catch (err) {
      console.error(`  ✗ ${tc.name} FAILED:`, err);
    }
  }

  printReport(results);
}

main().catch(console.error);
