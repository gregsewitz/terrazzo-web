'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Script from 'next/script';

/* ═══════════════════════════════════════════════════════════
   Taste Intelligence Dashboard — /dashboard/taste-clusters
   Unlinked page for reviewing clustering & match quality.
   ═══════════════════════════════════════════════════════════ */

// Types
interface Property {
  name: string; v2: number; v3: number; signals: number;
  v2r: number; v3r: number; rc: number;
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
  FoodDrink: '#f59e0b', Service: '#22c55e', Setting: '#3b82f6',
  Wellness: '#f97316', Sustainability: '#10b981',
};

const DOMAIN_RANGES = [
  { domain: 'Atmosphere', start: 0, end: 50 },
  { domain: 'Character', start: 51, end: 135 },
  { domain: 'Design', start: 136, end: 191 },
  { domain: 'FoodDrink', start: 192, end: 263 },
  { domain: 'Service', start: 264, end: 336 },
  { domain: 'Setting', start: 337, end: 379 },
  { domain: 'Sustainability', start: 380, end: 386 },
  { domain: 'Wellness', start: 387, end: 399 },
];

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
function TabBar({ active, onChange }: { active: string; onChange: (t: any) => void }) {
  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'comparison', label: 'v2 vs v3 Comparison' },
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

function useChart(id: string, config: any) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current || typeof window === 'undefined' || !(window as any).Chart) return;
    chartRef.current?.destroy();
    chartRef.current = new (window as any).Chart(canvasRef.current, config);
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
  const v2s = data.properties.map((d) => d.v2);
  const v3s = data.properties.map((d) => d.v3);
  const avgV3 = mean(v3s);
  const avgV2 = mean(v2s);
  const absChanges = data.properties.map((d) => Math.abs(d.rc)).sort((a, b) => a - b);
  const medChange = absChanges[Math.floor(absChanges.length / 2)];

  const h2 = makeHist(v2s, 2);
  const h3 = makeHist(v3s, 2);
  const allLabels = [...new Set([...h2.labels, ...h3.labels])].sort();

  const distRef = useChart('dist', {
    type: 'bar',
    data: {
      labels: allLabels,
      datasets: [
        { label: 'v2', data: allLabels.map((l) => { const i = h2.labels.indexOf(l); return i >= 0 ? h2.counts[i] : 0; }), backgroundColor: 'rgba(139,92,246,0.4)', borderColor: '#8b5cf6', borderWidth: 1 },
        { label: 'v3', data: allLabels.map((l) => { const i = h3.labels.indexOf(l); return i >= 0 ? h3.counts[i] : 0; }), backgroundColor: 'rgba(6,182,212,0.4)', borderColor: '#06b6d4', borderWidth: 1 },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, ...chartTheme },
  });

  const histRef = useChart('cluster-hist', {
    type: 'bar',
    data: {
      labels: data.clusterHist.map((h) => `${h.bucket}-${h.bucket + 4}`),
      datasets: [{ label: 'Clusters', data: data.clusterHist.map((h) => h.count), backgroundColor: 'rgba(139,92,246,0.5)', borderColor: '#8b5cf6', borderWidth: 1 }],
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
          <h3 style={{ fontSize: 14, fontWeight: 500, color: '#a1a1aa', marginBottom: 8 }}>v3 Average Match Score</h3>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#8b5cf6' }}>{avgV3.toFixed(1)}</div>
          <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>+{(avgV3 - avgV2).toFixed(1)} vs v2 ({avgV2.toFixed(1)}) · σ={std(v3s).toFixed(1)}</div>
        </Card>
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 500, color: '#a1a1aa', marginBottom: 8 }}>Score Range (v3)</h3>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#06b6d4' }}>{Math.min(...v3s).toFixed(1)}–{Math.max(...v3s).toFixed(1)}</div>
          <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>v2 range: {Math.min(...v2s).toFixed(1)}–{Math.max(...v2s).toFixed(1)}</div>
        </Card>
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 500, color: '#a1a1aa', marginBottom: 8 }}>Median Rank Change</h3>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#f59e0b' }}>±{medChange}</div>
          <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>Average absolute rank shift between v2→v3</div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Card title="Score Distribution — v2 vs v3">
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
  const scatterRef = useChart('scatter', {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Properties',
        data: data.properties.map((d) => ({ x: d.v2, y: d.v3, name: d.name })),
        backgroundColor: data.properties.map((d) => d.v3 > d.v2 ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'),
        borderColor: data.properties.map((d) => d.v3 > d.v2 ? '#22c55e' : '#ef4444'),
        borderWidth: 1, pointRadius: 3, pointHoverRadius: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx: any) => { const d = ctx.raw; return `${d.name}: v2=${d.x}, v3=${d.y} (${d.y > d.x ? '+' : ''}${(d.y - d.x).toFixed(1)})`; } } },
      },
      scales: {
        x: { title: { display: true, text: 'v2 Score', color: '#a1a1aa' }, ...chartTheme.scales.x, min: 10, max: 90 },
        y: { title: { display: true, text: 'v3 Score', color: '#a1a1aa' }, ...chartTheme.scales.y, min: 20, max: 90 },
      },
    },
    plugins: [{
      id: 'diagonal',
      afterDraw(chart: any) {
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
    }],
  });

  const deltas = data.properties.map((d) => d.v3 - d.v2);
  const dHist = makeHist(deltas, 2);
  const deltaRef = useChart('delta', {
    type: 'bar',
    data: {
      labels: dHist.labels,
      datasets: [{
        label: 'Count', data: dHist.counts,
        backgroundColor: dHist.labels.map((l) => parseInt(l) >= 0 ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'),
        borderColor: dHist.labels.map((l) => parseInt(l) >= 0 ? '#22c55e' : '#ef4444'),
        borderWidth: 1,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, title: { display: true, text: 'Score difference (v3 − v2) per property', color: '#a1a1aa', font: { size: 12 } } },
      scales: { x: { title: { display: true, text: 'Score Change', color: '#a1a1aa' }, ...chartTheme.scales.x }, y: { title: { display: true, text: 'Properties', color: '#a1a1aa' }, ...chartTheme.scales.y } },
    },
  });

  const sorted = [...data.properties].sort((a, b) => b.rc - a.rc);
  const risers = sorted.slice(0, 10);
  const fallers = sorted.slice(-10).reverse();

  const MoverList = ({ items, isUp }: { items: Property[]; isUp: boolean }) => (
    <>
      {items.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #2a2d3a', fontSize: 13 }}>
          <span style={{ color: isUp ? '#22c55e' : '#ef4444', fontWeight: 600, width: 50 }}>{isUp ? '↑' : '↓'}{Math.abs(d.rc)}</span>
          <span style={{ flex: 1 }}>{d.name}</span>
          <span style={{ color: '#a1a1aa', fontSize: 12 }}>#{d.v2r} → #{d.v3r}</span>
        </div>
      ))}
    </>
  );

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <Card title="v2 vs v3 Score Scatter (each dot = 1 property)">
          <div style={{ position: 'relative', height: 400 }}><canvas ref={scatterRef} /></div>
        </Card>
        <Card title="Score Change Distribution (v3 − v2)">
          <div style={{ position: 'relative', height: 400 }}><canvas ref={deltaRef} /></div>
        </Card>
      </div>
      <Card title="Biggest Rank Movers (v2 → v3)">
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
  const [sort, setSort] = useState('v3-desc');

  const sortFns: Record<string, (a: Property, b: Property) => number> = {
    'v3-desc': (a, b) => b.v3 - a.v3,
    'v2-desc': (a, b) => b.v2 - a.v2,
    'rc-desc': (a, b) => b.rc - a.rc,
    'rc-asc': (a, b) => a.rc - b.rc,
    'delta-desc': (a, b) => (b.v3 - b.v2) - (a.v3 - a.v2),
    'signals-desc': (a, b) => b.signals - a.signals,
  };

  const filtered = useMemo(() => {
    let rows = query
      ? data.properties.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()))
      : [...data.properties];
    rows.sort(sortFns[sort] || sortFns['v3-desc']);
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
          <option value="v3-desc">v3 Score (high→low)</option>
          <option value="v2-desc">v2 Score (high→low)</option>
          <option value="rc-desc">Biggest Rise</option>
          <option value="rc-asc">Biggest Fall</option>
          <option value="delta-desc">Score Gain (v3−v2)</option>
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
                {['#', 'Property', 'v2 Score', 'v3 Score', 'Δ Score', 'v2 Rank', 'v3 Rank', 'Rank Change', 'Signals'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#a1a1aa', fontWeight: 500, borderBottom: '1px solid #2a2d3a', position: 'sticky', top: 0, background: '#1a1d27' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => {
                const delta = (d.v3 - d.v2).toFixed(1);
                const dNum = Number(delta);
                const rcText = d.rc > 0 ? `↑${d.rc}` : d.rc < 0 ? `↓${Math.abs(d.rc)}` : '—';
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #2a2d3a' }}>
                    <td style={{ padding: '6px 12px', color: '#a1a1aa' }}>{i + 1}</td>
                    <td style={{ padding: '6px 12px' }}>{d.name}</td>
                    <td style={{ padding: '6px 12px' }}>
                      <span style={{ display: 'inline-block', height: 6, borderRadius: 3, width: d.v2, background: '#8b5cf6', verticalAlign: 'middle', marginRight: 6 }} />
                      {d.v2}
                    </td>
                    <td style={{ padding: '6px 12px' }}>
                      <span style={{ display: 'inline-block', height: 6, borderRadius: 3, width: d.v3, background: '#06b6d4', verticalAlign: 'middle', marginRight: 6 }} />
                      {d.v3}
                    </td>
                    <td style={{ padding: '6px 12px', fontWeight: 600, fontSize: 12, color: dNum > 0 ? '#22c55e' : dNum < 0 ? '#ef4444' : '#a1a1aa' }}>
                      {dNum > 0 ? '+' : ''}{delta}
                    </td>
                    <td style={{ padding: '6px 12px', color: '#a1a1aa' }}>#{d.v2r}</td>
                    <td style={{ padding: '6px 12px', color: '#a1a1aa' }}>#{d.v3r}</td>
                    <td style={{ padding: '6px 12px', fontWeight: 600, fontSize: 12, color: d.rc > 0 ? '#22c55e' : d.rc < 0 ? '#ef4444' : '#a1a1aa' }}>
                      {rcText}
                    </td>
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
