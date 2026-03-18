'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Script from 'next/script';
import { TASTE_DOMAIN_RANGES } from '@/lib/constants';

// ─── Minimal Chart.js types (CDN-loaded, no npm package) ─────────────────────
interface ChartInstance {
  destroy(): void;
}
interface ChartTooltipCtx {
  raw: { name: string; x: number; y: number };
}
interface ChartDrawContext {
  ctx: CanvasRenderingContext2D;
  scales: Record<string, { min: number; max: number; getPixelForValue(v: number): number }>;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChartJsConfig = Record<string, any>;
interface WindowWithChart extends Window {
  Chart?: new (canvas: HTMLCanvasElement, config: ChartJsConfig) => ChartInstance;
}

/* ═══════════════════════════════════════════════════════════
   Taste Intelligence Dashboard — /dashboard/taste-clusters
   Compares three scoring approaches:
     • LLM     — signal-based scoring via computeMatchFromSignals
     • Embedding — 136-dim vectors (v2)
     • Clusters  — 400-dim signal-only vectors with neighbor bleed (v3.4)
   ═══════════════════════════════════════════════════════════ */

// Types
interface Property {
  name: string;
  llm: number; embedding: number; clusters: number;
  signals: number;
  llmR: number; embR: number; cluR: number;
}
interface DomainStat {
  domain: string; clusters: number; signals: number;
  avg: number; min: number; max: number;
}
interface DashboardData {
  properties: Property[];
  domains: DomainStat[];
  clusterSizes: number[];
  clusterHist: { bucket: number; count: number }[];
  meta: { propertyCount: number; clusterCount: number; dimensions: number; mappedSignals: number; generatedAt: string };
}

const DOMAIN_COLORS: Record<string, string> = {
  Atmosphere: '#8b5cf6', Character: '#06b6d4', Design: '#ec4899',
  FoodDrink: '#f59e0b', Service: '#22c55e', Geography: '#3b82f6',
  Wellness: '#f97316', Sustainability: '#10b981',
};

const DOMAIN_RANGES = [
  ...TASTE_DOMAIN_RANGES,
];

// Approach colors
const LLM_COLOR = '#f59e0b';       // amber
const EMB_COLOR = '#8b5cf6';       // purple
const CLU_COLOR = '#06b6d4';       // cyan

// ═══ MAIN COMPONENT ═══
export default function TasteDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'overview' | 'comparison' | 'clusters' | 'rankings'>('overview');
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    fetch('/api/admin/taste-dashboard')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((d: DashboardData) => setData(d))
      .catch((e) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div style={{ background: '#0f1117', color: '#e4e4e7', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
        {error
          ? <p style={{ color: '#ef4444' }}>{error}</p>
          : <p style={{ color: '#a1a1aa' }}>Loading dashboard data...</p>
        }
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"
        onReady={() => setChartReady(true)}
      />
      <div style={{ background: '#0f1117', color: '#e4e4e7', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
        <Header meta={data.meta} />
        <TabBar active={tab} onChange={setTab} />
        <div style={{ padding: '24px 32px', maxWidth: 1400 }}>
          {tab === 'overview' && chartReady && <OverviewPanel data={data} />}
          {tab === 'comparison' && chartReady && <ComparisonPanel data={data} />}
          {tab === 'clusters' && chartReady && <ClusterPanel data={data} />}
          {tab === 'rankings' && <RankingsPanel data={data} />}
          {!chartReady && tab !== 'rankings' && <p style={{ color: '#a1a1aa' }}>Loading charts...</p>}
        </div>
      </div>
    </>
  );
}

// ═══ HEADER ═══
function Header({ meta }: { meta: DashboardData['meta'] }) {
  return (
    <div style={{ padding: '24px 32px', borderBottom: '1px solid #2a2d3a', display: 'flex', alignItems: 'center', gap: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Taste Intelligence Dashboard</h1>
      <span style={{ background: '#8b5cf6', color: 'white', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500 }}>v3.2</span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 24, fontSize: 13, color: '#a1a1aa' }}>
        <span><strong style={{ color: '#e4e4e7' }}>{meta.propertyCount}</strong> properties</span>
        <span><strong style={{ color: '#e4e4e7' }}>{meta.clusterCount}</strong> clusters</span>
        <span><strong style={{ color: '#e4e4e7' }}>{meta.dimensions}</strong> dimensions</span>
        <span><strong style={{ color: '#e4e4e7' }}>{meta.mappedSignals.toLocaleString()}</strong> signals</span>
      </div>
    </div>
  );
}

// ═══ TAB BAR ═══
type DashboardTab = 'overview' | 'comparison' | 'clusters' | 'rankings';

function TabBar({ active, onChange }: { active: DashboardTab; onChange: (t: DashboardTab) => void }) {
  const tabs: Array<{ key: DashboardTab; label: string }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'comparison', label: 'LLM vs Embedding vs Clusters' },
    { key: 'clusters', label: 'Cluster Explorer' },
    { key: 'rankings', label: 'Property Rankings' },
  ];
  return (
    <div style={{ display: 'flex', padding: '0 32px', borderBottom: '1px solid #2a2d3a', background: '#1a1d27' }}>
      {tabs.map((t) => (
        <div
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            padding: '12px 20px', fontSize: 13, cursor: 'pointer',
            color: active === t.key ? '#8b5cf6' : '#a1a1aa',
            borderBottom: `2px solid ${active === t.key ? '#8b5cf6' : 'transparent'}`,
            fontWeight: active === t.key ? 500 : 400,
          }}
        >
          {t.label}
        </div>
      ))}
    </div>
  );
}

// ═══ SHARED ═══
const Card = ({ title, children, style }: { title?: string; children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 12, padding: 20, ...style }}>
    {title && <h3 style={{ fontSize: 14, fontWeight: 500, color: '#a1a1aa', marginBottom: 12 }}>{title}</h3>}
    {children}
  </div>
);

function useChart(id: string, config: ChartJsConfig) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartInstance | null>(null);

  useEffect(() => {
    const win = window as unknown as WindowWithChart;
    if (!canvasRef.current || typeof window === 'undefined' || !win.Chart) return;
    chartRef.current?.destroy();
    chartRef.current = new win.Chart(canvasRef.current, config);
    return () => chartRef.current?.destroy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, JSON.stringify(config.data?.datasets?.length)]);

  return canvasRef;
}

const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
const std = (arr: number[]) => { const m = mean(arr); return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length); };

function makeHist(arr: number[], binSize = 2) {
  const bins: Record<number, number> = {};
  arr.forEach((v) => { const b = Math.floor(v / binSize) * binSize; bins[b] = (bins[b] || 0) + 1; });
  const labels = Object.keys(bins).map(Number).sort((a, b) => a - b);
  return { labels: labels.map((l) => `${l}-${l + binSize}`), counts: labels.map((l) => bins[l]) };
}

const chartTheme = {
  plugins: { legend: { labels: { color: '#a1a1aa' } } },
  scales: {
    x: { ticks: { color: '#a1a1aa' }, grid: { color: '#2a2d3a' } },
    y: { ticks: { color: '#a1a1aa' }, grid: { color: '#2a2d3a' } },
  },
};

// ═══ OVERVIEW ═══
function OverviewPanel({ data }: { data: DashboardData }) {
  const llms = data.properties.map((d) => d.llm);
  const embs = data.properties.map((d) => d.embedding);
  const clus = data.properties.map((d) => d.clusters);
  const avgLlm = mean(llms);
  const avgEmb = mean(embs);
  const avgClu = mean(clus);

  const hL = makeHist(llms, 2);
  const hE = makeHist(embs, 2);
  const hC = makeHist(clus, 2);
  const allLabels = [...new Set([...hL.labels, ...hE.labels, ...hC.labels])].sort();

  const distRef = useChart('dist', {
    type: 'bar',
    data: {
      labels: allLabels,
      datasets: [
        { label: 'LLM', data: allLabels.map((l) => { const i = hL.labels.indexOf(l); return i >= 0 ? hL.counts[i] : 0; }), backgroundColor: LLM_COLOR + '66', borderColor: LLM_COLOR, borderWidth: 1 },
        { label: 'Embedding', data: allLabels.map((l) => { const i = hE.labels.indexOf(l); return i >= 0 ? hE.counts[i] : 0; }), backgroundColor: EMB_COLOR + '66', borderColor: EMB_COLOR, borderWidth: 1 },
        { label: 'Clusters', data: allLabels.map((l) => { const i = hC.labels.indexOf(l); return i >= 0 ? hC.counts[i] : 0; }), backgroundColor: CLU_COLOR + '66', borderColor: CLU_COLOR, borderWidth: 1 },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, ...chartTheme },
  });

  const histRef = useChart('cluster-hist', {
    type: 'bar',
    data: {
      labels: data.clusterHist.map((h) => `${h.bucket}-${h.bucket + 4}`),
      datasets: [{ label: 'Clusters', data: data.clusterHist.map((h) => h.count), backgroundColor: CLU_COLOR + '80', borderColor: CLU_COLOR, borderWidth: 1 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, title: { display: true, text: 'Number of clusters by signal count range', color: '#a1a1aa', font: { size: 12 } } },
      scales: { x: { title: { display: true, text: 'Signals per cluster', color: '#a1a1aa' }, ...chartTheme.scales.x }, y: { title: { display: true, text: 'Count', color: '#a1a1aa' }, ...chartTheme.scales.y } },
    },
  });

  const maxClusters = Math.max(...data.domains.map((d) => d.clusters));

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 500, color: '#a1a1aa', marginBottom: 8 }}>LLM (Signal Matching)</h3>
          <div style={{ fontSize: 36, fontWeight: 700, color: LLM_COLOR }}>{avgLlm.toFixed(1)}</div>
          <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>avg score · σ={std(llms).toFixed(1)} · range {Math.min(...llms).toFixed(0)}–{Math.max(...llms).toFixed(0)}</div>
        </Card>
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 500, color: '#a1a1aa', marginBottom: 8 }}>Embedding (136-dim)</h3>
          <div style={{ fontSize: 36, fontWeight: 700, color: EMB_COLOR }}>{avgEmb.toFixed(1)}</div>
          <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>avg score · σ={std(embs).toFixed(1)} · range {Math.min(...embs).toFixed(1)}–{Math.max(...embs).toFixed(1)}</div>
        </Card>
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 500, color: '#a1a1aa', marginBottom: 8 }}>Clusters (400-dim)</h3>
          <div style={{ fontSize: 36, fontWeight: 700, color: CLU_COLOR }}>{avgClu.toFixed(1)}</div>
          <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>avg score · σ={std(clus).toFixed(1)} · range {Math.min(...clus).toFixed(1)}–{Math.max(...clus).toFixed(1)}</div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Card title="Score Distribution — All Three Approaches">
          <div style={{ position: 'relative', height: 300 }}><canvas ref={distRef} /></div>
        </Card>
        <Card title="Domain Coverage (clusters per domain)">
          {data.domains.map((d) => (
            <div key={d.domain} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ width: 110, fontSize: 13, color: '#a1a1aa', textAlign: 'right' }}>{d.domain}</div>
              <div style={{ flex: 1, height: 24, background: '#0f1117', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(d.clusters / maxClusters * 100).toFixed(0)}%`, background: DOMAIN_COLORS[d.domain], borderRadius: 4, display: 'flex', alignItems: 'center', paddingLeft: 8, fontSize: 11, fontWeight: 500, color: 'white' }}>
                  {d.clusters}
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#a1a1aa', width: 60, textAlign: 'right' }}>{d.signals} sigs</div>
            </div>
          ))}
        </Card>
      </div>

      <div style={{ marginTop: 20 }}>
        <Card title="Cluster Size Distribution (400 clusters)">
          <div style={{ position: 'relative', height: 250 }}><canvas ref={histRef} /></div>
        </Card>
      </div>
    </>
  );
}

// ═══ COMPARISON ═══
function ComparisonPanel({ data }: { data: DashboardData }) {
  // Scatter: Embedding vs Clusters
  const scatterEmbCluRef = useChart('scatter-emb-clu', {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Properties',
        data: data.properties.map((d) => ({ x: d.embedding, y: d.clusters, name: d.name })),
        backgroundColor: data.properties.map((d) => d.clusters > d.embedding ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'),
        borderColor: data.properties.map((d) => d.clusters > d.embedding ? '#22c55e' : '#ef4444'),
        borderWidth: 1, pointRadius: 3, pointHoverRadius: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx: ChartTooltipCtx) => { const d = ctx.raw; return `${d.name}: Emb=${d.x}, Clu=${d.y}`; } } },
      },
      scales: {
        x: { title: { display: true, text: 'Embedding Score', color: '#a1a1aa' }, ...chartTheme.scales.x },
        y: { title: { display: true, text: 'Clusters Score', color: '#a1a1aa' }, ...chartTheme.scales.y },
      },
    },
    plugins: [diagonalPlugin],
  });

  // Scatter: LLM vs Clusters
  const scatterLlmCluRef = useChart('scatter-llm-clu', {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Properties',
        data: data.properties.map((d) => ({ x: d.llm, y: d.clusters, name: d.name })),
        backgroundColor: data.properties.map((d) => d.clusters > d.llm ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'),
        borderColor: data.properties.map((d) => d.clusters > d.llm ? '#22c55e' : '#ef4444'),
        borderWidth: 1, pointRadius: 3, pointHoverRadius: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx: ChartTooltipCtx) => { const d = ctx.raw; return `${d.name}: LLM=${d.x}, Clu=${d.y}`; } } },
      },
      scales: {
        x: { title: { display: true, text: 'LLM Score', color: '#a1a1aa' }, ...chartTheme.scales.x },
        y: { title: { display: true, text: 'Clusters Score', color: '#a1a1aa' }, ...chartTheme.scales.y },
      },
    },
    plugins: [diagonalPlugin],
  });

  // Rank change: Embedding → Clusters
  const embCluRc = data.properties.map((d) => ({ ...d, rc: d.embR - d.cluR }));
  const sorted = [...embCluRc].sort((a, b) => b.rc - a.rc);
  const risers = sorted.slice(0, 10);
  const fallers = sorted.slice(-10).reverse();

  const MoverList = ({ items, isUp }: { items: typeof embCluRc; isUp: boolean }) => (
    <>
      {items.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #2a2d3a', fontSize: 13 }}>
          <span style={{ color: isUp ? '#22c55e' : '#ef4444', fontWeight: 600, width: 50 }}>{isUp ? '↑' : '↓'}{Math.abs(d.rc)}</span>
          <span style={{ flex: 1 }}>{d.name}</span>
          <span style={{ color: '#a1a1aa', fontSize: 12 }}>Emb #{d.embR} → Clu #{d.cluR}</span>
        </div>
      ))}
    </>
  );

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <Card title="Embedding vs Clusters (each dot = 1 property)">
          <div style={{ position: 'relative', height: 400 }}><canvas ref={scatterEmbCluRef} /></div>
        </Card>
        <Card title="LLM vs Clusters (each dot = 1 property)">
          <div style={{ position: 'relative', height: 400 }}><canvas ref={scatterLlmCluRef} /></div>
        </Card>
      </div>
      <Card title="Biggest Rank Movers (Embedding → Clusters)">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          <div>
            <h3 style={{ color: '#22c55e', fontSize: 14, marginBottom: 8 }}>⬆ Biggest Risers</h3>
            <MoverList items={risers} isUp />
          </div>
          <div>
            <h3 style={{ color: '#ef4444', fontSize: 14, marginBottom: 8 }}>⬇ Biggest Fallers</h3>
            <MoverList items={fallers} isUp={false} />
          </div>
        </div>
      </Card>
    </>
  );
}

/** Shared Chart.js plugin to draw y=x diagonal line */
const diagonalPlugin = {
  id: 'diagonal',
  afterDraw(chart: ChartDrawContext) {
    const { ctx, scales: { x, y } } = chart;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(x.getPixelForValue(Math.max(x.min, y.min)), y.getPixelForValue(Math.max(x.min, y.min)));
    ctx.lineTo(x.getPixelForValue(Math.min(x.max, y.max)), y.getPixelForValue(Math.min(x.max, y.max)));
    ctx.stroke();
    ctx.restore();
  },
};

// ═══ CLUSTER EXPLORER ═══
function ClusterPanel({ data }: { data: DashboardData }) {
  const treemapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!treemapRef.current) return;
    const el = treemapRef.current;
    const W = el.offsetWidth;
    const H = 500;

    const domainGroups = DOMAIN_RANGES.map((dr) => {
      const clusters = [];
      for (let i = dr.start; i <= dr.end; i++) clusters.push({ id: i, size: data.clusterSizes[i] || 1 });
      const total = clusters.reduce((s, c) => s + c.size, 0);
      return { ...dr, clusters, total };
    });

    const totalSignals = domainGroups.reduce((s, g) => s + g.total, 0);
    let html = '';
    let x = 0;

    domainGroups.forEach((group) => {
      const groupW = (group.total / totalSignals) * W;
      const color = DOMAIN_COLORS[group.domain] || '#666';
      let cy = 0;
      group.clusters.forEach((c) => {
        const ch = (c.size / group.total) * H;
        const opacity = 0.3 + (c.size / 55) * 0.7;
        html += `<div style="position:absolute;left:${x}px;top:${cy}px;width:${groupW - 1}px;height:${ch - 1}px;background:${color};opacity:${opacity};border-radius:2px;cursor:pointer;" title="Cluster ${c.id} (${group.domain}): ${c.size} signals"></div>`;
        cy += ch;
      });
      if (groupW > 50) {
        html += `<div style="position:absolute;left:${x + 4}px;top:${H + 4}px;font-size:11px;color:#a1a1aa;white-space:nowrap;">${group.domain}</div>`;
      }
      x += groupW;
    });

    el.innerHTML = html;
  }, [data]);

  const bubbleRef = useChart('domain-bubble', {
    type: 'bubble',
    data: {
      datasets: data.domains.map((d) => ({
        label: d.domain,
        data: [{ x: d.clusters, y: d.avg, r: Math.sqrt(d.signals) * 0.8 }],
        backgroundColor: (DOMAIN_COLORS[d.domain] || '#666') + '88',
        borderColor: DOMAIN_COLORS[d.domain],
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#a1a1aa' } } },
      scales: {
        x: { title: { display: true, text: 'Number of Clusters', color: '#a1a1aa' }, ...chartTheme.scales.x },
        y: { title: { display: true, text: 'Avg Cluster Size', color: '#a1a1aa' }, ...chartTheme.scales.y, min: 16, max: 22 },
      },
    },
  });

  return (
    <>
      <Card title="Cluster Treemap by Domain" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 12 }}>Each box = one of 400 clusters, sized by signal count. Grouped by domain.</div>
        <div ref={treemapRef} style={{ height: 500, position: 'relative', marginBottom: 30 }} />
      </Card>
      <Card title="Cluster Size vs Count per Domain">
        <div style={{ position: 'relative', height: 300 }}><canvas ref={bubbleRef} /></div>
      </Card>
    </>
  );
}

// ═══ RANKINGS TABLE ═══
function RankingsPanel({ data }: { data: DashboardData }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('clu-desc');

  const sortFns: Record<string, (a: Property, b: Property) => number> = {
    'clu-desc': (a, b) => b.clusters - a.clusters,
    'emb-desc': (a, b) => b.embedding - a.embedding,
    'llm-desc': (a, b) => b.llm - a.llm,
    'delta-emb-clu': (a, b) => (b.clusters - b.embedding) - (a.clusters - a.embedding),
    'delta-llm-clu': (a, b) => (b.clusters - b.llm) - (a.clusters - a.llm),
    'signals-desc': (a, b) => b.signals - a.signals,
  };

  const filtered = useMemo(() => {
    let rows = query
      ? data.properties.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()))
      : [...data.properties];
    rows.sort(sortFns[sort] || sortFns['clu-desc']);
    return rows.slice(0, 200);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.properties, query, sort]);

  return (
    <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search properties..."
          style={{ padding: '8px 14px', background: '#0f1117', border: '1px solid #2a2d3a', borderRadius: 8, color: '#e4e4e7', fontSize: 13, width: 300, outline: 'none' }}
        />
        <label style={{ fontSize: 12, color: '#a1a1aa' }}>Sort by:</label>
        <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ background: '#0f1117', border: '1px solid #2a2d3a', color: '#e4e4e7', padding: '6px 10px', borderRadius: 6, fontSize: 12 }}>
          <option value="clu-desc">Clusters Score ↓</option>
          <option value="emb-desc">Embedding Score ↓</option>
          <option value="llm-desc">LLM Score ↓</option>
          <option value="delta-emb-clu">Gain (Clusters−Embedding)</option>
          <option value="delta-llm-clu">Gain (Clusters−LLM)</option>
          <option value="signals-desc">Most Signals</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#a1a1aa' }}>
          Showing {filtered.length} of {data.properties.length}
        </span>
      </div>
      <Card style={{ padding: 0 }}>
        <div style={{ maxHeight: 600, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['#', 'Property', 'LLM', 'Embedding', 'Clusters', 'Δ Emb→Clu', 'LLM Rank', 'Emb Rank', 'Clu Rank', 'Signals'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#a1a1aa', fontWeight: 500, borderBottom: '1px solid #2a2d3a', position: 'sticky', top: 0, background: '#1a1d27' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => {
                const deltaEC = (d.clusters - d.embedding).toFixed(1);
                const dNum = Number(deltaEC);
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #2a2d3a' }}>
                    <td style={{ padding: '6px 12px', color: '#a1a1aa' }}>{i + 1}</td>
                    <td style={{ padding: '6px 12px' }}>{d.name}</td>
                    <td style={{ padding: '6px 12px' }}>
                      <span style={{ display: 'inline-block', height: 6, borderRadius: 3, width: Math.max(d.llm * 0.8, 2), background: LLM_COLOR, verticalAlign: 'middle', marginRight: 6 }} />
                      {d.llm}
                    </td>
                    <td style={{ padding: '6px 12px' }}>
                      <span style={{ display: 'inline-block', height: 6, borderRadius: 3, width: Math.max(d.embedding * 0.8, 2), background: EMB_COLOR, verticalAlign: 'middle', marginRight: 6 }} />
                      {d.embedding}
                    </td>
                    <td style={{ padding: '6px 12px' }}>
                      <span style={{ display: 'inline-block', height: 6, borderRadius: 3, width: Math.max(d.clusters * 0.8, 2), background: CLU_COLOR, verticalAlign: 'middle', marginRight: 6 }} />
                      {d.clusters}
                    </td>
                    <td style={{ padding: '6px 12px', fontWeight: 600, fontSize: 12, color: dNum > 0 ? '#22c55e' : dNum < 0 ? '#ef4444' : '#a1a1aa' }}>
                      {dNum > 0 ? '+' : ''}{deltaEC}
                    </td>
                    <td style={{ padding: '6px 12px', color: '#a1a1aa' }}>#{d.llmR}</td>
                    <td style={{ padding: '6px 12px', color: '#a1a1aa' }}>#{d.embR}</td>
                    <td style={{ padding: '6px 12px', color: '#a1a1aa' }}>#{d.cluR}</td>
                    <td style={{ padding: '6px 12px', color: '#a1a1aa' }}>{d.signals}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
