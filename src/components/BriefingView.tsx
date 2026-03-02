'use client';

import { useMemo } from 'react';
import { useBriefing } from '@/hooks/useBriefing';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { TerrazzoMosaic } from '@/components/TerrazzoMosaic';
import { DEFAULT_USER_PROFILE } from '@/lib/taste';
import { useOnboardingStore } from '@/stores/onboardingStore';
import type { TasteProfile as NumericProfile } from '@/types';
import PipelineProgress from '@/components/PipelineProgress';
import { SafeFadeIn } from '@/components/animations/SafeFadeIn';
import {
  FadeInSection,
  StaggerContainer,
  StaggerItem,
  AnimatedBar,
  AnimatedNumber,
  AnimatedScoreArc,
} from '@/components/animations/AnimatedElements';
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
      className="p-3 rounded-xl mb-2"
      style={{ background: 'white', border: '1px solid var(--t-linen)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}
    >
      <div className="text-[12px] leading-relaxed mb-2" style={{ color: 'var(--t-ink)' }}>
        {signal.signal}
      </div>
      <div className="flex items-center gap-2">
        {/* Confidence bar */}
        <div className="flex-1">
          <AnimatedBar
            percentage={signal.confidence * 100}
            color={color}
            height={4}
            delay={0.1}
            borderRadius={2}
          />
        </div>
        <span className="text-[9px] font-semibold" style={{ color: INK['90'], fontFamily: FONT.mono }}>
          {Math.round(signal.confidence * 100)}%
        </span>
        {/* Source type tag */}
        {signal.source_type && (
          <span
            className="text-[8px] px-1.5 py-0.5 rounded"
            style={{ background: 'var(--t-linen)', color: INK['80'], fontFamily: FONT.mono }}
          >
            {signal.source_type}
          </span>
        )}
        {/* Review corroborated badge */}
        {signal.review_corroborated && (
          <div title="Review corroborated" className="flex items-center">
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
      className="p-3 rounded-xl mb-2"
      style={{
        background: 'rgba(160,108,40,0.04)',
        borderLeft: '3px solid var(--t-amber)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}
    >
      <div className="text-[12px] leading-relaxed mb-1.5" style={{ color: 'var(--t-ink)' }}>
        {signal.signal}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-semibold" style={{ color: 'var(--t-amber)', fontFamily: FONT.mono }}>
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
    if (!data?.signals || !Array.isArray(data.signals)) return {} as Record<TasteDomain, BriefingSignal[]>;
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
          {/* Header — immersive with gradient backdrop */}
          <div
            className="sticky top-0 z-10 px-5 pt-5 pb-4"
            style={{
              background: 'linear-gradient(to bottom, var(--t-cream) 70%, transparent)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <button
                  onClick={onClose}
                  className="text-[11px] mb-1.5 block"
                  style={{ color: '#8a6a2a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT.mono }}
                >
                  ← Back to summary
                </button>
                <h1
                  className="text-[22px] leading-tight italic"
                  style={{ fontFamily: FONT.serif, color: 'var(--t-ink)' }}
                >
                  {placeName}
                </h1>
                <p className="text-[10px] mt-0.5" style={{ color: INK['70'], fontFamily: FONT.mono }}>
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
                <p className="text-[12px]" style={{ color: INK['70'] }}>Preparing your briefing...</p>
              </div>
            )}

            {/* Error state */}
            {error && (
              <SafeFadeIn direction="up" distance={10} duration={0.4}>
                <div className="p-4 rounded-2xl mb-5" style={{ background: 'rgba(214,48,32,0.06)', border: '1px solid rgba(214,48,32,0.15)' }}>
                  <p className="text-[11px]" style={{ color: 'var(--t-signal-red)' }}>
                    Couldn&apos;t load briefing: {error}
                  </p>
                </div>
              </SafeFadeIn>
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
                <p className="text-[10px]" style={{ color: INK['70'], fontFamily: FONT.mono }}>
                  Intelligence data will appear here once the pipeline has run for this place.
                </p>
              </div>
            )}

            {/* Fallback briefing from local place data when API has no intelligence */}
            {!data && !loading && place && place.terrazzoInsight && (
              <>
                {/* Summary bar — mosaic + stats with animated numbers */}
                <SafeFadeIn direction="up" distance={14} duration={0.5}>
                  <div className="flex gap-2.5 mb-5">
                    <div className="flex items-center justify-center p-3 rounded-2xl" style={{ background: INK['03'] }}>
                      <TerrazzoMosaic profile={numericProfile} size="xs" />
                    </div>
                    {matchScore != null && (
                      <div className="flex-1 p-3 rounded-2xl text-center" style={{ background: 'linear-gradient(135deg, rgba(200,146,58,0.08), rgba(200,146,58,0.03))' }}>
                        <div className="text-[20px] font-bold" style={{ color: '#8a6a2a', fontFamily: FONT.mono }}>
                          <AnimatedNumber value={matchScore} suffix="%" />
                        </div>
                        <div className="text-[9px] mt-0.5" style={{ color: INK['70'] }}>Match</div>
                      </div>
                    )}
                    {place.google?.rating && (
                      <div className="flex-1 p-3 rounded-2xl text-center" style={{ background: INK['03'] }}>
                        <div className="text-[20px] font-bold" style={{ color: 'var(--t-ink)', fontFamily: FONT.mono }}>
                          {place.google.rating}
                        </div>
                        <div className="text-[9px] mt-0.5" style={{ color: INK['70'] }}>Google</div>
                      </div>
                    )}
                  </div>
                </SafeFadeIn>

                {/* Terrazzo Insight — why this place */}
                {place.terrazzoInsight && (
                  <FadeInSection delay={0.1} direction="up" distance={16}>
                    <div className="mb-6">
                      <div
                        className="text-[10px] font-bold uppercase tracking-wider mb-2.5"
                        style={{ color: 'var(--t-verde)', fontFamily: FONT.mono, letterSpacing: '1px' }}
                      >
                        Why This Place
                      </div>
                      <div
                        className="p-4 rounded-2xl"
                        style={{ background: 'rgba(42,122,86,0.04)', border: '1px solid rgba(42,122,86,0.12)' }}
                      >
                        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--t-ink)', fontFamily: FONT.sans }}>
                          {place.terrazzoInsight.why}
                        </p>
                      </div>
                    </div>
                  </FadeInSection>
                )}

                {/* Caveat / heads-up */}
                {place.terrazzoInsight?.caveat && (
                  <FadeInSection delay={0.15} direction="up" distance={14}>
                    <div className="mb-6">
                      <div
                        className="text-[10px] font-bold uppercase tracking-wider mb-2.5"
                        style={{ color: 'var(--t-amber)', fontFamily: FONT.mono, letterSpacing: '1px' }}
                      >
                        Heads Up
                      </div>
                      <div
                        className="p-4 rounded-2xl"
                        style={{ background: 'rgba(160,108,40,0.04)', borderLeft: '3px solid var(--t-amber)' }}
                      >
                        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--t-ink)' }}>
                          {place.terrazzoInsight.caveat}
                        </p>
                      </div>
                    </div>
                  </FadeInSection>
                )}

                {/* Match Breakdown by domain — animated bars */}
                {place.matchBreakdown && (
                  <FadeInSection delay={0.15} direction="up" distance={16}>
                    <div className="mb-6">
                      <div
                        className="text-[10px] font-bold uppercase tracking-wider mb-3"
                        style={{ color: INK['95'], fontFamily: FONT.mono, letterSpacing: '1px' }}
                      >
                        Taste Match
                      </div>
                      <div className="flex flex-col gap-2.5">
                        {TASTE_DOMAINS.map((domain, i) => {
                          const score = place.matchBreakdown[domain] ?? 0;
                          if (score < 0.1) return null;
                          const color = DOMAIN_COLORS[domain];
                          const icon = DOMAIN_ICONS[domain];
                          return (
                            <div key={domain} className="flex items-center gap-2.5">
                              <div style={{ width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <PerriandIcon name={icon} size={13} color={color} />
                              </div>
                              <span className="text-[10px] w-16 font-medium" style={{ color: INK['80'], fontFamily: FONT.mono }}>
                                {domain}
                              </span>
                              <div className="flex-1">
                                <AnimatedBar
                                  percentage={score * 100}
                                  color={color}
                                  height={6}
                                  delay={i * 0.08}
                                  borderRadius={3}
                                />
                              </div>
                              <span className="text-[9px] w-8 text-right font-semibold" style={{ color: INK['80'], fontFamily: FONT.mono }}>
                                <AnimatedNumber value={Math.round(score * 100)} />
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </FadeInSection>
                )}

                {/* What to order */}
                {place.whatToOrder && place.whatToOrder.length > 0 && (
                  <FadeInSection delay={0.1} direction="up" distance={16}>
                    <div className="mb-6">
                      <div
                        className="text-[10px] font-bold uppercase tracking-wider mb-2.5"
                        style={{ color: INK['95'], fontFamily: FONT.mono, letterSpacing: '1px' }}
                      >
                        What to Order
                      </div>
                      <div className="flex flex-col gap-1.5" style={{ padding: '12px 14px', background: 'white', borderRadius: 16, border: '1px solid var(--t-linen)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                        {place.whatToOrder.map((item, i) => (
                          <div key={i} className="text-[12px]" style={{ color: 'var(--t-ink)', fontFamily: FONT.sans }}>
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </FadeInSection>
                )}

                {/* Tips */}
                {place.tips && place.tips.length > 0 && (
                  <FadeInSection delay={0.1} direction="up" distance={16}>
                    <div className="mb-6">
                      <div
                        className="text-[10px] font-bold uppercase tracking-wider mb-2.5"
                        style={{ color: INK['95'], fontFamily: FONT.mono, letterSpacing: '1px' }}
                      >
                        Tips
                      </div>
                      <div className="flex flex-col gap-1.5" style={{ padding: '12px 14px', background: 'white', borderRadius: 16, border: '1px solid var(--t-linen)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                        {place.tips.map((tip, i) => (
                          <div key={i} className="text-[12px]" style={{ color: 'var(--t-ink)', fontFamily: FONT.sans }}>
                            {tip}
                          </div>
                        ))}
                      </div>
                    </div>
                  </FadeInSection>
                )}

                {/* Enrichment facts */}
                {place.enrichment && (
                  <FadeInSection delay={0.1} direction="up" distance={16}>
                    <div className="mb-6">
                      <div
                        className="text-[10px] font-bold uppercase tracking-wider mb-2.5"
                        style={{ color: INK['95'], fontFamily: FONT.mono, letterSpacing: '1px' }}
                      >
                        Details
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 rounded-2xl" style={{ background: 'white', border: '1px solid var(--t-linen)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                        {place.enrichment.priceRange && (
                          <div>
                            <div className="text-[9px] uppercase tracking-wider" style={{ color: INK['70'], fontFamily: FONT.mono }}>Price Range</div>
                            <div className="text-[12px] mt-0.5 font-medium" style={{ color: 'var(--t-ink)' }}>{place.enrichment.priceRange}</div>
                          </div>
                        )}
                        {place.enrichment.hours && (
                          <div>
                            <div className="text-[9px] uppercase tracking-wider" style={{ color: INK['70'], fontFamily: FONT.mono }}>Hours</div>
                            <div className="text-[12px] mt-0.5 font-medium" style={{ color: 'var(--t-ink)' }}>{place.enrichment.hours}</div>
                          </div>
                        )}
                        {place.enrichment.closedDays && place.enrichment.closedDays.length > 0 && (
                          <div>
                            <div className="text-[9px] uppercase tracking-wider" style={{ color: INK['70'], fontFamily: FONT.mono }}>Closed</div>
                            <div className="text-[12px] mt-0.5 font-medium" style={{ color: 'var(--t-ink)' }}>{place.enrichment.closedDays.join(', ')}</div>
                          </div>
                        )}
                        {place.enrichment.seasonalNote && (
                          <div>
                            <div className="text-[9px] uppercase tracking-wider" style={{ color: INK['70'], fontFamily: FONT.mono }}>Note</div>
                            <div className="text-[12px] mt-0.5 font-medium" style={{ color: 'var(--t-ink)' }}>{place.enrichment.seasonalNote}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </FadeInSection>
                )}

                {/* Taste note */}
                {place.tasteNote && (
                  <FadeInSection delay={0.1} direction="up" distance={14}>
                    <div className="mb-6">
                      <div
                        className="text-[10px] font-bold uppercase tracking-wider mb-2.5"
                        style={{ color: INK['95'], fontFamily: FONT.mono, letterSpacing: '1px' }}
                      >
                        Taste Note
                      </div>
                      <div
                        className="p-4 rounded-2xl text-[12px] leading-relaxed italic"
                        style={{ background: 'white', border: '1px solid var(--t-linen)', color: INK['80'], fontFamily: FONT.serif, boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}
                      >
                        {place.tasteNote}
                      </div>
                    </div>
                  </FadeInSection>
                )}

                {/* Friend attribution */}
                {place.friendAttribution && (
                  <FadeInSection delay={0.1} direction="up" distance={14}>
                    <div className="mb-6">
                      <div
                        className="text-[10px] font-bold uppercase tracking-wider mb-2.5"
                        style={{ color: INK['95'], fontFamily: FONT.mono, letterSpacing: '1px' }}
                      >
                        Recommended By
                      </div>
                      <div
                        className="p-4 rounded-2xl flex items-start gap-3"
                        style={{ background: 'white', border: '1px solid var(--t-linen)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
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
                  </FadeInSection>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 mt-2" style={{ borderTop: '1px solid var(--t-linen)' }}>
                  <span className="text-[9px]" style={{ color: INK['70'], fontFamily: FONT.mono }}>
                    Local briefing
                  </span>
                </div>
              </>
            )}

            {data && (
              <>
                {/* Summary bar — mosaic + animated stats */}
                <SafeFadeIn direction="up" distance={14} duration={0.5}>
                  <div className="flex gap-2.5 mb-5">
                    <div className="flex items-center justify-center p-3 rounded-2xl" style={{ background: INK['03'] }}>
                      <TerrazzoMosaic profile={numericProfile} size="xs" />
                    </div>
                    {matchScore != null && (
                      <div className="flex-1 p-3 rounded-2xl text-center" style={{ background: 'linear-gradient(135deg, rgba(200,146,58,0.08), rgba(200,146,58,0.03))' }}>
                        <div className="text-[20px] font-bold" style={{ color: '#8a6a2a', fontFamily: FONT.mono }}>
                          <AnimatedNumber value={matchScore} suffix="%" />
                        </div>
                        <div className="text-[9px] mt-0.5" style={{ color: INK['70'] }}>Match</div>
                      </div>
                    )}
                    <div className="flex-1 p-3 rounded-2xl text-center" style={{ background: 'rgba(42,122,86,0.04)' }}>
                      <div
                        className="text-[20px] font-bold"
                        style={{
                          color: data.reliabilityScore && data.reliabilityScore >= 0.6 ? 'var(--t-verde)' : 'var(--t-amber)',
                          fontFamily: FONT.mono,
                        }}
                      >
                        {data.reliabilityScore != null ? (
                          <AnimatedNumber value={Math.round(data.reliabilityScore * 100)} />
                        ) : '—'}
                      </div>
                      <div className="text-[9px] mt-0.5" style={{ color: INK['70'] }}>Reliability</div>
                    </div>
                    <div className="flex-1 p-3 rounded-2xl text-center" style={{ background: INK['03'] }}>
                      <div className="text-[20px] font-bold" style={{ color: 'var(--t-ink)', fontFamily: FONT.mono }}>
                        <AnimatedNumber value={data.reviewCount} />
                      </div>
                      <div className="text-[9px] mt-0.5" style={{ color: INK['70'] }}>Reviews</div>
                    </div>
                  </div>
                </SafeFadeIn>

                {/* Pipeline progress — shown while running */}
                {isRunning && data.latestRun && (
                  <SafeFadeIn direction="up" distance={10} duration={0.4}>
                    <div className="mb-5">
                      <PipelineProgress
                        currentStage={data.latestRun.currentStage}
                        stagesCompleted={data.latestRun.stagesCompleted}
                        startedAt={data.latestRun.startedAt}
                      />
                    </div>
                  </SafeFadeIn>
                )}

                {/* Failed state */}
                {data.status === 'failed' && (
                  <SafeFadeIn direction="up" distance={10} duration={0.4}>
                    <div
                      className="p-4 rounded-2xl mb-5"
                      style={{ background: 'rgba(214,48,32,0.06)', border: '1px solid rgba(214,48,32,0.15)' }}
                    >
                      <div
                        className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
                        style={{ color: 'var(--t-signal-red)', fontFamily: FONT.mono }}
                      >
                        Briefing incomplete
                      </div>
                      <p className="text-[11px]" style={{ color: 'var(--t-ink)' }}>
                        We couldn&apos;t finish researching this place. Partial notes may be shown below.
                      </p>
                    </div>
                  </SafeFadeIn>
                )}

                {/* Signals by dimension — staggered reveal */}
                {TASTE_DOMAINS.map((domain, domainIdx) => {
                  const signals = signalsByDomain[domain];
                  if (!signals || signals.length === 0) return null;
                  const color = DOMAIN_COLORS[domain];
                  const icon = DOMAIN_ICONS[domain];
                  return (
                    <FadeInSection key={domain} delay={domainIdx * 0.06} direction="up" distance={16}>
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-2.5">
                          <div
                            className="w-6 h-6 rounded-lg flex items-center justify-center"
                            style={{ background: `${color}12` }}
                          >
                            <PerriandIcon name={icon} size={14} color={color} />
                          </div>
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider"
                            style={{ color, fontFamily: FONT.mono, letterSpacing: '1px' }}
                          >
                            {domain}
                          </span>
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded-full ml-1 font-semibold"
                            style={{ background: `${color}12`, color, fontFamily: FONT.mono }}
                          >
                            {signals.length}
                          </span>
                        </div>
                        <StaggerContainer staggerDelay={0.06}>
                          {signals
                            .sort((a, b) => b.confidence - a.confidence)
                            .map((sig, i) => (
                              <StaggerItem key={i}>
                                <SignalCard signal={sig} domain={domain} />
                              </StaggerItem>
                            ))}
                        </StaggerContainer>
                      </div>
                    </FadeInSection>
                  );
                })}

                {/* Anti-signals */}
                {data.antiSignals && data.antiSignals.length > 0 && (
                  <FadeInSection delay={0.1} direction="up" distance={16}>
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-2.5">
                        <div
                          className="w-6 h-6 rounded-lg flex items-center justify-center"
                          style={{ background: 'rgba(160,108,40,0.10)' }}
                        >
                          <PerriandIcon name="sparkle" size={14} color="var(--t-amber)" />
                        </div>
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: 'var(--t-amber)', fontFamily: FONT.mono, letterSpacing: '1px' }}
                        >
                          Heads Up
                        </span>
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-full ml-1 font-semibold"
                          style={{ background: 'rgba(160,108,40,0.1)', color: 'var(--t-amber)', fontFamily: FONT.mono }}
                        >
                          {data.antiSignals.length}
                        </span>
                      </div>
                      <StaggerContainer staggerDelay={0.06}>
                        {data.antiSignals
                          .sort((a, b) => b.confidence - a.confidence)
                          .map((sig, i) => (
                            <StaggerItem key={i}>
                              <AntiSignalCard signal={sig} />
                            </StaggerItem>
                          ))}
                      </StaggerContainer>
                    </div>
                  </FadeInSection>
                )}

                {/* Facts */}
                {data.facts && Object.keys(data.facts).length > 0 && (
                  <FadeInSection delay={0.1} direction="up" distance={16}>
                    <div className="mb-6">
                      <div
                        className="text-[10px] font-bold uppercase tracking-wider mb-2.5"
                        style={{ color: INK['95'], fontFamily: FONT.mono, letterSpacing: '1px' }}
                      >
                        Facts
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 rounded-2xl" style={{ background: 'white', border: '1px solid var(--t-linen)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
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
                                style={{ color: INK['70'], fontFamily: FONT.mono }}
                              >
                                {displayKey}
                              </div>
                              <div className="text-[12px] mt-0.5 font-medium" style={{ color: 'var(--t-ink)' }}>
                                {String(value)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </FadeInSection>
                )}

                {/* Footer — enrichment meta */}
                <SafeFadeIn direction="up" distance={8} duration={0.4} delay={0.2}>
                  <div className="flex items-center justify-between pt-4 mt-2" style={{ borderTop: '1px solid var(--t-linen)' }}>
                    {enrichedAgo && (
                      <span className="text-[9px]" style={{ color: INK['70'], fontFamily: FONT.mono }}>
                        Last updated {enrichedAgo}
                      </span>
                    )}
                    <span className="text-[9px]" style={{ color: INK['70'], fontFamily: FONT.mono }}>
                      {data.pipelineVersion}
                    </span>
                  </div>
                </SafeFadeIn>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
