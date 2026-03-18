'use client';

import { useMemo } from 'react';
import { useBriefing } from '@/hooks/useBriefing';
import { PerriandIcon, type PerriandIconName } from '@/components/icons/PerriandIcons';
import { TerrazzoMosaic } from '@/components/profile/TerrazzoMosaic';
import { DEFAULT_USER_PROFILE } from '@/lib/taste';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { formatDomain } from '@/constants/profile';
import type { TasteProfile as NumericProfile } from '@/types';
import PipelineProgress from '@/components/place/PipelineProgress';
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
import { FONT, INK, TEXT } from '@/constants/theme';
import { ClusterInsightCard } from '@/components/place/ClusterInsightCard';
import { HeritageCard } from '@/components/intelligence/HeritageCard';
import { SeasonalityBadge } from '@/components/intelligence/SeasonalityBadge';
import { ValueBadge } from '@/components/intelligence/ValueBadge';
import type { HeritageData, SeasonalityData } from '@/types';
import {
  TrustBadge,
  SourceProvenanceStrip,
  ConfidenceSpectrum,
  HeadlineSignal,
  CompactSignal,
  InlineAntiSignal,
  getFactIconName,
} from './cards';

interface BriefingViewProps {
  googlePlaceId: string;
  placeName: string;
  matchScore?: number;
  place?: ImportedPlace;
  onClose: () => void;
}

const TASTE_DOMAINS: TasteDomain[] = ['Design', 'Atmosphere', 'Character', 'Service', 'FoodDrink', 'Geography'];

// ─── Main Component ───

export default function BriefingView({ googlePlaceId, placeName, matchScore, place, onClose }: BriefingViewProps) {
  const { data, loading, error } = useBriefing(googlePlaceId);

  // Build real numeric profile from store for mosaic thumbnail
  const generatedProfile = useOnboardingStore(s => s.generatedProfile);
  const numericProfile: NumericProfile = useMemo(() => {
    const gp = generatedProfile as unknown as { radarData?: { axis: string; value: number }[] } | null;
    if (!gp?.radarData?.length) return DEFAULT_USER_PROFILE;
    const result: NumericProfile = { ...DEFAULT_USER_PROFILE };
    for (const r of gp.radarData) {
      if (r.axis in result) {
        result[r.axis as keyof NumericProfile] = Math.max(result[r.axis as keyof NumericProfile], r.value);
      }
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

  // Group anti-signals by domain for inline display
  const antiSignalsByDomain = useMemo(() => {
    if (!data?.antiSignals || !Array.isArray(data.antiSignals)) return {} as Record<string, BriefingAntiSignal[]>;
    const grouped: Record<string, BriefingAntiSignal[]> = {};
    data.antiSignals.forEach(sig => {
      const domain = DIMENSION_TO_DOMAIN[sig.dimension] || sig.dimension;
      if (!grouped[domain]) grouped[domain] = [];
      grouped[domain].push(sig);
    });
    return grouped;
  }, [data?.antiSignals]);

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

      {/* Full-screen panel — desktop-aware layout */}
      <div
        className="fixed inset-0 z-[55] overflow-y-auto"
        style={{ background: 'var(--t-cream)' }}
      >
        {/* Desktop: two-column layout. Mobile: single column */}
        <div className="mx-auto" style={{ maxWidth: 880 }}>
          {/* Header — immersive with gradient backdrop */}
          <div
            className="sticky top-0 z-10 px-5 md:px-8 pt-5 pb-4"
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
                  Back to summary
                </button>
                <h1
                  className="text-[22px] md:text-[26px] leading-tight italic"
                  style={{ fontFamily: FONT.serif, color: 'var(--t-ink)' }}
                >
                  {placeName}
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-[10px]" style={{ color: TEXT.primary, fontFamily: FONT.mono }}>
                    Terrazzo Intelligence Briefing
                  </p>
                  {/* Trust badge in header */}
                  {data && (
                    <TrustBadge score={data.reliabilityScore} reviewCount={data.reviewCount} />
                  )}
                </div>
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

          <div className="px-5 md:px-8 pb-8">
            {/* Loading state */}
            {loading && !data && (
              <div className="text-center py-12">
                <div className="text-2xl mb-3 flex justify-center">
                  <PerriandIcon name="discover" size={36} color="var(--t-honey)" />
                </div>
                <p className="text-[12px]" style={{ color: TEXT.secondary }}>Preparing your briefing...</p>
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
                <p className="text-[12px] mb-1" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>
                  No briefing data available yet
                </p>
                <p className="text-[10px]" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
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
                      <div className="flex-1 p-3 rounded-2xl text-center" style={{ background: 'linear-gradient(135deg, rgba(238,113,109,0.08), rgba(238,113,109,0.03))' }}>
                        <div className="text-[20px] font-bold" style={{ color: '#8a6a2a', fontFamily: FONT.mono }}>
                          <AnimatedNumber value={matchScore} suffix="%" />
                        </div>
                        <div className="text-[9px] mt-0.5" style={{ color: TEXT.primary }}>Match</div>
                      </div>
                    )}
                    {place.google?.rating && (
                      <div className="flex-1 p-3 rounded-2xl text-center" style={{ background: INK['03'] }}>
                        <div className="text-[20px] font-bold" style={{ color: TEXT.primary, fontFamily: FONT.mono }}>
                          {place.google.rating}
                        </div>
                        <div className="text-[9px] mt-0.5" style={{ color: TEXT.secondary }}>Google</div>
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
                        style={{ color: 'var(--t-dark-teal)', fontFamily: FONT.mono, letterSpacing: '1px' }}
                      >
                        Why This Place
                      </div>
                      <div
                        className="p-4 rounded-2xl"
                        style={{ background: 'rgba(58,128,136,0.04)', border: '1px solid rgba(58,128,136,0.12)' }}
                      >
                        <p className="text-[13px] leading-relaxed" style={{ color: TEXT.primary, fontFamily: FONT.sans }}>
                          {place.terrazzoInsight.why}
                        </p>
                      </div>
                    </div>
                  </FadeInSection>
                )}

                {/* Caveat */}
                {place.terrazzoInsight?.caveat && (
                  <FadeInSection delay={0.15} direction="up" distance={14}>
                    <div className="mb-6">
                      <div
                        className="p-4 rounded-2xl flex items-start gap-2.5"
                        style={{ background: 'rgba(160,108,40,0.04)', borderLeft: '3px solid var(--t-amber)' }}
                      >
                        <PerriandIcon name="alert" size={14} color={TEXT.secondary} />
                        <p className="text-[12px] leading-relaxed" style={{ color: TEXT.primary }}>
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
                        style={{ color: TEXT.primary, fontFamily: FONT.mono, letterSpacing: '1px' }}
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
                              <span className="text-[10px] w-16 font-medium" style={{ color: TEXT.primary, fontFamily: FONT.mono }}>
                                {formatDomain(domain)}
                              </span>
                              <div className="flex-1">
                                <AnimatedBar percentage={score * 100} color={color} height={6} delay={i * 0.08} borderRadius={3} />
                              </div>
                              <span className="text-[9px] w-8 text-right font-semibold" style={{ color: TEXT.primary, fontFamily: FONT.mono }}>
                                <AnimatedNumber value={Math.round(score * 100)} />
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </FadeInSection>
                )}

                {/* Why This Matches — cluster explanation */}
                {place.matchExplanation && place.matchExplanation.topClusters?.length > 0 && (
                  <FadeInSection delay={0.2} direction="up" distance={14}>
                    <div className="mb-6">
                      <div
                        className="text-[10px] font-bold uppercase tracking-wider mb-2.5"
                        style={{ color: TEXT.secondary, fontFamily: FONT.mono, letterSpacing: '1px' }}
                      >
                        Why This Matches
                      </div>
                      <div className="flex flex-col gap-2">
                        {place.matchExplanation.topClusters.slice(0, 3).map((cluster, i) => (
                          <ClusterInsightCard
                            key={i}
                            label={cluster.label}
                            domain={cluster.domain}
                            score={cluster.score}
                            signals={cluster.signals}
                            index={i}
                          />
                        ))}
                      </div>
                      {place.matchExplanation.narrative && (
                        <p className="text-[11px] mt-2.5 leading-relaxed" style={{ color: TEXT.secondary }}>
                          {place.matchExplanation.narrative}
                        </p>
                      )}
                    </div>
                  </FadeInSection>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 mt-2" style={{ borderTop: '1px solid var(--t-linen)' }}>
                  <span className="text-[9px]" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
                    Local briefing · limited data
                  </span>
                </div>
              </>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* FULL INTELLIGENCE BRIEFING (from API data)     */}
            {/* ═══════════════════════════════════════════════ */}
            {data && (
              <>
                {/* Summary row — mosaic + score arc + stats */}
                <SafeFadeIn direction="up" distance={14} duration={0.5}>
                  <div className="flex gap-3 mb-6 flex-wrap md:flex-nowrap">
                    {/* Score arc */}
                    {matchScore != null && (
                      <div className="flex items-center gap-3 p-4 rounded-2xl flex-shrink-0" style={{ background: 'linear-gradient(135deg, rgba(238,113,109,0.08), rgba(238,113,109,0.03))', border: '1px solid rgba(238,113,109,0.12)' }}>
                        <AnimatedScoreArc score={matchScore} size={52} color="#8a6a2a" />
                        <div>
                          <div className="text-[18px] font-bold" style={{ color: '#8a6a2a', fontFamily: FONT.mono }}>
                            <AnimatedNumber value={matchScore} suffix="%" />
                          </div>
                          <div className="text-[9px]" style={{ color: TEXT.secondary }}>Taste Match</div>
                        </div>
                      </div>
                    )}
                    {/* Mosaic */}
                    <div className="flex items-center justify-center p-3 rounded-2xl" style={{ background: INK['03'] }}>
                      <TerrazzoMosaic profile={numericProfile} size="xs" />
                    </div>
                    {/* Stat cards */}
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(58,128,136,0.04)' }}>
                        <div
                          className="text-[18px] font-bold"
                          style={{
                            color: data.reliabilityScore && data.reliabilityScore >= 0.6 ? 'var(--t-dark-teal)' : 'var(--t-amber)',
                            fontFamily: FONT.mono,
                          }}
                        >
                          {data.reliabilityScore != null ? (
                            <AnimatedNumber value={Math.round(data.reliabilityScore * 100)} />
                          ) : '—'}
                        </div>
                        <div className="text-[9px]" style={{ color: TEXT.secondary }}>Reliability</div>
                      </div>
                      <div className="p-3 rounded-xl text-center" style={{ background: INK['03'] }}>
                        <div className="text-[18px] font-bold" style={{ color: TEXT.primary, fontFamily: FONT.mono }}>
                          <AnimatedNumber value={data.reviewCount} />
                        </div>
                        <div className="text-[9px]" style={{ color: TEXT.secondary }}>Reviews</div>
                      </div>
                      <div className="p-3 rounded-xl text-center" style={{ background: INK['03'] }}>
                        <div className="text-[18px] font-bold" style={{ color: TEXT.primary, fontFamily: FONT.mono }}>
                          <AnimatedNumber value={data.signalCount} />
                        </div>
                        <div className="text-[9px]" style={{ color: TEXT.secondary }}>Signals</div>
                      </div>
                      <div className="p-3 rounded-xl text-center" style={{ background: data.antiSignalCount > 0 ? 'rgba(160,108,40,0.04)' : INK['03'] }}>
                        <div className="text-[18px] font-bold" style={{ color: data.antiSignalCount > 0 ? 'var(--t-amber)' : TEXT.secondary, fontFamily: FONT.mono }}>
                          <AnimatedNumber value={data.antiSignalCount} />
                        </div>
                        <div className="text-[9px]" style={{ color: TEXT.secondary }}>Caveats</div>
                      </div>
                    </div>
                  </div>
                </SafeFadeIn>

                {/* Value badge — price-match framing */}
                {(() => {
                  const googleData = data.googleData as Record<string, unknown>;
                  const priceLevel = (googleData?.priceLevel ?? googleData?.price_level) as number | undefined;
                  if (priceLevel == null) return null;
                  return (
                    <SafeFadeIn direction="up" distance={10} duration={0.4} delay={0.05}>
                      <div className="mb-4">
                        <ValueBadge
                          matchScore={matchScore}
                          priceLevel={priceLevel}
                          variant="full"
                          layout="desktop"
                        />
                      </div>
                    </SafeFadeIn>
                  );
                })()}

                {/* Source provenance strip */}
                {data.signals && Array.isArray(data.signals) && data.signals.length > 0 && (
                  <SafeFadeIn direction="up" distance={10} duration={0.4} delay={0.05}>
                    <div className="mb-6">
                      <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: TEXT.secondary, fontFamily: FONT.mono, letterSpacing: '1px' }}>
                        Intelligence Sources
                      </div>
                      <SourceProvenanceStrip signals={data.signals} />
                    </div>
                  </SafeFadeIn>
                )}

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
                      <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--t-signal-red)', fontFamily: FONT.mono }}>
                        Briefing incomplete
                      </div>
                      <p className="text-[11px]" style={{ color: 'var(--t-ink)' }}>
                        We couldn&apos;t finish researching this place. Partial notes may be shown below.
                      </p>
                    </div>
                  </SafeFadeIn>
                )}

                {/* ─── Domain sections with signal hierarchy ─── */}
                {/* Desktop: 2-column grid. Mobile: single column */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  {TASTE_DOMAINS.map((domain, domainIdx) => {
                    const signals = signalsByDomain[domain];
                    if (!signals || signals.length === 0) return null;
                    const color = DOMAIN_COLORS[domain];
                    const icon = DOMAIN_ICONS[domain];
                    const sorted = [...signals].sort((a, b) => b.confidence - a.confidence);
                    const headline = sorted[0]; // highest confidence = headline
                    const rest = sorted.slice(1);
                    const domainAntiSignals = antiSignalsByDomain[domain] || [];

                    return (
                      <FadeInSection key={domain} delay={domainIdx * 0.06} direction="up" distance={16}>
                        <div className="mb-6">
                          {/* Domain header */}
                          <div className="flex items-center gap-2 mb-2">
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
                              {formatDomain(domain)}
                            </span>
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                              style={{ background: `${color}12`, color, fontFamily: FONT.mono }}
                            >
                              {signals.length}
                            </span>
                          </div>

                          {/* Confidence spectrum — visual signal distribution */}
                          <div className="mb-3 px-1">
                            <ConfidenceSpectrum signals={signals} color={color} />
                          </div>

                          {/* Headline signal — big callout */}
                          <HeadlineSignal signal={headline} color={color} />

                          {/* Remaining signals — compact list */}
                          {rest.length > 0 && (
                            <div className="ml-1 border-l-2 pl-3 mb-1" style={{ borderColor: `${color}15` }}>
                              {rest.map((sig, i) => (
                                <CompactSignal key={i} signal={sig} />
                              ))}
                            </div>
                          )}

                          {/* Inline anti-signals for this domain */}
                          {domainAntiSignals.length > 0 && (
                            <div className="mt-2">
                              {domainAntiSignals.map((sig, i) => (
                                <InlineAntiSignal key={i} signal={sig} />
                              ))}
                            </div>
                          )}
                        </div>
                      </FadeInSection>
                    );
                  })}
                </div>

                {/* Orphan anti-signals — those not mapped to a rendered domain */}
                {(() => {
                  const renderedDomains = new Set(TASTE_DOMAINS.filter(d => signalsByDomain[d]?.length));
                  const orphanAntiSignals = (data.antiSignals || []).filter(sig => {
                    const domain = DIMENSION_TO_DOMAIN[sig.dimension] || sig.dimension;
                    return !renderedDomains.has(domain as TasteDomain);
                  });
                  if (orphanAntiSignals.length === 0) return null;
                  return (
                    <FadeInSection delay={0.1} direction="up" distance={16}>
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-2.5">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(160,108,40,0.10)' }}>
                            <PerriandIcon name="sparkle" size={14} color="var(--t-amber)" />
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--t-amber)', fontFamily: FONT.mono, letterSpacing: '1px' }}>
                            Other Caveats
                          </span>
                        </div>
                        {orphanAntiSignals.map((sig, i) => (
                          <InlineAntiSignal key={i} signal={sig} />
                        ))}
                      </div>
                    </FadeInSection>
                  );
                })()}

                {/* Heritage — dedicated card for architectural/historical significance */}
                {data.heritage && (
                  <FadeInSection delay={0.1} direction="up" distance={16}>
                    <div className="mb-6">
                      <HeritageCard
                        heritage={data.heritage as HeritageData}
                        variant="full"
                        layout="desktop"
                      />
                    </div>
                  </FadeInSection>
                )}

                {/* Seasonality — when to visit, crowd patterns, rhythm */}
                {data.seasonality && (
                  <FadeInSection delay={0.1} direction="up" distance={16}>
                    <div className="mb-6">
                      <SeasonalityBadge
                        seasonality={data.seasonality as SeasonalityData}
                        rhythmTempo={undefined /* TODO(deferred): pass from SavedPlace when rhythmTempo is added to schema */}
                        seasonalNote={typeof data.facts === 'object' && data.facts ? (data.facts as Record<string, unknown>).seasonalNote as string | undefined : undefined}
                        variant="full"
                        layout="desktop"
                      />
                    </div>
                  </FadeInSection>
                )}

                {/* Facts — structured detail grid */}
                {data.facts && Object.keys(data.facts).length > 0 && (
                  <FadeInSection delay={0.1} direction="up" distance={16}>
                    <div className="mb-6">
                      <div
                        className="text-[10px] font-bold uppercase tracking-wider mb-2.5"
                        style={{ color: TEXT.primary, fontFamily: FONT.mono, letterSpacing: '1px' }}
                      >
                        Place Dossier
                      </div>
                      <div
                        className="rounded-2xl overflow-hidden"
                        style={{ background: 'white', border: '1px solid var(--t-linen)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}
                      >
                        {Object.entries(data.facts).map(([key, value], i, arr) => {
                          if (value == null || value === '') return null;
                          const displayKey = key
                            .replace(/([A-Z])/g, ' $1')
                            .replace(/^./, s => s.toUpperCase())
                            .trim();
                          return (
                            <div
                              key={key}
                              className="flex items-start gap-3 px-4 py-2.5"
                              style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--t-linen)' : 'none' }}
                            >
                              <span className="flex-shrink-0 w-5 flex justify-center mt-0.5"><PerriandIcon name={getFactIconName(key) as PerriandIconName} size={12} color={TEXT.secondary} /></span>
                              <div className="flex-1 min-w-0">
                                <div className="text-[9px] uppercase tracking-wider" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>{displayKey}</div>
                                <div className="text-[12px] font-medium mt-0.5" style={{ color: TEXT.primary }}>{String(value)}</div>
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
                      <span className="text-[9px]" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
                        Last updated {enrichedAgo}
                      </span>
                    )}
                    <span className="text-[9px]" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
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
