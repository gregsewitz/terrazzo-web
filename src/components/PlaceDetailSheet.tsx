'use client';

import { ImportedPlace, DOMAIN_COLORS, DOMAIN_ICONS, TasteDomain } from '@/types';

interface PlaceDetailSheetProps {
  item: ImportedPlace;
  onClose: () => void;
}

const TASTE_DOMAINS: TasteDomain[] = ['Design', 'Character', 'Service', 'Food', 'Location', 'Wellness'];

export default function PlaceDetailSheet({ item, onClose }: PlaceDetailSheetProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/30"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 overflow-y-auto rounded-t-2xl"
        style={{
          maxWidth: 480,
          margin: '0 auto',
          maxHeight: '85vh',
          background: 'var(--t-cream)',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-8 h-1 rounded-full" style={{ background: 'var(--t-travertine)' }} />
        </div>

        <div className="px-4 pb-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2
                className="text-xl mb-0.5"
                style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}
              >
                {item.name}
              </h2>
              <p className="text-[11px]" style={{ color: 'rgba(28,26,23,0.5)' }}>
                {item.location}
              </p>
            </div>
            <div
              className="text-lg font-bold px-2.5 py-1 rounded-xl"
              style={{
                background: 'rgba(200,146,58,0.12)',
                color: 'var(--t-honey)',
                fontFamily: "'Space Mono', monospace",
              }}
            >
              {item.matchScore}%
            </div>
          </div>

          {/* Google Places Facts */}
          {item.google && (
            <div className="flex gap-2 mb-4 flex-wrap">
              {item.google.rating && (
                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(28,26,23,0.04)' }}>
                  <span style={{ color: 'var(--t-chrome-yellow)' }}>★</span>
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--t-ink)' }}>{item.google.rating}</span>
                  {item.google.reviewCount && (
                    <span className="text-[10px]" style={{ color: 'rgba(28,26,23,0.4)' }}>
                      ({item.google.reviewCount.toLocaleString()})
                    </span>
                  )}
                </div>
              )}
              {item.google.category && (
                <div className="px-2.5 py-1.5 rounded-lg text-[11px]" style={{ background: 'rgba(28,26,23,0.04)', color: 'rgba(28,26,23,0.6)' }}>
                  {item.google.category}
                </div>
              )}
              {item.google.priceLevel && (
                <div className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium" style={{ background: 'rgba(28,26,23,0.04)', color: 'var(--t-ink)' }}>
                  {'$'.repeat(item.google.priceLevel)}
                </div>
              )}
            </div>
          )}

          {/* Enrichment warnings */}
          {item.enrichment?.closedDays && item.enrichment.closedDays.length > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4"
              style={{ background: 'rgba(232,104,48,0.08)', border: '1px solid rgba(232,104,48,0.2)' }}
            >
              <span>⚠️</span>
              <span className="text-[11px]" style={{ color: 'var(--t-panton-orange)' }}>
                Closed {item.enrichment.closedDays.join(', ')}s
              </span>
              {item.enrichment.confidence && (
                <span className="text-[9px] ml-auto" style={{ color: 'rgba(28,26,23,0.3)' }}>
                  Confidence: {Math.round(item.enrichment.confidence * 100)}%
                </span>
              )}
            </div>
          )}

          {/* Source + Taste note */}
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(28,26,23,0.06)', color: 'rgba(28,26,23,0.5)', fontFamily: "'Space Mono', monospace" }}
              >
                via {item.source.name}
              </span>
            </div>
            {item.tasteNote && (
              <p className="text-[12px] italic leading-relaxed" style={{ color: 'rgba(28,26,23,0.6)' }}>
                "{item.tasteNote}"
              </p>
            )}
          </div>

          {/* Taste Axes Breakdown */}
          <div className="mb-4">
            <h3
              className="text-[10px] uppercase tracking-wider mb-2.5 font-bold"
              style={{ color: 'var(--t-amber)', fontFamily: "'Space Mono', monospace" }}
            >
              Taste Axes
            </h3>
            <div className="flex flex-col gap-2">
              {TASTE_DOMAINS.map(domain => {
                const value = item.matchBreakdown?.[domain] ?? 0;
                return (
                  <div key={domain} className="flex items-center gap-2">
                    <span className="text-xs w-4 text-center" style={{ color: DOMAIN_COLORS[domain] }}>
                      {DOMAIN_ICONS[domain]}
                    </span>
                    <span
                      className="text-[10px] w-16 font-medium"
                      style={{ color: 'var(--t-ink)', fontFamily: "'Space Mono', monospace" }}
                    >
                      {domain}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(28,26,23,0.06)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${value * 100}%`, background: DOMAIN_COLORS[domain] }}
                      />
                    </div>
                    <span className="text-[10px] w-8 text-right" style={{ color: 'rgba(28,26,23,0.4)', fontFamily: "'Space Mono', monospace" }}>
                      {Math.round(value * 100)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Terrazzo Insights */}
          {item.terrazzoInsight && (
            <div className="flex flex-col gap-3">
              {/* Why you'll love it */}
              <div
                className="p-3 rounded-xl"
                style={{ background: 'rgba(42,122,86,0.06)', border: '1px solid rgba(42,122,86,0.15)' }}
              >
                <h4
                  className="text-[10px] uppercase tracking-wider font-bold mb-1.5"
                  style={{ color: 'var(--t-verde)', fontFamily: "'Space Mono', monospace" }}
                >
                  ✦ Why You'll Love It
                </h4>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--t-ink)' }}>
                  {item.terrazzoInsight.why}
                </p>
              </div>

              {/* Heads up */}
              {item.terrazzoInsight.caveat && (
                <div
                  className="p-3 rounded-xl"
                  style={{ background: 'rgba(160,108,40,0.06)', border: '1px solid rgba(160,108,40,0.15)' }}
                >
                  <h4
                    className="text-[10px] uppercase tracking-wider font-bold mb-1.5"
                    style={{ color: 'var(--t-amber)', fontFamily: "'Space Mono', monospace" }}
                  >
                    ◈ Heads Up
                  </h4>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--t-ink)' }}>
                    {item.terrazzoInsight.caveat}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
