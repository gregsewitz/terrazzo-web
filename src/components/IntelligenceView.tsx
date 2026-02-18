'use client';

import { useMemo } from 'react';
import { useIntelligence } from '@/hooks/useIntelligence';
import PipelineProgress from '@/components/PipelineProgress';
import {
  DOMAIN_COLORS,
  DOMAIN_ICONS,
  DIMENSION_TO_DOMAIN,
  TasteDomain,
  IntelligenceSignal,
  IntelligenceAntiSignal,
} from '@/types';

interface IntelligenceViewProps {
  googlePlaceId: string;
  placeName: string;
  matchScore?: number;
  onClose: () => void;
}

const TASTE_DOMAINS: TasteDomain[] = ['Design', 'Character', 'Service', 'Food', 'Location', 'Wellness'];

function confidenceLabel(c: number): string {
  if (c >= 0.8) return 'High';
  if (c >= 0.5) return 'Medium';
  return 'Low';
}

function SignalCard({ signal, domain }: { signal: IntelligenceSignal; domain: TasteDomain }) {
  const color = DOMAIN_COLORS[domain];
  return (
    <div
      className="p-2.5 rounded-lg mb-1.5"
      style={{ background: 'white', border: '1px solid var(--t-linen)' }}
    >
      <div className="text-[12px] leading-relaxed mb-1.5" style={{ color: 'var(--t-ink)' }}>
        {signal.signal}
      </div>
      <div className="flex items-center gap-2">
        {/* Confidence bar */}
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(28,26,23,0.06)' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${signal.confidence * 100}%`, background: color }}
          />
        </div>
        <span className="text-[9px]" style={{ color: 'rgba(28,26,23,0.9)', fontFamily: "'Space Mono', monospace" }}>
          {Math.round(signal.confidence * 100)}%
        </span>
        {/* Source type tag */}
        {signal.source_type && (
          <span
            className="text-[8px] px-1.5 py-0.5 rounded"
            style={{ background: 'var(--t-linen)', color: 'rgba(28,26,23,0.95)', fontFamily: "'Space Mono', monospace" }}
          >
            {signal.source_type}
          </span>
        )}
        {/* Review corroborated badge */}
        {signal.review_corroborated && (
          <span className="text-[9px]" style={{ color: 'var(--t-verde)' }} title="Review corroborated">
            ✓
          </span>
        )}
      </div>
    </div>
  );
}

function AntiSignalCard({ signal }: { signal: IntelligenceAntiSignal }) {
  const domain = DIMENSION_TO_DOMAIN[signal.dimension] as TasteDomain | undefined;
  return (
    <div
      className="p-2.5 rounded-lg mb-1.5"
      style={{
        background: 'rgba(160,108,40,0.04)',
        borderLeft: '3px solid var(--t-amber)',
      }}
    >
      <div className="text-[12px] leading-relaxed mb-1" style={{ color: 'var(--t-ink)' }}>
        {signal.signal}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[9px]" style={{ color: 'var(--t-amber)', fontFamily: "'Space Mono', monospace" }}>
          {confidenceLabel(signal.confidence)} · {domain || signal.dimension}
        </span>
      </div>
    </div>
  );
}

export default function IntelligenceView({ googlePlaceId, placeName, matchScore, onClose }: IntelligenceViewProps) {
  const { data, loading, error } = useIntelligence(googlePlaceId);

  // Group signals by domain
  const signalsByDomain = useMemo(() => {
    if (!data?.signals) return {} as Record<TasteDomain, IntelligenceSignal[]>;
    const grouped: Record<string, IntelligenceSignal[]> = {};
    data.signals.forEach(sig => {
      const domain = DIMENSION_TO_DOMAIN[sig.dimension] || sig.dimension;
      if (!grouped[domain]) grouped[domain] = [];
      grouped[domain].push(sig);
    });
    return grouped as Record<TasteDomain, IntelligenceSignal[]>;
  }, [data?.signals]);

  // How long ago was last enrichment
  const enrichedAgo = useMemo(() => {
    if (!data?.lastEnrichedAt) return null;
    const days = Math.floor((Date.now() - new Date(data.lastEnrichedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    return `${days} days ago`;
  }, [data?.lastEnrichedAt]);

  const isRunning = data?.status === 'enriching' || data?.status === 'pending';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[55] bg-black/30" onClick={onClose} />

      {/* Full-screen panel */}
      <div
        className="fixed inset-0 z-[55] overflow-y-auto"
        style={{ background: 'var(--t-cream)' }}
      >
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          {/* Header */}
          <div className="sticky top-0 z-10 px-5 pt-5 pb-3" style={{ background: 'var(--t-cream)' }}>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <button
                  onClick={onClose}
                  className="text-[11px] mb-1 block"
                  style={{ color: 'var(--t-honey)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Space Mono', monospace" }}
                >
                  ← Back to summary
                </button>
                <h1
                  className="text-[20px] leading-tight italic"
                  style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}
                >
                  {placeName}
                </h1>
                <p className="text-[10px] mt-0.5" style={{ color: 'rgba(28,26,23,0.9)', fontFamily: "'Space Mono', monospace" }}>
                  Terrazzo Briefing
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-base"
                style={{ background: 'var(--t-linen)', color: 'var(--t-ink)', border: 'none', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
          </div>

          <div className="px-5 pb-8">
            {/* Loading state */}
            {loading && !data && (
              <div className="text-center py-12">
                <div className="text-2xl mb-3">◇</div>
                <p className="text-[12px]" style={{ color: 'rgba(28,26,23,0.9)' }}>Preparing your briefing...</p>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="p-3 rounded-xl mb-4" style={{ background: 'rgba(214,48,32,0.06)', border: '1px solid rgba(214,48,32,0.15)' }}>
                <p className="text-[11px]" style={{ color: 'var(--t-signal-red)' }}>
                  Couldn&apos;t load briefing: {error}
                </p>
              </div>
            )}

            {data && (
              <>
                {/* Summary bar — 3 stats */}
                <div className="flex gap-2 mb-4">
                  {matchScore != null && (
                    <div className="flex-1 p-2.5 rounded-xl text-center" style={{ background: 'rgba(200,146,58,0.06)' }}>
                      <div
                        className="text-[18px] font-bold"
                        style={{ color: 'var(--t-honey)', fontFamily: "'Space Mono', monospace" }}
                      >
                        {matchScore}%
                      </div>
                      <div className="text-[9px]" style={{ color: 'rgba(28,26,23,0.9)' }}>Match</div>
                    </div>
                  )}
                  <div className="flex-1 p-2.5 rounded-xl text-center" style={{ background: 'rgba(42,122,86,0.06)' }}>
                    <div
                      className="text-[18px] font-bold"
                      style={{
                        color: data.reliabilityScore && data.reliabilityScore >= 0.6 ? 'var(--t-verde)' : 'var(--t-amber)',
                        fontFamily: "'Space Mono', monospace",
                      }}
                    >
                      {data.reliabilityScore != null ? Math.round(data.reliabilityScore * 100) : '—'}
                    </div>
                    <div className="text-[9px]" style={{ color: 'rgba(28,26,23,0.9)' }}>Reliability</div>
                  </div>
                  <div className="flex-1 p-2.5 rounded-xl text-center" style={{ background: 'rgba(28,26,23,0.03)' }}>
                    <div
                      className="text-[18px] font-bold"
                      style={{ color: 'var(--t-ink)', fontFamily: "'Space Mono', monospace" }}
                    >
                      {data.reviewCount}
                    </div>
                    <div className="text-[9px]" style={{ color: 'rgba(28,26,23,0.9)' }}>Reviews</div>
                  </div>
                </div>

                {/* Pipeline progress — shown while running */}
                {isRunning && data.latestRun && (
                  <div className="mb-4">
                    <PipelineProgress
                      currentStage={data.latestRun.currentStage}
                      stagesCompleted={data.latestRun.stagesCompleted}
                      startedAt={data.latestRun.startedAt}
                    />
                  </div>
                )}

                {/* Failed state */}
                {data.status === 'failed' && (
                  <div
                    className="p-3 rounded-xl mb-4"
                    style={{ background: 'rgba(214,48,32,0.06)', border: '1px solid rgba(214,48,32,0.15)' }}
                  >
                    <div
                      className="text-[10px] font-bold uppercase tracking-wider mb-1"
                      style={{ color: 'var(--t-signal-red)', fontFamily: "'Space Mono', monospace" }}
                    >
                      Briefing incomplete
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--t-ink)' }}>
                      We couldn&apos;t finish researching this place. Partial notes may be shown below.
                    </p>
                  </div>
                )}

                {/* Signals by dimension */}
                {TASTE_DOMAINS.map(domain => {
                  const signals = signalsByDomain[domain];
                  if (!signals || signals.length === 0) return null;
                  const color = DOMAIN_COLORS[domain];
                  const icon = DOMAIN_ICONS[domain];
                  return (
                    <div key={domain} className="mb-5">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-sm" style={{ color }}>{icon}</span>
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider"
                          style={{ color, fontFamily: "'Space Mono', monospace", letterSpacing: '1px' }}
                        >
                          {domain}
                        </span>
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-full ml-1"
                          style={{ background: `${color}15`, color, fontFamily: "'Space Mono', monospace" }}
                        >
                          {signals.length}
                        </span>
                      </div>
                      {signals
                        .sort((a, b) => b.confidence - a.confidence)
                        .map((sig, i) => (
                          <SignalCard key={i} signal={sig} domain={domain} />
                        ))}
                    </div>
                  );
                })}

                {/* Anti-signals */}
                {data.antiSignals && data.antiSignals.length > 0 && (
                  <div className="mb-5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-sm" style={{ color: 'var(--t-amber)' }}>◈</span>
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: 'var(--t-amber)', fontFamily: "'Space Mono', monospace", letterSpacing: '1px' }}
                      >
                        Heads Up
                      </span>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full ml-1"
                        style={{ background: 'rgba(160,108,40,0.1)', color: 'var(--t-amber)', fontFamily: "'Space Mono', monospace" }}
                      >
                        {data.antiSignals.length}
                      </span>
                    </div>
                    {data.antiSignals
                      .sort((a, b) => b.confidence - a.confidence)
                      .map((sig, i) => (
                        <AntiSignalCard key={i} signal={sig} />
                      ))}
                  </div>
                )}

                {/* Facts */}
                {data.facts && Object.keys(data.facts).length > 0 && (
                  <div className="mb-5">
                    <div
                      className="text-[10px] font-bold uppercase tracking-wider mb-2"
                      style={{ color: 'rgba(28,26,23,0.95)', fontFamily: "'Space Mono', monospace", letterSpacing: '1px' }}
                    >
                      Facts
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-3 rounded-xl" style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
                      {Object.entries(data.facts).map(([key, value]) => {
                        if (value == null || value === '') return null;
                        const displayKey = key
                          .replace(/([A-Z])/g, ' $1')
                          .replace(/^./, s => s.toUpperCase())
                          .trim();
                        return (
                          <div key={key}>
                            <div
                              className="text-[9px] uppercase tracking-wider"
                              style={{ color: 'rgba(28,26,23,0.9)', fontFamily: "'Space Mono', monospace" }}
                            >
                              {displayKey}
                            </div>
                            <div className="text-[12px]" style={{ color: 'var(--t-ink)' }}>
                              {String(value)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Footer — enrichment meta */}
                <div className="flex items-center justify-between pt-3 mt-2" style={{ borderTop: '1px solid var(--t-linen)' }}>
                  {enrichedAgo && (
                    <span className="text-[9px]" style={{ color: 'rgba(28,26,23,0.9)', fontFamily: "'Space Mono', monospace" }}>
                      Last updated {enrichedAgo}
                    </span>
                  )}
                  <span className="text-[9px]" style={{ color: 'rgba(28,26,23,0.95)', fontFamily: "'Space Mono', monospace" }}>
                    {data.pipelineVersion}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
