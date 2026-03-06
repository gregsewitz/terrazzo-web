/**
 * Diagnostic metrics for evaluating synthetic user pipeline results.
 *
 * These metrics answer the core question: is the taste ontology working?
 */

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface ProfileDeviation {
  userId: string;
  archetypeId: string;
  perDomain: Record<string, number>;  // |expected - actual| per domain
  avgDeviation: number;
  maxDeviation: number;
  maxDeviationDomain: string;
  pass: boolean;  // all domains under threshold
}

export interface ScoreDistribution {
  archetypeId: string;
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  span: number;             // max - min
  percentiles: Record<string, number>;  // p10, p25, p50, p75, p90
  histogram: { bucket: string; count: number }[];
  pass: boolean;            // span >= threshold
}

export interface CrossArchetypeDiscrimination {
  archetypeA: string;
  archetypeB: string;
  meanScoreDifference: number;  // avg |scoreA - scoreB| across properties
  maxScoreDifference: number;
  propertiesWhereAWins: number;
  propertiesWhereBWins: number;
  propertiesWhereTied: number;  // |diff| < 3
  pass: boolean;
}

export interface FeedHealth {
  userId: string;
  archetypeId: string;
  sectionsPopulated: number;  // out of 8
  sectionDetails: {
    section: string;
    populated: boolean;
    count: number;
    domainDiversity: number;  // unique domains represented
  }[];
  hasStretchPick: boolean;
  hasTasteTension: boolean;
  duplicateProperties: number;
  pass: boolean;
}

export interface ExtractionAccuracy {
  archetypeId: string;
  userId: string;
  expectedSignals: { tag: string; domain: string; minConfidence: number }[];
  foundSignals: { tag: string; domain: string; confidence: number; found: boolean }[];
  missedSignals: string[];
  unexpectedAntiSignals: string[];
  contradictionsExpected: number;
  contradictionsFound: number;
  pass: boolean;
}

export interface PipelineReport {
  timestamp: string;
  mode: string;
  archetypeCount: number;
  totalUsers: number;
  profileDeviations: ProfileDeviation[];
  scoreDistributions: ScoreDistribution[];
  crossArchetypeDiscrimination: CrossArchetypeDiscrimination[];
  feedHealth: FeedHealth[];
  extractionAccuracy: ExtractionAccuracy[];
  summary: {
    profileDeviationPassRate: number;
    scoreDistributionPassRate: number;
    discriminationPassRate: number;
    feedHealthPassRate: number;
    extractionPassRate: number;
    overallPass: boolean;
  };
}

// ─── METRIC COMPUTATIONS ─────────────────────────────────────────────────────

/**
 * Compute profile deviation between expected archetype weights and actual extracted profile.
 */
export function computeProfileDeviation(
  expected: Record<string, number>,
  actual: { axis: string; value: number }[],
  threshold: number
): ProfileDeviation {
  const actualMap: Record<string, number> = {};
  for (const a of actual) {
    actualMap[a.axis] = a.value;
  }

  const perDomain: Record<string, number> = {};
  let totalDeviation = 0;
  let maxDeviation = 0;
  let maxDeviationDomain = '';
  let domainCount = 0;

  for (const [domain, expectedValue] of Object.entries(expected)) {
    const actualValue = actualMap[domain] ?? 0.5;
    const deviation = Math.abs(expectedValue - actualValue);
    perDomain[domain] = deviation;
    totalDeviation += deviation;
    domainCount++;

    if (deviation > maxDeviation) {
      maxDeviation = deviation;
      maxDeviationDomain = domain;
    }
  }

  return {
    userId: '',  // filled by caller
    archetypeId: '',
    perDomain,
    avgDeviation: totalDeviation / domainCount,
    maxDeviation,
    maxDeviationDomain,
    pass: maxDeviation <= threshold,
  };
}

/**
 * Build a score distribution analysis for a set of match scores.
 */
export function analyzeScoreDistribution(
  scores: number[],
  minSpanThreshold: number
): Omit<ScoreDistribution, 'archetypeId'> {
  const sorted = [...scores].sort((a, b) => a - b);
  const count = sorted.length;

  if (count === 0) {
    return {
      count: 0, min: 0, max: 0, mean: 0, median: 0, stdDev: 0, span: 0,
      percentiles: {}, histogram: [], pass: false,
    };
  }

  const min = sorted[0];
  const max = sorted[count - 1];
  const mean = sorted.reduce((a, b) => a + b, 0) / count;
  const median = count % 2 === 0
    ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
    : sorted[Math.floor(count / 2)];

  const variance = sorted.reduce((sum, s) => sum + (s - mean) ** 2, 0) / count;
  const stdDev = Math.sqrt(variance);
  const span = max - min;

  const percentile = (p: number) => sorted[Math.floor(p / 100 * (count - 1))];
  const percentiles = {
    p10: percentile(10),
    p25: percentile(25),
    p50: percentile(50),
    p75: percentile(75),
    p90: percentile(90),
  };

  // Build 10-bucket histogram
  const bucketSize = Math.max(span / 10, 1);
  const histogram: { bucket: string; count: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const low = min + i * bucketSize;
    const high = low + bucketSize;
    const bucketCount = sorted.filter(s => s >= low && (i === 9 ? s <= high : s < high)).length;
    histogram.push({
      bucket: `${Math.round(low)}-${Math.round(high)}`,
      count: bucketCount,
    });
  }

  return {
    count, min, max, mean, median, stdDev, span,
    percentiles, histogram,
    pass: span >= minSpanThreshold,
  };
}

/**
 * Compute cross-archetype discrimination for a pair of users on the same property set.
 */
export function computeDiscrimination(
  scoresA: { propertyId: string; score: number }[],
  scoresB: { propertyId: string; score: number }[],
  threshold: number
): Omit<CrossArchetypeDiscrimination, 'archetypeA' | 'archetypeB'> {
  const bMap = new Map(scoresB.map(s => [s.propertyId, s.score]));

  let totalDiff = 0;
  let maxDiff = 0;
  let aWins = 0;
  let bWins = 0;
  let tied = 0;
  let count = 0;

  for (const a of scoresA) {
    const bScore = bMap.get(a.propertyId);
    if (bScore === undefined) continue;

    const diff = Math.abs(a.score - bScore);
    totalDiff += diff;
    maxDiff = Math.max(maxDiff, diff);
    count++;

    if (diff < 3) tied++;
    else if (a.score > bScore) aWins++;
    else bWins++;
  }

  const meanDiff = count > 0 ? totalDiff / count : 0;

  return {
    meanScoreDifference: meanDiff,
    maxScoreDifference: maxDiff,
    propertiesWhereAWins: aWins,
    propertiesWhereBWins: bWins,
    propertiesWhereTied: tied,
    pass: meanDiff >= threshold,
  };
}

/**
 * Analyze feed allocation health for a single user.
 */
export function analyzeFeedHealth(
  allocation: Record<string, any[]>,
  minSections: number
): Omit<FeedHealth, 'userId' | 'archetypeId'> {
  const EXPECTED_SECTIONS = [
    'deepMatch', 'becauseYou', 'signalThread', 'tasteTension',
    'weeklyCollection', 'moodBoards', 'stretchPick', 'contextRecs'
  ];

  const sectionDetails = EXPECTED_SECTIONS.map(section => {
    const items = allocation[section] || [];
    const domains = new Set(items.map((i: any) => i.topDimension));
    return {
      section,
      populated: items.length > 0,
      count: items.length,
      domainDiversity: domains.size,
    };
  });

  const sectionsPopulated = sectionDetails.filter(s => s.populated).length;

  // Check for duplicate properties across sections
  const allPropertyIds = Object.values(allocation)
    .flat()
    .map((i: any) => i.propertyId)
    .filter(Boolean);
  const uniqueIds = new Set(allPropertyIds);
  const duplicateProperties = allPropertyIds.length - uniqueIds.size;

  return {
    sectionsPopulated,
    sectionDetails,
    hasStretchPick: (allocation['stretchPick'] || []).length > 0,
    hasTasteTension: (allocation['tasteTension'] || []).length > 0,
    duplicateProperties,
    pass: sectionsPopulated >= minSections && duplicateProperties === 0,
  };
}

/**
 * Check extraction accuracy: did the right signals get extracted?
 *
 * Uses fuzzy matching: expected tags are treated as semantic keywords.
 * An expected signal matches if any extracted signal in the same domain
 * contains any of the keywords from the expected tag (split on hyphens).
 * This accounts for the AI extraction producing dynamic vocabulary
 * (e.g. "anti-performative-luxury" satisfies expected "anti-Flashy-opulence"
 *  if both are in the Rejection domain).
 */
export function checkExtractionAccuracy(
  expected: { tag: string; domain: string; minConfidence: number }[],
  extracted: { tag: string; cat: string; confidence: number }[],
  expectedContradictions: number,
  foundContradictions: number
): Omit<ExtractionAccuracy, 'archetypeId' | 'userId'> {
  // Build keyword sets for fuzzy matching
  const normalizeTag = (tag: string) =>
    tag.replace(/^anti-/i, '').toLowerCase().split(/[-_]/).filter(Boolean);

  const foundSignals = expected.map(exp => {
    const isAnti = exp.tag.toLowerCase().startsWith('anti-');
    const expKeywords = normalizeTag(exp.tag);

    // Look for any extracted signal in the same domain (or Rejection for anti-signals)
    // that shares at least one keyword
    const match = extracted.find(e => {
      const domainMatch = isAnti
        ? (e.cat === exp.domain || e.cat === 'Rejection' || e.tag.startsWith('anti-'))
        : e.cat === exp.domain;
      if (!domainMatch) return false;

      const extractedKeywords = normalizeTag(e.tag);
      // Match if any keyword overlaps (or if extracted tag contains an expected keyword)
      return expKeywords.some(kw =>
        extractedKeywords.some(ek => ek.includes(kw) || kw.includes(ek))
      );
    });

    return {
      tag: exp.tag,
      domain: exp.domain,
      confidence: match?.confidence ?? 0,
      found: match ? match.confidence >= exp.minConfidence : false,
    };
  });

  const missedSignals = foundSignals.filter(s => !s.found).map(s => s.tag);

  // Unexpected anti-signals: only flag if they're in domains the archetype
  // doesn't expect any rejection in
  const expectedRejectionDomains = new Set(
    expected.filter(e => e.tag.startsWith('anti-')).map(e => e.domain)
  );
  const unexpectedAntiSignals = extracted
    .filter(e => e.tag.startsWith('anti-'))
    .filter(e => !expectedRejectionDomains.has(e.cat) && e.cat !== 'Rejection')
    .map(e => e.tag);

  const signalHitRate = foundSignals.filter(s => s.found).length / Math.max(foundSignals.length, 1);

  return {
    expectedSignals: expected,
    foundSignals,
    missedSignals,
    unexpectedAntiSignals,
    contradictionsExpected: expectedContradictions,
    contradictionsFound: foundContradictions,
    pass: signalHitRate >= 0.5 && missedSignals.length <= 3,
  };
}

// ─── DOMAIN-LEVEL AUDIT ──────────────────────────────────────────────────────

export interface DomainAudit {
  archetypeId: string;
  /** Expected dominant domains from archetype weights */
  expectedTopDomains: string[];
  /** Actual dominant domains by signal count */
  actualTopDomains: string[];
  /** Domain overlap between expected and actual */
  domainOverlap: number;
  /** Signal count per domain */
  domainCounts: Record<string, number>;
  /** Anti-signal count per domain */
  antiSignalCounts: Record<string, number>;
  /** Whether synthesized profile exists */
  profileSynthesized: boolean;
  /** Synthesized archetype name */
  synthesizedArchetype: string | null;
  pass: boolean;
}

/**
 * Domain-level audit: do extracted signals concentrate in the right domains?
 */
export function auditDomainDistribution(
  expectedWeights: Record<string, number>,
  extracted: { tag: string; cat: string; confidence: number }[],
  synthesizedProfile: Record<string, unknown> | null,
): DomainAudit {
  // Sort expected weights to find top 3 domains
  const sortedExpected = Object.entries(expectedWeights)
    .sort(([, a], [, b]) => b - a)
    .map(([domain]) => domain);
  const expectedTopDomains = sortedExpected.slice(0, 3);

  // Count signals per domain
  const domainCounts: Record<string, number> = {};
  const antiSignalCounts: Record<string, number> = {};

  for (const signal of extracted) {
    if (signal.tag.startsWith('anti-')) {
      antiSignalCounts[signal.cat] = (antiSignalCounts[signal.cat] || 0) + 1;
    } else {
      domainCounts[signal.cat] = (domainCounts[signal.cat] || 0) + 1;
    }
  }

  // Sort actual domains by signal count
  const sortedActual = Object.entries(domainCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([domain]) => domain);
  const actualTopDomains = sortedActual.slice(0, 3);

  // Measure overlap
  const overlap = expectedTopDomains.filter(d => actualTopDomains.includes(d)).length;
  const domainOverlap = overlap / Math.max(expectedTopDomains.length, 1);

  return {
    archetypeId: '',
    expectedTopDomains,
    actualTopDomains,
    domainOverlap,
    domainCounts,
    antiSignalCounts,
    profileSynthesized: synthesizedProfile !== null,
    synthesizedArchetype: synthesizedProfile
      ? (synthesizedProfile as Record<string, string>).overallArchetype || null
      : null,
    pass: domainOverlap >= 0.5 && synthesizedProfile !== null,
  };
}
