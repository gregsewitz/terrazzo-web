'use client';

import { useMemo } from 'react';
import { useBriefing } from '@/hooks/useBriefing';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { TerrazzoMosaic } from '@/components/TerrazzoMosaic';
import { DEFAULT_USER_PROFILE } from '@/lib/taste';
import { useOnboardingStore } from '@/stores/onboardingStore';
import type { TasteProfile as NumericProfile } from '@/types';
import PipelineProgress from '@/components/PipelineProgress';
import {
  DOMAIN_COLORS,
  DOMAIN_ICONS,
  DIMENSION_TO_DOMAIN,
  TasteDomain,
  BriefingSignal,
  BriefingAntiSignal,
  ImportedPlace,
} from '@/types';
import { FONT, INK } from '@/constants/theme';

interface BriefingViewProps {
  googlePlaceId: string;
  placeName: string;
  matchScore?: number;
  place?: ImportedPlace;
  onClose: () => void;
}

const TASTE_DOMAINS: TasteDomain[] = ['Design', 'Character', 'Service', 'Food', 'Location', 'Wellness'];

function strengthLabel(c: number): string {
  if (c >= 0.8) return 'Strong';
  if (c >= 0.5) return 'Moderate';
  return 'Faint';
}

function SignalCard({ signal, domain }: { signal: BriefingSignal; domain: TasteDomain }) {
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
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: INK['06'] }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${signal.confidence * 100}%`, background: color }}
          />
        </div>
        <span className="text-[9px]" style={{ color: INK['90'], fontFamily: FONT.mono }}>
          {Math.round(signal.confidence * 100)}%
        </span>
        {/* Source type tag */}
        {signal.source_type && (
          <span
            className="text-[8px] px-1.5 py-0.5 rounded"
            style={{ background: 'var(--t-linen)', color: INK['95'], fontFamily: FONT.mono }}
          >
            {signal.source_type}
          </span>
        )}
        {/* Review corroborated badge */}
        {signal.review_corroborated && (
          <div title="Review corroborated">
            <PerriandIcon name="check" size={12} color="var(--t-verde)" />
          </div>
        )}
      </div>
    </div>
  );
}

function AntiSignalCard({ signal }: { signal: BriefingAntiSignal }) {
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
        <span className="text-[9px]" style={{ color: 'var(--t-amber)', fontFamily: FONT.mono }}>
          {strengthLabel(signal.confidence)} · {domain || signal.dimension}
        </span>
      </div>
    </div>
  );
}

export default function BriefingView({ googlePlaceId, placeName, matchScore, place, onClose }: BriefingViewProps) {
  const { data, loading, error } = useBriefing(googlePlaceId);

  // Build real numeric profile from store for mosaic thumbnail
  const generatedProfile = useOnboardingStore(s => s.generatedProfile);
  const numericProfile: NumericProfile = useMemo(() => {
    const gp = generatedProfile as unknown as { radarData?: { axis: string; value: number }[] } | null;
    if (!gp?.radarData?.length) return DEFAULT_USER_PROFILE;
    const radarMap: Record<string, keyof NumericProfile> = {
      Sensory: 'Design', Material: 'Design',
      Authenticity: 'Character', Social: 'Service',
      Cultural: 'Location', Spatial: 'Wellness',
    };
    const result: NumericProfile = { ...DEFAULT_USER_PROFILE };
    for (const r of gp.radarData) {
      const d = radarMap[r.axis];
      if (d) result[d] = Math.max(result[d], r.value);
    }
    return result;
  }, [generatedProfile]);

  // Group signals by domain
  const signalsByDomain = useMemo(() => {
    if (!data?.signals) return {} as Record<TasteDomain, BriefingSignal[]>;
    const grouped: Record<string, BriefingSignal[]> = {};
    data.signals.forEach(sig => {
      const domain = DIMENSION_TO_DOMAIN[sig.dimension] || sig.dimension;
      if (!grouped[domain]) grouped[domain] = [];
      grouped[domain].push(sig);
    });
    return grouped as Record<TasteDomain, BriefingSignal[]>;
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
                  style={{ color: '#8a6a2a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT.mono }}
                >
                  ← Back to summary
                </button>
                <h1
                  className="text-[20px] leading-tight italic"
                  style={{ fontFamily: FONT.serif, color: 'var(--t-ink)' }}
                >
                  {placeName}
                </h1>
                <p className="text-[10px] mt-0.5" style={{ color: INK['90'], fontFamily: FONT.mono }}>
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
                <div className="text-2xl mb-3 flex justify-center">
                  <PerriandIcon name="discover" size={36} color="var(--t-honey)" />
                </div>
                <p className="text-[12px]" style={{ color: INK['90'] }}>Preparing your briefing...</p>
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

            {/* No data at all */}
            {!data && !loading && !error && !place?.terrazzoInsight && (
              <div className="text-center py-12">
                <div className="text-2xl mb-3 flex justify-center">
                  <PerriandIcon name="discover" size={36} color={INK['30']} />
                </div>
                <p className="text-[12px] mb-1" style={{ color: INK['70'], fontFamily: FONT.sans }}>
                  No briefing data available yet
                </p>
                <p className="text-[10px]" style={{ color: INK['50'], fontFamily: FONT.mono }}>
                  Intelligence data will appear here once the pipeline has run for this place.
                </p>
              </div>
            )}

            {/* Fallback briefing from local place data when API has no intelligence */}
            {!data && !loading && place && place.terrazzoInsight && (
              <>
                {/* Summary bar — mosaic + match */}
                <div className="flex gap-2 mb-4">
                  <div className="flex items-center justify-center p-2.5 rounded-xl" style={{ background: INK['03'] }}>
                    <TerrazzoMosaic profile={numericProfile} size="xs" />
                  </div>
                  {matchScore != null && (
                    <div className="flex-1 p-2.5 rounded-xl text-center" style={{ background: 'rgba(200,146,58,0.06)' }}>
                      <div
                        className="text-[18px] font-bold"
                        style={{ color: '#8a6a2a', fontFamily: FONT.mono }}
                      >
                        {matchScore}%
                      </div>
                      <div className="text-[9px]" style={{ color: INK['90'] }}>Match</div>
                    </div>
                  )}
                  {place.google?.rating && (
                    <div className="flex-1 p-2.5 rounded-xl text-center" style={{ background: INK['03'] }}>
                      <div
                        className="text-[18px] font-bold"
                        style={{ color: 'var(--t-ink)', fontFamily: FONT.mono }}
                      >
                        {place.google.rating}
                      </div>
                      <div className="text-[9px]" style={{ color: INK['90'] }}>Google</div>
                    </div>
                  )}
                </div>

                {/* Terrazzo Insight — why this place */}
                {place.terrazzoInsight && (
                  <div className="mb-5">
                    <div
                      className="text-[10px] font-bold uppercase tracking-wider mb-2"
                      style={{ color: 'var(--t-verde)', fontFamily: FONT.mono, letterSpacing: '1px' }}
                    >
                      Why This Place
                    </div>
                    <div
                      className="p-3 rounded-xl"
                      style={{ background: 'rgba(42,122,86,0.04)', border: '1px solid rgba(42,122,86,0.12)' }}
                    >
                      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--t-ink)', fontFamily: FONT.sans }}>
                        {place.terrazzoInsight.why}
                      </p>
                    </div>
                  </div>
                )}

                {/* Caveat / heads-up */}
                {place.terrazzoInsight?.caveat && (
                  <div className="mb-5">
                    <div
                      className="text-[10px] font-bold uppercase tracking-wider mb-2"
                      style={{ color: 'var(--t-amber)', fontFamily: FONT.mono, letterSpacing: '1px' }}
                    >
                      Heads Up
                    </div>
                    <div
                      className="p-3 rounded-xl"
                      style={{ background: 'rgba(160,108,40,0.04)', borderLeft: '3px solid var(--t-amber)' }}
                    >
                      <p className="text-[12px] leading-relaxed" style={{ color: 'var(--t-ink)' }}>
                        {place.terrazzoInsight.caveat}
                      </p>
                    </div>
                  </div>
                )}

                {/* Match Breakdown by domain */}
                {place.matchBreakdown && (
                  <div className="mb-5">
                    <div
                      className="text-[10px] font-bold uppercase tracking-wider mb-2"
                      style={{ color: INK['95'], fontFamily: FONT.mono, letterSpacing: '1px' }}
                    >
                      Taste Match
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {TASTE_DOMAINS.map(domain => {
                        const score = place.matchBreakdown[domain] ?? 0;
                        if (score < 0.1) return null;
                        const color = DOMAIN_COLORS[domain];
                        const icon = DOMAIN_ICONS[domain];
                        return (
                          <div key={domain} className="flex items-center gap-2">
                            <div style={{ width: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <PerriandIcon name={icon} size={12} color={color} />
                            </div>
                            <span className="text-[10px] w-16" style={{ color: INK['90'], fontFamily: FONT.mono }}>
                              {domain}
                            </span>
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: INK['06'] }}>
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${score * 100}%`, background: color }}
                              />
                            </div>
                            <span className="text-[9px] w-8 text-right" style={{ color: INK['90'], fontFamily: FONT.mono }}>
                              {Math.round(score * 100)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* What to order */}
                {place.whatToOrder && place.whatToOrder.length > 0 && (
                  <div className="mb-5">
                    <div
                      className="text-[10px] font-bold uppercase tracking-wider mb-2"
                      style={{ color: INK['95'], fontFamily: FONT.mono, letterSpacing: '1px' }}
                    >
                      What to Order
                    </div>
                    <div className="flex flex-col gap-1" style={{ padding: '10px 12px', background: 'white', borderRadius: 12, border: '1px solid var(--t-linen)' }}>
                      {place.whatToOrder.map((item, i) => (
                        <div key={i} className="text-[12px]" style={{ color: 'var(--t-ink)', fontFamily: FONT.sans }}>
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tips */}
                {place.tips && place.tips.length > 0 && (
                  <div className="mb-5">
                    <div
                      className="text-[10px] font-bold uppercase tracking-wider mb-2"
                      style={{ color: INK['95'], fontFamily: FONT.mono, letterSpacing: '1px' }}
                    >
                      Tips
                    </div>
                    <div className="flex flex-col gap-1" style={{ padding: '10px 12px', background: 'white', borderRadius: 12, border: '1px solid var(--t-linen)' }}>
                      {place.tips.map((tip, i) => (
                        <div key={i} className="text-[12px]" style={{ color: 'var(--t-ink)', fontFamily: FONT.sans }}>
                          {tip}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Enrichment facts */}
                {place.enrichment && (
                  <div className="mb-5">
                    <div
                      className="text-[10px] font-bold uppercase tracking-wider mb-2"
                      style={{ color: INK['95'], fontFamily: FONT.mono, letterSpacing: '1px' }}
                    >
                      Details
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-3 rounded-xl" style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
                      {place.enrichment.priceRange && (
                        <div>
                          <div className="text-[9px] uppercase tracking-wider" style={{ color: INK['90'], fontFamily: FONT.mono }}>Price Range</div>
                          <div className="text-[12px]" style={{ color: 'var(--t-ink)' }}>{place.enrichment.priceRange}</div>
                        </div>
                      )}
                      {place.enrichment.hours && (
                        <div>
                          <div className="text-[9px] uppercase tracking-wider" style={{ color: INK['90'], fontFamily: FONT.mono }}>Hours</div>
                          <div className="text-[12px]" style={{ color: 'var(--t-ink)' }}>{place.enrichment.hours}</div>
                        </div>
                      )}
                      {place.enrichment.closedDays && place.enrichment.closedDays.length > 0 && (
                        <div>
                          <div className="text-[9px] uppercase tracking-wider" style={{ color: INK['90'], fontFamily: FONT.mono }}>Closed</div>
                          <div className="text-[12px]" style={{ color: 'var(--t-ink)' }}>{place.enrichment.closedDays.join(', ')}</div>
                        </div>
                      )}
                      {place.enrichment.seasonalNote && (
                        <div>
                          <div className="text-[9px] uppercase tracking-wider" style={{ color: INK['90'], fontFamily: FONT.mono }}>Note</div>
                          <div className="text-[12px]" style={{ color: 'var(--t-ink)' }}>{place.enrichment.seasonalNote}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Taste note */}
                {place.tasteNote && (
                  <div className="mb-5">
                    <div
                      className="text-[10px] font-bold uppercase tracking-wider mb-2"
                      style={{ color: INK['95'], fontFamily: FONT.mono, letterSpacing: '1px' }}
                    >
                      Taste Note
                    </div>
                    <div
                      className="p-3 rounded-xl text-[12px] leading-relaxed italic"
                      style={{ background: 'white', border: '1px solid var(--t-linen)', color: INK['90'], fontFamily: FONT.serif }}
                    >
                      {place.tasteNote}
                    </div>
                  </div>
                )}

                {/* Friend attribution */}
                {place.friendAttribution && (
                  <div className="mb-5">
                    <div
                      className="text-[10px] font-bold uppercase tracking-wider mb-2"
                      style={{ color: INK['95'], fontFamily: FONT.mono, letterSpacing: '1px' }}
                    >
                      Recommended By
                    </div>
                    <div
                      className="p-3 rounded-xl flex items-start gap-2"
                      style={{ background: 'white', border: '1px solid var(--t-linen)' }}
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                        style={{ background: 'rgba(42,122,86,0.08)', color: 'var(--t-verde)' }}
                      >
                        {place.friendAttribution.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-[12px] font-semibold" style={{ color: 'var(--t-ink)', fontFamily: FONT.sans }}>
                          {place.friendAttribution.name}
                        </div>
                        {place.friendAttribution.note && (
                          <div className="text-[11px] italic mt-0.5" style={{ color: INK['70'], fontFamily: FONT.serif }}>
                            &ldquo;{place.friendAttribution.note}&rdquo;
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 mt-2" style={{ borderTop: '1px solid var(--t-linen)' }}>
                  <span className="text-[9px]" style={{ color: INK['90'], fontFamily: FONT.mono }}>
                    Local briefing
                  </span>
                </div>
              </>
            )}

            {data && (
              <>
                {/* Summary bar — mosaic + stats */}
                <div className="flex gap-2 mb-4">
                  <div className="flex items-center justify-center p-2.5 rounded-xl" style={{ background: INK['03'] }}>
                    <TerrazzoMosaic profile={numericProfile} size="xs" />
                  </div>
                  {matchScore != null && (
                    <div className="flex-1 p-2.5 rounded-xl text-center" style={{ background: 'rgba(200,146,58,0.06)' }}>
                      <div
                        className="text-[18px] font-bold"
                        style={{ color: '#8a6a2a', fontFamily: FONT.mono }}
                      >
                        {matchScore}%
                      </div>
                      <div className="text-[9px]" style={{ color: INK['90'] }}>Match</div>
                    </div>
                  )}
                  <div className="flex-1 p-2.5 rounded-xl text-center" style={{ background: 'rgba(42,122,86,0.06)' }}>
                    <div
                      className="text-[18px] font-bold"
                      style={{
                        color: data.reliabilityScore && data.reliabilityScore >= 0.6 ? 'var(--t-verde)' : 'var(--t-amber)',
                        fontFamily: FONT.mono,
                      }}
                    >
                      {data.reliabilityScore != null ? Math.round(data.reliabilityScore * 100) : '—'}
                    </div>
                    <div className="text-[9px]" style={{ color: INK['90'] }}>Reliability</div>
                  </div>
                  <div className="flex-1 p-2.5 rounded-xl text-center" style={{ background: INK['03'] }}>
                    <div
                      className="text-[18px] font-bold"
                      style={{ color: 'var(--t-ink)', fontFamily: FONT.mono }}
                    >
                      {data.reviewCount}
                    </div>
                    <div className="text-[9px]" style={{ color: INK['90'] }}>Reviews</div>
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
                      style={{ color: 'var(--t-signal-red)', fontFamily: FONT.mono }}
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
                        <div style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <PerriandIcon name={icon} size={16} color={color} />
                        </div>
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider"
                          style={{ color, fontFamily: FONT.mono, letterSpacing: '1px' }}
                        >
                          {domain}
                        </span>
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-full ml-1"
                          style={{ background: `${color}15`, color, fontFamily: FONT.mono }}
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
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: 'var(--t-amber)', fontFamily: FONT.mono, letterSpacing: '1px' }}
                      >
                        Heads Up
                      </span>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full ml-1"
                        style={{ background: 'rgba(160,108,40,0.1)', color: 'var(--t-amber)', fontFamily: FONT.mono }}
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
                      style={{ color: INK['95'], fontFamily: FONT.mono, letterSpacing: '1px' }}
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
                              style={{ color: INK['90'], fontFamily: FONT.mono }}
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
                    <span className="text-[9px]" style={{ color: INK['90'], fontFamily: FONT.mono }}>
                      Last updated {enrichedAgo}
                    </span>
                  )}
                  <span className="text-[9px]" style={{ color: INK['95'], fontFamily: FONT.mono }}>
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
