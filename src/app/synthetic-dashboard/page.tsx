'use client';

import { useState, useCallback, useMemo, type DragEvent } from 'react';

// ─── Types mirroring CrossArchetypeReport from match-runner ────────────────

interface PropertyMatch {
  propertyId: string;
  propertyName: string;
  overallScore: number;
  breakdown: Record<string, number>;
  topDimension: string;
  isStretchPick: boolean;
}

interface ScoreDistribution {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  span: number;
  pass: boolean;
}

interface ProfileDeviation {
  avgDeviation: number;
  maxDeviation: number;
  maxDeviationDomain: string;
  pass: boolean;
}

interface UserMatchReport {
  archetypeId: string;
  variationSeed: number;
  matches: PropertyMatch[];
  distribution: ScoreDistribution;
  profileDeviation: ProfileDeviation | null;
}

interface PairwiseDisc {
  archetypeA: string;
  archetypeB: string;
  result: {
    meanScoreDifference: number;
    maxScoreDifference: number;
    propertiesWhereAWins: number;
    propertiesWhereBWins: number;
    propertiesWhereTied: number;
    pass: boolean;
  };
}

interface FeedHealth {
  sectionsPopulated: number;
  hasStretchPick: boolean;
  duplicateProperties: number;
  pass: boolean;
}

interface ReportData {
  byArchetype: Record<string, UserMatchReport[]>;
  pairwiseDiscrimination: PairwiseDisc[];
  feedHealth: Record<string, FeedHealth>;
}

// ─── Tabs ──────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'archetype' | 'compare' | 'swings' | 'overlap';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'archetype', label: 'Per Archetype' },
  { id: 'compare', label: 'Compare' },
  { id: 'swings', label: 'Score Swings' },
  { id: 'overlap', label: 'Overlap Matrix' },
];

const DOMAINS = ['Design', 'Atmosphere', 'Character', 'Service', 'FoodDrink', 'Setting', 'Wellness', 'Sustainability'];

const DOMAIN_COLORS: Record<string, string> = {
  Design: '#8b5cf6',
  Atmosphere: '#3b82f6',
  Character: '#f59e0b',
  Service: '#10b981',
  FoodDrink: '#ef4444',
  Setting: '#06b6d4',
  Wellness: '#ec4899',
  Sustainability: '#22c55e',
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 60) return 'text-blue-400';
  if (score >= 45) return 'text-amber-400';
  return 'text-zinc-500';
}

function scoreBg(score: number): string {
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 45) return 'bg-amber-500';
  return 'bg-zinc-600';
}

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="w-20 h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${scoreBg(score)}`}
          style={{ width: `${(score / max) * 100}%` }}
        />
      </div>
      <span className={`text-xs font-mono ${scoreColor(score)}`}>{score.toFixed(1)}</span>
    </div>
  );
}

function DomainPill({ domain }: { domain: string }) {
  return (
    <span
      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
      style={{
        backgroundColor: (DOMAIN_COLORS[domain] || '#666') + '22',
        color: DOMAIN_COLORS[domain] || '#999',
      }}
    >
      {domain}
    </span>
  );
}

// ─── File Loader ───────────────────────────────────────────────────────────

function FileLoader({ onLoad }: { onLoad: (data: ReportData) => void }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          if (!data.byArchetype) throw new Error('Invalid report: missing byArchetype');
          onLoad(data);
        } catch (err) {
          setError((err as Error).message);
        }
      };
      reader.readAsText(file);
    },
    [onLoad],
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
      <div
        className={`border-2 border-dashed rounded-2xl p-16 text-center max-w-lg w-full transition-colors ${
          dragging ? 'border-blue-500 bg-blue-500/5' : 'border-zinc-700 hover:border-zinc-500'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="text-4xl mb-4">📊</div>
        <h2 className="text-xl font-semibold text-zinc-200 mb-2">Synthetic Pipeline Dashboard</h2>
        <p className="text-zinc-500 mb-6">
          Drop a <code className="text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded text-sm">report-full-*.json</code> file here
        </p>
        <label className="inline-block cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-5 py-2.5 rounded-lg transition-colors text-sm font-medium">
          Choose file
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </label>
        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
        <p className="text-zinc-600 text-xs mt-6">
          Run: <code className="text-zinc-500">npx tsx scripts/synthetic/run.ts --mode full</code>
        </p>
      </div>
    </div>
  );
}

// ─── Overview Tab ──────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: ReportData }) {
  const archetypeIds = Object.keys(data.byArchetype);
  const discPassRate = data.pairwiseDiscrimination.length > 0
    ? data.pairwiseDiscrimination.filter((p) => p.result.pass).length / data.pairwiseDiscrimination.length
    : 0;
  const avgMeanDiff = data.pairwiseDiscrimination.length > 0
    ? data.pairwiseDiscrimination.reduce((s, p) => s + p.result.meanScoreDifference, 0) / data.pairwiseDiscrimination.length
    : 0;
  const worstPair = [...data.pairwiseDiscrimination].sort(
    (a, b) => a.result.meanScoreDifference - b.result.meanScoreDifference,
  )[0];

  const propertyCount = archetypeIds.length > 0 && data.byArchetype[archetypeIds[0]]?.[0]
    ? data.byArchetype[archetypeIds[0]][0].matches.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Archetypes', value: archetypeIds.length, sub: 'synthetic users' },
          { label: 'Properties Scored', value: propertyCount, sub: 'per archetype' },
          { label: 'Discrimination Pass', value: `${(discPassRate * 100).toFixed(0)}%`, sub: `${data.pairwiseDiscrimination.filter(p => p.result.pass).length}/${data.pairwiseDiscrimination.length} pairs` },
          { label: 'Avg Score Δ', value: avgMeanDiff.toFixed(1), sub: 'pairwise mean' },
        ].map((stat) => (
          <div key={stat.label} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">{stat.label}</div>
            <div className="text-2xl font-bold text-zinc-100 mt-1">{stat.value}</div>
            <div className="text-zinc-600 text-xs mt-0.5">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Archetype score ranges */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
        <h3 className="text-zinc-300 font-medium mb-4">Score Distribution by Archetype</h3>
        <div className="space-y-3">
          {archetypeIds.map((aid) => {
            const report = data.byArchetype[aid]?.[0];
            if (!report) return null;
            const d = report.distribution;
            return (
              <div key={aid} className="flex items-center gap-3">
                <div className="w-48 text-sm text-zinc-400 truncate font-mono">{aid}</div>
                <div className="flex-1 relative h-6 bg-zinc-800 rounded">
                  {/* Full range bar */}
                  <div
                    className="absolute h-full bg-zinc-700 rounded"
                    style={{ left: `${d.min}%`, width: `${d.max - d.min}%` }}
                  />
                  {/* IQR-ish bar */}
                  <div
                    className="absolute h-full bg-blue-600/50 rounded"
                    style={{
                      left: `${Math.max(0, d.mean - d.stdDev)}%`,
                      width: `${Math.min(100, 2 * d.stdDev)}%`,
                    }}
                  />
                  {/* Mean marker */}
                  <div
                    className="absolute w-0.5 h-full bg-white"
                    style={{ left: `${d.mean}%` }}
                  />
                </div>
                <div className="w-32 text-xs text-zinc-500 text-right">
                  {d.min.toFixed(0)}–{d.max.toFixed(0)} (μ {d.mean.toFixed(0)})
                </div>
                <div className={`w-5 text-center ${d.pass ? 'text-emerald-400' : 'text-red-400'}`}>
                  {d.pass ? '✓' : '✗'}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-4 text-[10px] text-zinc-600">
          <span><span className="inline-block w-3 h-2 bg-zinc-700 rounded mr-1" /> Full range</span>
          <span><span className="inline-block w-3 h-2 bg-blue-600/50 rounded mr-1" /> ±1 std dev</span>
          <span><span className="inline-block w-3 h-0.5 bg-white mr-1" /> Mean</span>
        </div>
      </div>

      {/* Worst pair callout */}
      {worstPair && (
        <div className="bg-amber-950/30 border border-amber-800/30 rounded-xl p-4">
          <div className="text-amber-400 text-sm font-medium">⚠ Most Similar Pair</div>
          <div className="text-zinc-300 mt-1">
            <span className="font-mono text-sm">{worstPair.archetypeA}</span>
            {' ↔ '}
            <span className="font-mono text-sm">{worstPair.archetypeB}</span>
            <span className="text-zinc-500 ml-2">mean Δ = {worstPair.result.meanScoreDifference.toFixed(1)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Per-Archetype Tab ─────────────────────────────────────────────────────

function ArchetypeTab({ data }: { data: ReportData }) {
  const archetypeIds = Object.keys(data.byArchetype);
  const [selected, setSelected] = useState(archetypeIds[0] || '');
  const [showCount, setShowCount] = useState(15);
  const [showBottom, setShowBottom] = useState(false);

  const report = data.byArchetype[selected]?.[0];
  if (!report) return <div className="text-zinc-500">No data</div>;

  const matches = showBottom
    ? [...report.matches].reverse().slice(0, showCount)
    : report.matches.slice(0, showCount);

  // Domain distribution in top 15
  const domainDist: Record<string, number> = {};
  for (const m of report.matches.slice(0, 15)) {
    domainDist[m.topDimension] = (domainDist[m.topDimension] || 0) + 1;
  }

  return (
    <div className="flex gap-5">
      {/* Archetype pills sidebar */}
      <div className="w-56 shrink-0 space-y-1">
        {archetypeIds.map((aid) => {
          const d = data.byArchetype[aid]?.[0]?.distribution;
          return (
            <button
              key={aid}
              onClick={() => { setSelected(aid); setShowBottom(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selected === aid
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-600/30'
                  : 'text-zinc-400 hover:bg-zinc-800 border border-transparent'
              }`}
            >
              <div className="font-mono text-xs truncate">{aid}</div>
              {d && (
                <div className="text-[10px] text-zinc-600 mt-0.5">
                  μ {d.mean.toFixed(0)} | span {d.span.toFixed(0)}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Detail panel */}
      <div className="flex-1 min-w-0">
        {/* Stats row */}
        <div className="flex gap-3 mb-4 flex-wrap">
          {[
            { k: 'Mean', v: report.distribution.mean.toFixed(1) },
            { k: 'Median', v: report.distribution.median.toFixed(1) },
            { k: 'StdDev', v: report.distribution.stdDev.toFixed(1) },
            { k: 'Span', v: report.distribution.span.toFixed(1) },
            { k: 'Min', v: report.distribution.min.toFixed(1) },
            { k: 'Max', v: report.distribution.max.toFixed(1) },
          ].map(({ k, v }) => (
            <div key={k} className="bg-zinc-900 rounded-lg px-3 py-2 border border-zinc-800">
              <div className="text-[10px] text-zinc-600 uppercase">{k}</div>
              <div className="text-sm font-mono text-zinc-200">{v}</div>
            </div>
          ))}
        </div>

        {/* Domain distribution */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 mb-4">
          <div className="text-[10px] text-zinc-600 uppercase mb-2">Top-15 Domain Mix</div>
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(domainDist)
              .sort(([, a], [, b]) => b - a)
              .map(([domain, count]) => (
                <div
                  key={domain}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                  style={{
                    backgroundColor: (DOMAIN_COLORS[domain] || '#666') + '15',
                    color: DOMAIN_COLORS[domain] || '#999',
                  }}
                >
                  <span className="font-medium">{domain}</span>
                  <span className="opacity-60">{count}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Toggle + count controls */}
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => setShowBottom(false)}
            className={`text-xs px-3 py-1 rounded ${!showBottom ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
          >
            Top matches
          </button>
          <button
            onClick={() => setShowBottom(true)}
            className={`text-xs px-3 py-1 rounded ${showBottom ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
          >
            Bottom matches
          </button>
          <select
            value={showCount}
            onChange={(e) => setShowCount(Number(e.target.value))}
            className="text-xs bg-zinc-800 text-zinc-400 rounded px-2 py-1 border border-zinc-700"
          >
            {[10, 15, 25, 50, 100].map((n) => (
              <option key={n} value={n}>Show {n}</option>
            ))}
          </select>
        </div>

        {/* Matches table */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
                <th className="text-left py-2 px-3 w-10">#</th>
                <th className="text-left py-2 px-3">Property</th>
                <th className="text-left py-2 px-3 w-36">Score</th>
                <th className="text-left py-2 px-3 w-28">Top Domain</th>
                <th className="text-left py-2 px-3 w-20">Stretch</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m, i) => {
                const rank = showBottom
                  ? report.matches.length - i
                  : i + 1;
                return (
                  <tr key={m.propertyId} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="py-1.5 px-3 text-zinc-600 text-xs">{rank}</td>
                    <td className="py-1.5 px-3 text-zinc-200">{m.propertyName}</td>
                    <td className="py-1.5 px-3"><ScoreBar score={m.overallScore} /></td>
                    <td className="py-1.5 px-3"><DomainPill domain={m.topDimension} /></td>
                    <td className="py-1.5 px-3 text-center">{m.isStretchPick ? '🔀' : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Profile deviation + Feed health */}
        <div className="flex gap-3 mt-4">
          {report.profileDeviation && (
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 flex-1">
              <div className="text-[10px] text-zinc-600 uppercase mb-1">Profile Deviation</div>
              <div className="text-sm text-zinc-300">
                avg {report.profileDeviation.avgDeviation.toFixed(3)}, max {report.profileDeviation.maxDeviation.toFixed(3)} ({report.profileDeviation.maxDeviationDomain})
                <span className={`ml-2 ${report.profileDeviation.pass ? 'text-emerald-400' : 'text-red-400'}`}>
                  {report.profileDeviation.pass ? '✓' : '✗'}
                </span>
              </div>
            </div>
          )}
          {data.feedHealth[selected] && (
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 flex-1">
              <div className="text-[10px] text-zinc-600 uppercase mb-1">Feed Health</div>
              <div className="text-sm text-zinc-300">
                {data.feedHealth[selected].sectionsPopulated}/8 sections,
                stretch: {data.feedHealth[selected].hasStretchPick ? '✓' : '✗'},
                dupes: {data.feedHealth[selected].duplicateProperties}
                <span className={`ml-2 ${data.feedHealth[selected].pass ? 'text-emerald-400' : 'text-red-400'}`}>
                  {data.feedHealth[selected].pass ? '✓' : '✗'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Compare Tab ───────────────────────────────────────────────────────────

function CompareTab({ data }: { data: ReportData }) {
  const archetypeIds = Object.keys(data.byArchetype);
  const [leftId, setLeftId] = useState(archetypeIds[0] || '');
  const [rightId, setRightId] = useState(archetypeIds[1] || archetypeIds[0] || '');

  const leftReport = data.byArchetype[leftId]?.[0];
  const rightReport = data.byArchetype[rightId]?.[0];

  // Build score lookup for the right archetype
  const rightScores = useMemo(() => {
    if (!rightReport) return new Map<string, number>();
    return new Map(rightReport.matches.map((m) => [m.propertyId, m.overallScore]));
  }, [rightReport]);

  const leftScores = useMemo(() => {
    if (!leftReport) return new Map<string, number>();
    return new Map(leftReport.matches.map((m) => [m.propertyId, m.overallScore]));
  }, [leftReport]);

  if (!leftReport || !rightReport) return <div className="text-zinc-500">Select two archetypes</div>;

  const leftTop15 = leftReport.matches.slice(0, 15);
  const rightTop15 = rightReport.matches.slice(0, 15);
  const leftIds = new Set(leftTop15.map((m) => m.propertyId));
  const rightIds = new Set(rightTop15.map((m) => m.propertyId));

  return (
    <div className="space-y-4">
      {/* Selectors */}
      <div className="flex gap-4 items-center">
        <select
          value={leftId}
          onChange={(e) => setLeftId(e.target.value)}
          className="bg-zinc-800 text-zinc-300 rounded-lg px-3 py-2 text-sm border border-zinc-700 font-mono"
        >
          {archetypeIds.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        <span className="text-zinc-600 font-bold">vs</span>
        <select
          value={rightId}
          onChange={(e) => setRightId(e.target.value)}
          className="bg-zinc-800 text-zinc-300 rounded-lg px-3 py-2 text-sm border border-zinc-700 font-mono"
        >
          {archetypeIds.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </div>

      {/* Side by side top 15 */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { id: leftId, top15: leftTop15, otherIds: rightIds, otherScores: rightScores },
          { id: rightId, top15: rightTop15, otherIds: leftIds, otherScores: leftScores },
        ].map(({ id, top15, otherIds, otherScores }) => (
          <div key={id} className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <span className="font-mono text-sm text-zinc-300">{id}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-[10px] uppercase">
                  <th className="text-left py-1.5 px-3 w-8">#</th>
                  <th className="text-left py-1.5 px-3">Property</th>
                  <th className="text-left py-1.5 px-3 w-28">Score</th>
                  <th className="text-left py-1.5 px-3 w-20">Other</th>
                </tr>
              </thead>
              <tbody>
                {top15.map((m, i) => {
                  const shared = otherIds.has(m.propertyId);
                  const otherScore = otherScores.get(m.propertyId);
                  return (
                    <tr
                      key={m.propertyId}
                      className={`border-b border-zinc-800/50 ${shared ? 'bg-amber-900/10' : ''}`}
                    >
                      <td className="py-1 px-3 text-zinc-600 text-xs">{i + 1}</td>
                      <td className="py-1 px-3 text-zinc-200 text-xs">
                        {m.propertyName}
                        {shared && <span className="text-amber-500 ml-1 text-[10px]">●</span>}
                      </td>
                      <td className="py-1 px-3"><ScoreBar score={m.overallScore} /></td>
                      <td className="py-1 px-3 text-xs font-mono text-zinc-500">
                        {otherScore !== undefined ? otherScore.toFixed(0) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="text-[10px] text-zinc-600">
        <span className="text-amber-500">●</span> Shared in both top-15
      </div>
    </div>
  );
}

// ─── Score Swings Tab ──────────────────────────────────────────────────────

function SwingsTab({ data }: { data: ReportData }) {
  const archetypeIds = Object.keys(data.byArchetype);

  const swings = useMemo(() => {
    const allScores: Record<string, { name: string; scores: Record<string, number> }> = {};

    for (const aid of archetypeIds) {
      const report = data.byArchetype[aid]?.[0];
      if (!report) continue;
      for (const m of report.matches) {
        if (!allScores[m.propertyId]) {
          allScores[m.propertyId] = { name: m.propertyName, scores: {} };
        }
        allScores[m.propertyId].scores[aid] = m.overallScore;
      }
    }

    const result: {
      propertyId: string;
      name: string;
      highArch: string;
      highScore: number;
      lowArch: string;
      lowScore: number;
      swing: number;
    }[] = [];

    for (const [pid, { name, scores }] of Object.entries(allScores)) {
      let highArch = '', lowArch = '';
      let highScore = -Infinity, lowScore = Infinity;
      for (const [aid, s] of Object.entries(scores)) {
        if (s > highScore) { highScore = s; highArch = aid; }
        if (s < lowScore) { lowScore = s; lowArch = aid; }
      }
      if (highArch !== lowArch) {
        result.push({ propertyId: pid, name, highArch, highScore, lowArch, lowScore, swing: highScore - lowScore });
      }
    }

    return result.sort((a, b) => b.swing - a.swing);
  }, [data, archetypeIds]);

  const [showCount, setShowCount] = useState(30);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-zinc-300 font-medium">Biggest Score Swings</h3>
        <select
          value={showCount}
          onChange={(e) => setShowCount(Number(e.target.value))}
          className="text-xs bg-zinc-800 text-zinc-400 rounded px-2 py-1 border border-zinc-700"
        >
          {[20, 30, 50, 100].map((n) => <option key={n} value={n}>Top {n}</option>)}
        </select>
        {swings.length > 0 && (
          <span className="text-xs text-zinc-600 ml-auto">
            Avg swing (top 50): {(swings.slice(0, 50).reduce((s, x) => s + x.swing, 0) / Math.min(50, swings.length)).toFixed(1)}
          </span>
        )}
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-[10px] uppercase">
              <th className="text-left py-2 px-3">Property</th>
              <th className="text-left py-2 px-3 w-40">Loves It</th>
              <th className="text-left py-2 px-3 w-24">Score</th>
              <th className="text-left py-2 px-3 w-40">Hates It</th>
              <th className="text-left py-2 px-3 w-24">Score</th>
              <th className="text-left py-2 px-3 w-20">Swing</th>
            </tr>
          </thead>
          <tbody>
            {swings.slice(0, showCount).map((s) => (
              <tr key={s.propertyId} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="py-1.5 px-3 text-zinc-200">{s.name}</td>
                <td className="py-1.5 px-3 font-mono text-xs text-emerald-400">{s.highArch}</td>
                <td className="py-1.5 px-3"><ScoreBar score={s.highScore} /></td>
                <td className="py-1.5 px-3 font-mono text-xs text-red-400">{s.lowArch}</td>
                <td className="py-1.5 px-3"><ScoreBar score={s.lowScore} /></td>
                <td className="py-1.5 px-3">
                  <span className={`font-mono text-xs ${s.swing >= 30 ? 'text-emerald-400' : s.swing >= 15 ? 'text-amber-400' : 'text-zinc-500'}`}>
                    {s.swing.toFixed(1)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Overlap Matrix Tab ────────────────────────────────────────────────────

function OverlapTab({ data }: { data: ReportData }) {
  const archetypeIds = Object.keys(data.byArchetype);

  const top15Map = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const aid of archetypeIds) {
      const report = data.byArchetype[aid]?.[0];
      if (report) {
        map[aid] = new Set(report.matches.slice(0, 15).map((m) => m.propertyId));
      }
    }
    return map;
  }, [data, archetypeIds]);

  return (
    <div className="space-y-4">
      <h3 className="text-zinc-300 font-medium">Top-15 Overlap Matrix</h3>
      <p className="text-zinc-500 text-sm">Cells show how many of each pair&apos;s top 15 properties are shared. Lower is better.</p>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="py-2 px-2 text-zinc-600 text-left" />
              {archetypeIds.map((id) => (
                <th key={id} className="py-2 px-2 text-zinc-500 font-mono" style={{ writingMode: 'vertical-lr', maxHeight: 120 }}>
                  {id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {archetypeIds.map((rowId) => (
              <tr key={rowId}>
                <td className="py-1 px-2 text-zinc-400 font-mono whitespace-nowrap">{rowId}</td>
                {archetypeIds.map((colId) => {
                  if (rowId === colId) {
                    return <td key={colId} className="py-1 px-2 text-center bg-zinc-800 text-zinc-600">—</td>;
                  }
                  const aSet = top15Map[rowId];
                  const bSet = top15Map[colId];
                  if (!aSet || !bSet) return <td key={colId} className="py-1 px-2 text-center text-zinc-700">?</td>;

                  const shared = [...aSet].filter((id) => bSet.has(id)).length;
                  const pct = shared / 15;
                  const bg = pct > 0.33
                    ? 'bg-red-900/40 text-red-300'
                    : pct > 0.13
                    ? 'bg-amber-900/30 text-amber-300'
                    : pct > 0
                    ? 'bg-zinc-800 text-zinc-400'
                    : 'bg-zinc-900 text-zinc-600';

                  return (
                    <td key={colId} className={`py-1 px-2 text-center font-mono ${bg}`}>
                      {shared}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-4 text-[10px] text-zinc-600">
        <span><span className="inline-block w-3 h-2 bg-zinc-900 rounded mr-1" /> 0 shared</span>
        <span><span className="inline-block w-3 h-2 bg-zinc-800 rounded mr-1" /> 1–2 shared</span>
        <span><span className="inline-block w-3 h-2 bg-amber-900/30 rounded mr-1" /> 3–5 shared</span>
        <span><span className="inline-block w-3 h-2 bg-red-900/40 rounded mr-1" /> 5+ shared ⚠️</span>
      </div>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────

export default function SyntheticDashboard() {
  const [data, setData] = useState<ReportData | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  if (!data) return <FileLoader onLoad={setData} />;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Synthetic Pipeline Dashboard</h1>
            <p className="text-xs text-zinc-500">{Object.keys(data.byArchetype).length} archetypes · {data.byArchetype[Object.keys(data.byArchetype)[0]]?.[0]?.matches.length ?? 0} properties</p>
          </div>
          <button
            onClick={() => setData(null)}
            className="text-xs text-zinc-500 hover:text-zinc-300 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            Load different file
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                tab === t.id
                  ? 'bg-zinc-950 text-zinc-100 border-t border-x border-zinc-700'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {tab === 'overview' && <OverviewTab data={data} />}
        {tab === 'archetype' && <ArchetypeTab data={data} />}
        {tab === 'compare' && <CompareTab data={data} />}
        {tab === 'swings' && <SwingsTab data={data} />}
        {tab === 'overlap' && <OverlapTab data={data} />}
      </div>
    </div>
  );
}
