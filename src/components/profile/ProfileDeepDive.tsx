'use client';

import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';

import { useInView, isMobileSafari } from '@/hooks/useAnimations';
import { TASTE_PROFILE, WRAPPED, DIMENSION_COLORS, AXIS_COLORS, CONTEXT_ICONS, CONTEXT_COLORS } from '@/constants/profile';
import type { TasteProfile as ProfileShape } from '@/constants/profile';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { TerrazzoMosaic, MosaicLegend } from '@/components/TerrazzoMosaic';
import { useOnboardingStore } from '@/stores/onboardingStore';
import PlaceLink from '@/components/PlaceLink';
import { FONT, INK } from '@/constants/theme';
import type { TasteProfile as NumericProfile, GeneratedTasteProfile } from '@/types';
import {
  FadeInSection,
  StaggerContainer,
  StaggerItem,
  AnimatedBar,
  AnimatedSpectrum,
  AnimatedNumber,
  AnimatedScoreArc,
} from '@/components/animations/AnimatedElements';

export default function ProfileDeepDive() {
  const generatedProfile = useOnboardingStore(s => s.generatedProfile);
  const allSignals = useOnboardingStore(s => s.allSignals);
  const mosaicAxes = useOnboardingStore(s => s.mosaicAxes);
  const profile: ProfileShape = (generatedProfile as unknown as ProfileShape) || TASTE_PROFILE;
  const gp = generatedProfile as GeneratedTasteProfile | null;
  const signalCount = allSignals?.length || WRAPPED.totalSignals;

  const numericProfile: NumericProfile = useMemo(() => {
    const radarMap: Record<string, string> = {
      Sensory: 'Design', Material: 'Design',
      Authenticity: 'Character', Social: 'Service',
      Cultural: 'Location', Spatial: 'Wellness',
    };
    const result: NumericProfile = { Design: 0.5, Character: 0.5, Service: 0.5, Food: 0.5, Location: 0.5, Wellness: 0.5 };
    for (const r of profile.radarData || []) {
      const domain = radarMap[r.axis];
      if (domain && domain in result) {
        result[domain as keyof NumericProfile] = Math.max(result[domain as keyof NumericProfile], r.value);
      }
    }
    return result;
  }, [profile]);

  return (
    <div>
      <IdentitySection profile={profile} signalCount={signalCount} numericProfile={numericProfile} />
      <TasteDNASection profile={profile} mosaicAxes={mosaicAxes} />
      <DesignLanguageSection profile={profile} gp={gp} mosaicAxes={mosaicAxes} />
      <ContradictionsSection profile={profile} />
      <PerfectDaySection gp={gp} />
      <ContextShiftsSection profile={profile} gp={gp} />
      <TasteNeighborsSection gp={gp} />
      <DimensionsSection profile={profile} />
      <VocabularySection profile={profile} />
      <MatchesSection profile={profile} />
      <TasteRadarSection profile={profile} />
      <TravelStatsSection />
      <TravelTimelineSection />
      <TasteEvolutionSection profile={profile} />
      <BucketListSection />
    </div>
  );
}

// ═══════════════════════════════════════════
// IDENTITY — Who you are as a traveler
// ═══════════════════════════════════════════
function IdentitySection({ profile, signalCount, numericProfile }: { profile: ProfileShape; signalCount: number; numericProfile: NumericProfile }) {
  return (
    <div style={{ background: '#2d3a2d' }}>
      <div className="px-5 pt-8 pb-3">
        <FadeInSection delay={0.1}>
          <div className="text-[9px] uppercase tracking-[0.25em] mb-3" style={{ color: 'rgba(245,245,240,0.5)', fontFamily: FONT.mono }}>
            Your Taste Identity
          </div>
        </FadeInSection>

        <FadeInSection delay={0.2}>
          <h2 className="text-[28px] mb-3 leading-tight" style={{ fontFamily: FONT.serif, color: '#f5f5f0' }}>
            {profile.overallArchetype}
          </h2>
        </FadeInSection>

        <FadeInSection delay={0.35}>
          <p className="text-[13px] leading-relaxed mb-5" style={{ color: 'rgba(245,245,240,0.78)', fontFamily: FONT.sans }}>
            {profile.archetypeDescription}
          </p>
        </FadeInSection>

        {/* Emotional drivers */}
        <FadeInSection delay={0.45} direction="left">
          <div className="flex gap-2 mb-5">
            <div className="px-3 py-2 rounded-xl" style={{ background: 'rgba(245,245,240,0.08)' }}>
              <div className="text-[8px] uppercase tracking-wider mb-1" style={{ color: 'rgba(200,146,58,0.7)', fontFamily: FONT.mono }}>Primary driver</div>
              <div className="text-[12px] font-semibold" style={{ color: 'rgba(245,245,240,0.9)' }}>{profile.emotionalDriver.primary}</div>
            </div>
            <div className="px-3 py-2 rounded-xl" style={{ background: 'rgba(245,245,240,0.06)' }}>
              <div className="text-[8px] uppercase tracking-wider mb-1" style={{ color: 'rgba(245,245,240,0.45)', fontFamily: FONT.mono }}>Secondary</div>
              <div className="text-[12px]" style={{ color: 'rgba(245,245,240,0.75)' }}>{profile.emotionalDriver.secondary}</div>
            </div>
          </div>
        </FadeInSection>

        {/* Stats row — animated counters */}
        <FadeInSection delay={0.5}>
          <div className="flex gap-4 mb-2">
            {[
              { n: signalCount, label: 'Signals collected' },
              { n: profile.contradictions?.length || 3, label: 'Tensions found' },
              { n: Object.values(profile.microTasteSignals || {}).flat().length, label: 'Taste terms' },
              { n: profile.contextModifiers?.length || 6, label: 'Context modes' },
            ].map(({ n, label }) => (
              <div key={label} className="flex-1 text-center">
                <AnimatedNumber
                  value={n}
                  style={{ fontFamily: FONT.mono, fontSize: 18, fontWeight: 700, color: '#f5f5f0' }}
                />
                <div style={{ fontFamily: FONT.mono, fontSize: 8, color: 'rgba(245,245,240,0.55)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
              </div>
            ))}
          </div>
        </FadeInSection>
      </div>

      {/* Mosaic — scale in */}
      <FadeInSection delay={0.6} direction="none">
        <div className="flex flex-col items-center px-5 pt-4 pb-8 gap-4">
          <div style={{ fontFamily: FONT.mono, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'rgba(245,240,230,0.55)' }}>
            Your Terrazzo Mosaic
          </div>
          {isMobileSafari() ? (
            <div className="flex items-center gap-6">
              <TerrazzoMosaic profile={numericProfile} size="lg" />
              <MosaicLegend profile={numericProfile} dark style={{ gridTemplateColumns: 'repeat(2, auto)', gap: '6px 14px' }} />
            </div>
          ) : (
            <motion.div
              className="flex items-center gap-6"
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              viewport={{ once: true }}
            >
              <TerrazzoMosaic profile={numericProfile} size="lg" />
              <MosaicLegend profile={numericProfile} dark style={{ gridTemplateColumns: 'repeat(2, auto)', gap: '6px 14px' }} />
            </motion.div>
          )}
        </div>
      </FadeInSection>
    </div>
  );
}

// ═══════════════════════════════════════════
// TASTE DNA — Radar axes as spectrum bars
// ═══════════════════════════════════════════
function TasteDNASection({ profile, mosaicAxes }: { profile: ProfileShape; mosaicAxes: Record<string, number> }) {
  const axes = profile.radarData || [];
  return (
    <div className="px-5 py-6" style={{ background: 'var(--t-cream)' }}>
      <FadeInSection>
        <div className="text-[9px] uppercase tracking-[0.25em] mb-1" style={{ color: 'var(--t-honey)', fontFamily: FONT.mono, fontWeight: 700 }}>
          Taste DNA
        </div>
        <p className="text-[11px] mb-5" style={{ color: INK['60'], fontFamily: FONT.sans }}>
          Six dimensions that define how you experience places.
        </p>
      </FadeInSection>

      <div className="flex flex-col gap-4">
        {axes.map(({ axis, value }, i) => {
          const color = AXIS_COLORS[axis] || '#8b6b4a';
          const pct = Math.round(value * 100);
          return (
            <FadeInSection key={axis} delay={i * 0.1} direction="left" distance={16}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] font-semibold" style={{ color: 'var(--t-ink)' }}>{axis}</span>
                <AnimatedNumber value={pct} suffix="%" style={{ color, fontFamily: FONT.mono, fontSize: 11, fontWeight: 700 }} />
              </div>
              <AnimatedBar percentage={pct} color={color} delay={i * 0.1} />
            </FadeInSection>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// DESIGN LANGUAGE — Spectrum axes from ELO + editorial
// ═══════════════════════════════════════════
function DesignLanguageSection({ profile, gp, mosaicAxes }: { profile: ProfileShape; gp: GeneratedTasteProfile | null; mosaicAxes: Record<string, number> }) {
  const insight = gp?.designInsight;
  const AXES_FALLBACK: { axis: string; label: [string, string]; note: string }[] = [
    { axis: 'volume', label: ['Minimal', 'Maximal'], note: 'You favor intentional density — not sparse, but curated' },
    { axis: 'temperature', label: ['Cool & Composed', 'Warm & Rich'], note: 'Drawn to warmth, but warmth earned through materials, not decoration' },
    { axis: 'time', label: ['Contemporary', 'Historic & Layered'], note: 'You like places that carry their history visibly' },
    { axis: 'formality', label: ['Raw & Natural', 'Polished & Sleek'], note: 'Raw textures over finished surfaces, always' },
    { axis: 'culture', label: ['International', 'Deeply Local'], note: 'You travel to feel how locals live, not to be a guest' },
    { axis: 'mood', label: ['Serene', 'Energetic'], note: 'Calm by default, but you switch on for food and drink' },
  ];
  const annotations = insight?.annotations || AXES_FALLBACK;

  return (
    <div className="px-5 py-6" style={{ background: 'var(--t-cream)' }}>
      <FadeInSection>
        <div className="text-[9px] uppercase tracking-[0.25em] mb-1" style={{ color: '#8b6b4a', fontFamily: FONT.mono, fontWeight: 700 }}>
          Design Language
        </div>
        {insight?.headline && (
          <h3 className="text-[16px] leading-snug mb-1" style={{ fontFamily: FONT.serif, color: 'var(--t-ink)' }}>
            {insight.headline}
          </h3>
        )}
        <p className="text-[11px] mb-5" style={{ color: INK['60'], fontFamily: FONT.sans }}>
          How your eye works — mapped across six design spectrums.
        </p>
      </FadeInSection>

      <div className="flex flex-col gap-4">
        {annotations.map((a, i) => {
          const eloValue = mosaicAxes[a.axis] ?? 0.5;
          const pct = Math.round(eloValue * 100);
          return (
            <FadeInSection key={a.axis} delay={i * 0.1}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px]" style={{ color: INK['60'], fontFamily: FONT.mono }}>{a.label[0]}</span>
                <span className="text-[10px]" style={{ color: INK['60'], fontFamily: FONT.mono }}>{a.label[1]}</span>
              </div>
              <AnimatedSpectrum percentage={pct} delay={i * 0.12} />
              <p className="text-[10px] mt-1.5 leading-relaxed" style={{ color: INK['70'], fontFamily: FONT.sans }}>
                {a.note}
              </p>
            </FadeInSection>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// CONTRADICTIONS — Deep dive with editorial
// ═══════════════════════════════════════════
function ContradictionsSection({ profile }: { profile: ProfileShape }) {
  return (
    <div className="px-5 py-6" style={{ background: 'var(--t-cream)' }}>
      <FadeInSection>
        <div className="text-[9px] uppercase tracking-[0.25em] mb-1" style={{ color: 'var(--t-panton-violet)', fontFamily: FONT.mono, fontWeight: 700 }}>
          Your Contradictions
        </div>
        <p className="text-[11px] mb-5" style={{ color: INK['60'], fontFamily: FONT.sans }}>
          The tensions that make your taste interesting — and matchable.
        </p>
      </FadeInSection>

      <StaggerContainer className="flex flex-col gap-4" staggerDelay={0.12}>
        {profile.contradictions.map((c, i) => (
          <StaggerItem key={i}>
            <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
              <div className="p-4">
                <div className="flex gap-3 mb-3">
                  <div className="flex-1">
                    <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: INK['50'], fontFamily: FONT.mono }}>You said</div>
                    <p className="text-[12px] italic leading-snug" style={{ color: 'var(--t-ink)' }}>&ldquo;{c.stated}&rdquo;</p>
                  </div>
                  <div className="flex items-center" style={{ color: INK['30'], fontFamily: FONT.serif, fontSize: 14 }}>×</div>
                  <div className="flex-1">
                    <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: INK['50'], fontFamily: FONT.mono }}>Behavior shows</div>
                    <p className="text-[12px] italic leading-snug" style={{ color: 'var(--t-ink)' }}>&ldquo;{c.revealed}&rdquo;</p>
                  </div>
                </div>
              </div>
              <div className="px-4 py-3" style={{ background: 'rgba(42,122,86,0.03)', borderTop: '1px solid var(--t-linen)' }}>
                <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: 'var(--t-verde)', fontFamily: FONT.mono }}>What this means for matching</div>
                <p className="text-[11px] leading-relaxed" style={{ color: INK['75'] }}>{c.resolution}</p>
              </div>
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </div>
  );
}

// ═══════════════════════════════════════════
// PERFECT DAY — Synthesized ideal travel day
// ═══════════════════════════════════════════
function PerfectDaySection({ gp }: { gp: GeneratedTasteProfile | null }) {
  const day = gp?.perfectDay;
  if (!day) return null;

  const segments = [
    { time: 'Morning', icon: 'morning' as const, text: day.morning, color: '#c8923a' },
    { time: 'Afternoon', icon: 'afternoon' as const, text: day.afternoon, color: '#e86830' },
    { time: 'Evening', icon: 'evening' as const, text: day.evening, color: '#6844a0' },
  ];

  return (
    <div className="px-5 py-6" style={{ background: '#f5f0e6' }}>
      <FadeInSection>
        <div className="text-[9px] uppercase tracking-[0.25em] mb-1" style={{ color: 'var(--t-honey)', fontFamily: FONT.mono, fontWeight: 700 }}>
          Your Perfect Day
        </div>
        <p className="text-[11px] mb-5" style={{ color: INK['60'], fontFamily: FONT.sans }}>
          We synthesized your ideal travel day from everything you told us.
        </p>
      </FadeInSection>

      <div className="flex flex-col gap-0">
        {segments.map((seg, i) => (
          <FadeInSection key={seg.time} delay={i * 0.2} direction="left" distance={20}>
            <div className="flex gap-3">
              <div className="flex flex-col items-center" style={{ width: 24 }}>
                {isMobileSafari() ? (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: `${seg.color}15` }}
                  >
                    <PerriandIcon name={seg.icon} size={12} color={seg.color} />
                  </div>
                ) : (
                  <motion.div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: `${seg.color}15` }}
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    transition={{ duration: 0.4, delay: i * 0.2, type: 'spring', stiffness: 300 }}
                    viewport={{ once: true }}
                  >
                    <PerriandIcon name={seg.icon} size={12} color={seg.color} />
                  </motion.div>
                )}
                {i < segments.length - 1 && <div className="w-[1px] flex-1 my-1" style={{ background: INK['10'] }} />}
              </div>
              <div className="flex-1 pb-5">
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: seg.color, fontFamily: FONT.mono }}>{seg.time}</div>
                <p className="text-[12px] leading-relaxed" style={{ color: INK['80'], fontFamily: FONT.sans }}>{seg.text}</p>
              </div>
            </div>
          </FadeInSection>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// CONTEXT SHIFTS — How taste changes by companion/season
// ═══════════════════════════════════════════
function ContextShiftsSection({ profile, gp }: { profile: ProfileShape; gp: GeneratedTasteProfile | null }) {
  const shifts = gp?.howYouShift;
  return (
    <div className="px-5 py-6" style={{ background: 'var(--t-cream)' }}>
      <FadeInSection>
        <div className="text-[9px] uppercase tracking-[0.25em] mb-1" style={{ color: '#4a6b8b', fontFamily: FONT.mono, fontWeight: 700 }}>
          How Your Taste Shifts
        </div>
        <p className="text-[11px] mb-5" style={{ color: INK['60'], fontFamily: FONT.sans }}>
          You&apos;re not one traveler — you&apos;re several. Here&apos;s how context changes everything.
        </p>
      </FadeInSection>

      {shifts && shifts.length > 0 && (
        <StaggerContainer className="flex flex-col gap-3 mb-5" staggerDelay={0.1}>
          {shifts.map((s, i) => (
            <StaggerItem key={i}>
              <div className="p-4 rounded-xl" style={{ background: 'white', borderLeft: '3px solid #4a6b8b' }}>
                <div className="text-[11px] font-semibold mb-1" style={{ color: 'var(--t-ink)' }}>{s.context}</div>
                <p className="text-[11px] leading-relaxed" style={{ color: INK['75'] }}>{s.insight}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      <StaggerContainer className="grid grid-cols-2 gap-3" staggerDelay={0.08}>
        {profile.contextModifiers.map((mod, i) => {
          const color = CONTEXT_COLORS[i % CONTEXT_COLORS.length];
          const icon = CONTEXT_ICONS[mod.context] || 'discover';
          return (
            <StaggerItem key={mod.context}>
              <div className="p-3 rounded-xl" style={{ background: 'white', borderTop: `2px solid ${color}` }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <PerriandIcon name={icon} size={14} color={color} />
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--t-ink)' }}>{mod.context}</span>
                </div>
                <p className="text-[10px] leading-relaxed" style={{ color: INK['70'] }}>{mod.shifts}</p>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </div>
  );
}

// ═══════════════════════════════════════════
// TASTE NEIGHBORS — Archetypes near you
// ═══════════════════════════════════════════
function TasteNeighborsSection({ gp }: { gp: GeneratedTasteProfile | null }) {
  const neighbors = gp?.tasteNeighbors;
  if (!neighbors) return null;

  return (
    <div className="px-5 py-6" style={{ background: '#f5f0e6' }}>
      <FadeInSection>
        <div className="text-[9px] uppercase tracking-[0.25em] mb-1" style={{ color: 'var(--t-panton-orange)', fontFamily: FONT.mono, fontWeight: 700 }}>
          Taste Neighbors
        </div>
        <p className="text-[11px] mb-5" style={{ color: INK['60'], fontFamily: FONT.sans }}>
          Archetypes that overlap with yours — and what sets you apart.
        </p>
      </FadeInSection>

      <StaggerContainer className="flex flex-wrap gap-2 mb-4" staggerDelay={0.06}>
        {neighbors.nearbyArchetypes.map((a) => (
          <StaggerItem key={a}>
            <span className="text-[11px] px-3 py-1.5 rounded-full inline-block" style={{ background: 'rgba(232,104,48,0.08)', color: '#c45020', fontFamily: FONT.sans }}>
              {a}
            </span>
          </StaggerItem>
        ))}
      </StaggerContainer>

      <FadeInSection delay={0.3}>
        <div className="p-4 rounded-xl mb-3" style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
          <div className="text-[9px] uppercase tracking-wider mb-1.5" style={{ color: INK['50'], fontFamily: FONT.mono }}>What makes you different</div>
          <p className="text-[12px] leading-relaxed" style={{ color: INK['70'] }}>{neighbors.distinction}</p>
        </div>
      </FadeInSection>

      <FadeInSection delay={0.4}>
        <div className="p-3 rounded-lg flex items-center gap-2" style={{ background: 'rgba(232,104,48,0.05)' }}>
          <PerriandIcon name="sparkle" size={12} color="#c45020" />
          <p className="text-[11px] italic" style={{ color: '#c45020' }}>{neighbors.rarityStat}</p>
        </div>
      </FadeInSection>
    </div>
  );
}

// ═══════════════════════════════════════════
// DIMENSIONS — 6 domain certainty overview
// ═══════════════════════════════════════════
const DIMENSION_CERTAINTIES: Record<string, number> = {
  "Design Language": 92, "Character & Identity": 85, "Service Philosophy": 88,
  "Food & Drink": 90, "Location & Context": 82, "Wellness & Body": 72,
};

function DimensionBar({ certainty, color }: { certainty: number; color: string }) {
  const [ref, isInView] = useInView({ threshold: 0.3 });

  if (isMobileSafari()) {
    return (
      <div ref={ref} className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: INK['06'] }}>
        <div className="h-1.5 rounded-full" style={{ background: color, width: `${certainty}%` }} />
      </div>
    );
  }

  return (
    <div ref={ref} className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: INK['06'] }}>
      <motion.div
        className="h-1.5 rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={isInView ? { width: `${certainty}%` } : { width: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

function DimensionsSection({ profile }: { profile: ProfileShape }) {
  const domains = Object.keys(profile.microTasteSignals).filter(k => k !== 'Rejection');
  const totalSignals = Object.values(profile.microTasteSignals).flat().length;
  return (
    <div className="px-5 py-6" style={{ background: 'var(--t-cream)' }}>
      <FadeInSection>
        <div className="text-[9px] uppercase tracking-[0.25em] mb-1" style={{ color: '#8a6a2a', fontFamily: FONT.mono, fontWeight: 700 }}>
          Taste Dimensions
        </div>
        <p className="text-[11px] mb-5" style={{ color: INK['60'], fontFamily: FONT.sans }}>
          How confidently we can match you across {domains.length} domains, based on {totalSignals} signals.
        </p>
      </FadeInSection>

      <StaggerContainer className="flex flex-col gap-2" staggerDelay={0.08}>
        {domains.map(domain => {
          const color = DIMENSION_COLORS[domain] || '#8b6b4a';
          const certainty = DIMENSION_CERTAINTIES[domain] || 80;
          const signalCount = (profile.microTasteSignals[domain] || []).length;
          return (
            <StaggerItem key={domain}>
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'white' }}>
                <div className="flex-shrink-0 w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-[12px] font-semibold flex-1" style={{ color: 'var(--t-ink)' }}>{domain}</span>
                <span className="text-[9px]" style={{ color: INK['55'], fontFamily: FONT.mono }}>{signalCount} signals</span>
                <DimensionBar certainty={certainty} color={color} />
                <AnimatedNumber value={certainty} suffix="%" style={{ color, fontFamily: FONT.mono, fontSize: 10, fontWeight: 700, width: 32, textAlign: 'right' as const }} />
              </div>
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </div>
  );
}

// ═══════════════════════════════════════════
// VOCABULARY — Flat word cloud of all signals + rejections
// ═══════════════════════════════════════════
function VocabularySection({ profile }: { profile: ProfileShape }) {
  const positiveTerms: Array<{ term: string; color: string }> = [];
  const rejectionTerms: string[] = [];

  for (const [category, terms] of Object.entries(profile.microTasteSignals)) {
    if (category === 'Rejection') {
      rejectionTerms.push(...terms);
    } else {
      const color = DIMENSION_COLORS[category] || '#8b6b4a';
      terms.forEach(term => positiveTerms.push({ term, color }));
    }
  }

  return (
    <div className="px-5 py-6" style={{ background: '#f5f0e6' }}>
      <FadeInSection>
        <div className="text-[9px] uppercase tracking-[0.25em] mb-1" style={{ color: '#8a6a2a', fontFamily: FONT.mono, fontWeight: 700 }}>
          Taste Vocabulary
        </div>
        <p className="text-[11px] mb-5" style={{ color: INK['60'], fontFamily: FONT.sans }}>
          {positiveTerms.length + rejectionTerms.length} words that define what you love — and what you don&apos;t.
        </p>
      </FadeInSection>

      {/* Positive signals — animated word cloud */}
      <StaggerContainer className="flex flex-wrap gap-1.5 mb-4" staggerDelay={0.03}>
        {positiveTerms.map(({ term, color }) => (
          <StaggerItem key={term}>
            <span className="text-[10px] px-2.5 py-1 rounded-full inline-block" style={{ background: `${color}10`, color, fontFamily: FONT.sans }}>
              {term}
            </span>
          </StaggerItem>
        ))}
      </StaggerContainer>

      {/* Rejections */}
      {rejectionTerms.length > 0 && (
        <FadeInSection delay={0.4}>
          <div className="p-3 rounded-xl" style={{ background: 'rgba(139,74,74,0.04)', border: '1px dashed rgba(139,74,74,0.15)' }}>
            <div className="text-[9px] uppercase tracking-wider mb-2" style={{ color: '#8b4a4a', fontFamily: FONT.mono }}>
              What you reject
            </div>
            <StaggerContainer className="flex flex-wrap gap-1.5" staggerDelay={0.04}>
              {rejectionTerms.map(term => (
                <StaggerItem key={term}>
                  <span className="text-[10px] px-2.5 py-1 rounded-full inline-block" style={{ background: 'rgba(139,74,74,0.08)', color: '#8b4a4a', fontFamily: FONT.sans }}>
                    {term}
                  </span>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </FadeInSection>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// MATCHED PROPERTIES — Top matches with signal breakdown
// ═══════════════════════════════════════════
function MatchesSection({ profile }: { profile: ProfileShape }) {
  return (
    <div className="px-5 py-6 pb-8" style={{ background: 'var(--t-cream)' }}>
      <FadeInSection>
        <div className="text-[9px] uppercase tracking-[0.25em] mb-1" style={{ color: 'var(--t-verde)', fontFamily: FONT.mono, fontWeight: 700 }}>
          Top Matches
        </div>
        <p className="text-[11px] mb-5" style={{ color: INK['60'], fontFamily: FONT.sans }}>
          Properties scored against your full taste profile.
        </p>
      </FadeInSection>

      <StaggerContainer className="flex flex-col gap-3" staggerDelay={0.15}>
        {profile.matchedProperties.map((prop, i) => (
          <StaggerItem key={prop.name}>
            <PlaceLink name={prop.name} location={prop.location} googlePlaceId={(prop as Record<string, unknown>).googlePlaceId as string | undefined}>
            <div className="rounded-xl overflow-hidden" style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <AnimatedScoreArc score={prop.score} color="#4a6741" size={48} delay={i * 0.15} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[14px] font-semibold" style={{ color: 'var(--t-ink)' }}>{prop.name}</span>
                      {i === 0 && (
                        isMobileSafari() ? (
                          <span
                            className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(42,122,86,0.08)', color: 'var(--t-verde)', fontFamily: FONT.mono }}
                          >
                            Best match
                          </span>
                        ) : (
                          <motion.span
                            className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(42,122,86,0.08)', color: 'var(--t-verde)', fontFamily: FONT.mono }}
                            initial={{ scale: 0 }}
                            whileInView={{ scale: 1 }}
                            transition={{ delay: 0.5, type: 'spring', stiffness: 400 }}
                            viewport={{ once: true }}
                          >
                            Best match
                          </motion.span>
                        )
                      )}
                    </div>
                    <div className="text-[11px] mb-2" style={{ color: INK['60'] }}>{prop.location}</div>
                    <div className="flex flex-wrap gap-1">
                      {prop.matchReasons.map(reason => (
                        <span key={reason} className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,103,65,0.08)', color: '#4a6741' }}>{reason}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-4 py-3" style={{ background: 'rgba(42,122,86,0.02)', borderTop: '1px solid var(--t-linen)' }}>
                <p className="text-[10px] italic leading-snug" style={{ color: INK['70'] }}>{prop.tensionResolved}</p>
              </div>
            </div>
            </PlaceLink>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </div>
  );
}

// ═══════════════════════════════════════════
// TASTE RADAR — Animated hexagonal radar chart
// ═══════════════════════════════════════════

function TasteRadarSection({ profile }: { profile: ProfileShape }) {
  const axes = profile.radarData || [];
  const [ref, isInView] = useInView({ threshold: 0.2 });
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = (size / 2) * 0.68;
  const n = axes.length;
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  const getPoint = (i: number, radius: number) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  };

  const gridPolygons = gridLevels.map((level) =>
    axes.map((_, i) => getPoint(i, maxRadius * level)).map(p => `${p.x},${p.y}`).join(' ')
  );

  const dataPoints = axes.map((d, i) => getPoint(i, maxRadius * d.value));
  const dataPolygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ');
  const zeroPolygon = axes.map((_, i) => getPoint(i, 0)).map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="px-5 py-6" style={{ background: '#2d3a2d' }}>
      <FadeInSection>
        <div className="text-[9px] uppercase tracking-[0.25em] mb-1" style={{ color: 'rgba(200,146,58,0.7)', fontFamily: FONT.mono, fontWeight: 700 }}>
          Taste Profile
        </div>
        <p className="text-[11px] mb-2" style={{ color: 'rgba(245,245,240,0.6)', fontFamily: FONT.sans }}>
          Your six sensibility axes — the shape of how you experience places.
        </p>
      </FadeInSection>

      <div ref={ref} className="flex flex-col items-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <defs>
            <radialGradient id="radarAnimFill" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--t-honey)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--t-honey)" stopOpacity={0.05} />
            </radialGradient>
          </defs>

          {/* Grid polygons */}
          {gridPolygons.map((points, i) => (
            <polygon key={`g-${i}`} points={points} fill="none" stroke="rgba(245,245,240,0.08)" strokeWidth={0.5} />
          ))}

          {/* Axis lines */}
          {axes.map((d, i) => {
            const outer = getPoint(i, maxRadius);
            const color = AXIS_COLORS[d.axis] || '#8b6b4a';
            return <line key={`a-${i}`} x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke={color} strokeOpacity={0.35} strokeWidth={0.8} />;
          })}

          {/* Animated data polygon */}
          {isMobileSafari() ? (
            <polygon points={dataPolygon} fill="url(#radarAnimFill)" stroke="var(--t-honey)" strokeWidth={1.5} strokeOpacity={0.7} />
          ) : (
            <motion.polygon
              fill="url(#radarAnimFill)"
              stroke="var(--t-honey)"
              strokeWidth={1.5}
              strokeOpacity={0.7}
              initial={{ points: zeroPolygon, opacity: 0 }}
              animate={isInView ? { points: dataPolygon, opacity: 1 } : { points: zeroPolygon, opacity: 0 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            />
          )}

          {/* Data point dots */}
          {dataPoints.map((p, i) => {
            const color = AXIS_COLORS[axes[i].axis] || '#8b6b4a';
            return isMobileSafari() ? (
              <g key={`d-${i}`}>
                <circle cx={p.x} cy={p.y} r={3.5} fill={color} />
                <circle cx={p.x} cy={p.y} r={1.5} fill="white" />
              </g>
            ) : (
              <motion.g key={`d-${i}`} initial={{ opacity: 0 }} animate={isInView ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.4, delay: 0.8 + i * 0.08 }}>
                <circle cx={p.x} cy={p.y} r={3.5} fill={color} />
                <circle cx={p.x} cy={p.y} r={1.5} fill="white" />
              </motion.g>
            );
          })}

          {/* Labels */}
          {axes.map((d, i) => {
            const lp = getPoint(i, maxRadius * 1.25);
            return (
              <text key={`l-${i}`} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle" fill="#f5f5f0" fontSize={10} fontFamily={FONT.mono} opacity={0.7}>
                {d.axis}
              </text>
            );
          })}

          {/* Numeric values */}
          {axes.map((d, i) => {
            const vp = getPoint(i, maxRadius * 1.42);
            const color = AXIS_COLORS[d.axis] || '#8b6b4a';
            return (
              <text key={`v-${i}`} x={vp.x} y={vp.y} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize={9} fontFamily={FONT.mono} fontWeight={700} opacity={0.9}>
                {Math.round(d.value * 100)}
              </text>
            );
          })}
        </svg>

        {/* Legend row */}
        <FadeInSection delay={0.6}>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {axes.map(d => {
              const color = AXIS_COLORS[d.axis] || '#8b6b4a';
              return (
                <div key={d.axis} className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                  <span className="text-[9px]" style={{ color: 'rgba(245,245,240,0.55)', fontFamily: FONT.mono }}>{d.axis} {Math.round(d.value * 100)}</span>
                </div>
              );
            })}
          </div>
        </FadeInSection>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// TRAVEL STATS — Animated counters + continent heatmap
// ═══════════════════════════════════════════

const TRAVEL_STATS = {
  countries: 14,
  cities: 38,
  continents: 4,
  totalNights: 187,
  longestTrip: 12,
  placesRated: 94,
  kmTraveled: 48200,
};

const CONTINENTS = [
  { name: 'Europe', visits: 22, pct: 58, color: '#c8923a' },
  { name: 'Asia', visits: 9, pct: 24, color: '#e86830' },
  { name: 'North America', visits: 5, pct: 13, color: '#4a6741' },
  { name: 'Africa', visits: 2, pct: 5, color: '#6844a0' },
];

const STAT_ICONS: Record<string, import('@/types').PerriandIconName> = {
  Countries: 'location',
  Cities: 'neighborhood',
  'Nights away': 'evening',
  'Places rated': 'star',
};

function AnimatedStatCard({ value, label, suffix, delay }: { value: number; label: string; suffix?: string; delay: number }) {
  const iconName = STAT_ICONS[label] || 'discover';
  return (
    <FadeInSection delay={delay} direction="up" distance={20}>
      <div className="text-center p-4 rounded-2xl" style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
        <div className="flex justify-center mb-2">
          <PerriandIcon name={iconName} size={18} color="var(--t-honey)" />
        </div>
        <AnimatedNumber value={value} suffix={suffix} style={{ fontFamily: FONT.mono, fontSize: 26, fontWeight: 700, color: 'var(--t-honey)' }} />
        <div className="text-[9px] uppercase tracking-wider mt-1" style={{ color: INK['50'], fontFamily: FONT.mono }}>{label}</div>
      </div>
    </FadeInSection>
  );
}

function ContinentBar({ name, visits, pct, color, delay }: { name: string; visits: number; pct: number; color: string; delay: number }) {
  const [ref, isInView] = useInView({ threshold: 0.3 });

  return (
    <FadeInSection delay={delay} direction="left" distance={24}>
      <div ref={ref} className="flex items-center gap-3 mb-3">
        <span className="text-[11px] font-semibold w-28 shrink-0" style={{ color: 'rgba(245,245,240,0.8)' }}>{name}</span>
        <div className="flex-1 h-5 rounded-full overflow-hidden relative" style={{ background: 'rgba(245,245,240,0.06)' }}>
          {isMobileSafari() ? (
            <div
              className="h-full rounded-full flex items-center justify-end pr-2"
              style={{ background: color, width: `${pct}%` }}
            >
              <span className="text-[9px] font-bold" style={{ color: 'rgba(255,255,255,0.9)', fontFamily: FONT.mono }}>{visits}</span>
            </div>
          ) : (
            <motion.div
              className="h-full rounded-full flex items-center justify-end pr-2"
              style={{ background: color }}
              initial={{ width: 0 }}
              animate={isInView ? { width: `${pct}%` } : { width: 0 }}
              transition={{ duration: 1, delay: delay + 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.span
                className="text-[9px] font-bold"
                style={{ color: 'rgba(255,255,255,0.9)', fontFamily: FONT.mono }}
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.3, delay: delay + 0.8 }}
              >
                {visits}
              </motion.span>
            </motion.div>
          )}
        </div>
        <span className="text-[10px] w-8 text-right" style={{ color: 'rgba(245,245,240,0.45)', fontFamily: FONT.mono }}>{pct}%</span>
      </div>
    </FadeInSection>
  );
}

function TravelStatsSection() {
  return (
    <div className="px-5 py-6" style={{ background: 'var(--t-cream)' }}>
      <FadeInSection>
        <div className="text-[9px] uppercase tracking-[0.25em] mb-1" style={{ color: 'var(--t-honey)', fontFamily: FONT.mono, fontWeight: 700 }}>
          Your Travel Stats
        </div>
        <p className="text-[11px] mb-5" style={{ color: INK['60'], fontFamily: FONT.sans }}>
          The numbers behind your journeys — and they&apos;re still growing.
        </p>
      </FadeInSection>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <AnimatedStatCard value={TRAVEL_STATS.countries} label="Countries" delay={0.1} />
        <AnimatedStatCard value={TRAVEL_STATS.cities} label="Cities" delay={0.15} />
        <AnimatedStatCard value={TRAVEL_STATS.totalNights} label="Nights away" delay={0.2} />
        <AnimatedStatCard value={TRAVEL_STATS.placesRated} label="Places rated" delay={0.25} />
      </div>

      {/* Highlight strip */}
      <FadeInSection delay={0.3}>
        <div className="flex gap-2 mb-6">
          {[
            { v: TRAVEL_STATS.longestTrip, l: 'Longest trip', s: ' days', icon: 'trips' as const },
            { v: TRAVEL_STATS.continents, l: 'Continents', s: '', icon: 'discover' as const },
            { v: Math.round(TRAVEL_STATS.kmTraveled / 1000), l: 'Distance', s: 'k km', icon: 'transport' as const },
          ].map(({ v, l, s, icon }) => (
            <div key={l} className="flex-1 text-center p-3 rounded-xl" style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
              <div className="flex justify-center mb-1">
                <PerriandIcon name={icon} size={12} color={INK['40']} />
              </div>
              <AnimatedNumber value={v} suffix={s} style={{ fontFamily: FONT.mono, fontSize: 16, fontWeight: 700, color: 'var(--t-ink)' }} />
              <div className="text-[8px] uppercase tracking-wider mt-0.5" style={{ color: INK['45'], fontFamily: FONT.mono }}>{l}</div>
            </div>
          ))}
        </div>
      </FadeInSection>

      {/* Continent breakdown */}
      <FadeInSection delay={0.35}>
        <div className="text-[9px] uppercase tracking-[0.2em] mb-3" style={{ color: INK['45'], fontFamily: FONT.mono }}>
          Where you go most
        </div>
      </FadeInSection>
      <div className="p-4 rounded-2xl" style={{ background: '#2d3a2d' }}>
        {CONTINENTS.map((c, i) => (
          <ContinentBar key={c.name} {...c} delay={0.4 + i * 0.1} />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// TRAVEL TIMELINE — Animated vertical timeline
// ═══════════════════════════════════════════

const TRIPS: Array<{ title: string; dates: string; places: number; upcoming: boolean; color: string; icon: import('@/types').PerriandIconName }> = [
  { title: 'Paris in Spring', dates: 'Apr 12\u201316, 2026', places: 7, upcoming: true, color: '#c8923a', icon: 'hotel' },
  { title: 'Kyoto Autumn', dates: 'Nov 3\u201310, 2025', places: 12, upcoming: false, color: '#e86830', icon: 'morning' },
  { title: 'Amalfi Coast', dates: 'Jun 18\u201325, 2025', places: 9, upcoming: false, color: '#4a6741', icon: 'summer' },
  { title: 'Marrakech Weekend', dates: 'Mar 7\u20139, 2025', places: 5, upcoming: false, color: '#6844a0', icon: 'activity' },
  { title: 'Stockholm Design Week', dates: 'Feb 8\u201313, 2025', places: 8, upcoming: false, color: '#4a6b8b', icon: 'design' },
  { title: 'Puglia Slow Trip', dates: 'Sep 1\u201310, 2024', places: 11, upcoming: false, color: '#8b6b4a', icon: 'food' },
];

function TravelTimelineSection() {
  return (
    <div className="px-5 py-6" style={{ background: '#f5f0e6' }}>
      <FadeInSection>
        <div className="text-[9px] uppercase tracking-[0.25em] mb-1" style={{ color: '#8a6a2a', fontFamily: FONT.mono, fontWeight: 700 }}>
          Travel Timeline
        </div>
        <p className="text-[11px] mb-5" style={{ color: INK['60'], fontFamily: FONT.sans }}>
          Your journeys, past and future — each one shaping your taste.
        </p>
      </FadeInSection>

      <div className="relative">
        {/* Animated timeline spine */}
        {!isMobileSafari() ? (
          <motion.div
            className="absolute left-[15px] top-0 w-[1.5px]"
            style={{ background: `linear-gradient(to bottom, var(--t-honey), ${INK['10']})` }}
            initial={{ height: 0 }}
            whileInView={{ height: '100%' }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true }}
          />
        ) : (
          <div
            className="absolute left-[15px] top-0 w-[1.5px] h-full"
            style={{ background: `linear-gradient(to bottom, var(--t-honey), ${INK['10']})` }}
          />
        )}

        <div className="flex flex-col gap-0">
          {TRIPS.map((trip, i) => (
            <FadeInSection key={trip.title} delay={i * 0.12} direction="left" distance={30}>
              <div className="flex gap-4 pb-5">
                {/* Timeline dot with icon */}
                <div className="flex flex-col items-center shrink-0" style={{ width: 32 }}>
                  {isMobileSafari() ? (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: trip.upcoming ? trip.color : 'white',
                        border: trip.upcoming ? 'none' : `2px solid ${trip.color}`,
                        boxShadow: trip.upcoming ? `0 2px 8px ${trip.color}30` : 'none',
                      }}
                    >
                      <PerriandIcon name={trip.icon} size={14} color={trip.upcoming ? 'white' : trip.color} />
                    </div>
                  ) : (
                    <motion.div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: trip.upcoming ? trip.color : 'white',
                        border: trip.upcoming ? 'none' : `2px solid ${trip.color}`,
                        boxShadow: trip.upcoming ? `0 2px 8px ${trip.color}30` : 'none',
                      }}
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      transition={{ duration: 0.4, delay: i * 0.12, type: 'spring', stiffness: 300, damping: 20 }}
                      viewport={{ once: true }}
                    >
                      <PerriandIcon name={trip.icon} size={14} color={trip.upcoming ? 'white' : trip.color} />
                    </motion.div>
                  )}
                </div>

                {/* Trip card */}
                <div className="flex-1 p-4 rounded-xl" style={{ background: 'white', border: `1px solid ${trip.upcoming ? trip.color + '30' : 'var(--t-linen)'}` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-semibold" style={{ color: 'var(--t-ink)', fontFamily: FONT.sans }}>{trip.title}</span>
                    {trip.upcoming && (
                      <span className="text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold" style={{ background: `${trip.color}12`, color: trip.color, fontFamily: FONT.mono }}>
                        Upcoming
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] mb-1.5" style={{ color: INK['55'], fontFamily: FONT.mono }}>{trip.dates}</div>
                  <div className="flex items-center gap-1.5">
                    <PerriandIcon name="location" size={10} color={trip.color} />
                    <span className="text-[10px]" style={{ color: trip.color, fontFamily: FONT.mono }}>{trip.places} places</span>
                  </div>
                </div>
              </div>
            </FadeInSection>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// TASTE EVOLUTION — How your taste has shifted over time
// ═══════════════════════════════════════════

const EVOLUTION_PHASES = [
  {
    period: '2022',
    label: 'The Resort Phase',
    description: 'Comfort-first. You chose places by star ratings and pool size. Chain hotels felt safe.',
    shifts: { design: 35, character: 20, food: 45, service: 60 },
    color: '#8b6b4a',
  },
  {
    period: '2023',
    label: 'The Awakening',
    description: 'That one boutique hotel in Lisbon changed everything. You started noticing light, materials, the feel of a space.',
    shifts: { design: 55, character: 45, food: 60, service: 50 },
    color: '#e86830',
  },
  {
    period: '2024',
    label: 'The Deep Dive',
    description: 'You became intentional. Farm-to-table wasn\u2019t a buzzword anymore \u2014 it was a requirement. You sought owner-operated places.',
    shifts: { design: 78, character: 72, food: 85, service: 68 },
    color: '#4a6741',
  },
  {
    period: '2025\u201326',
    label: 'The Aesthetic Pilgrim',
    description: 'Now you travel to expand your sense of what\u2019s possible. Design, food, culture \u2014 everything is taste.',
    shifts: { design: 92, character: 88, food: 90, service: 85 },
    color: '#c8923a',
  },
];

function EvolutionBar({ value, color, delay }: { value: number; color: string; delay: number }) {
  const [ref, isInView] = useInView({ threshold: 0.3 });

  if (isMobileSafari()) {
    return (
      <div ref={ref} className="h-1.5 rounded-full overflow-hidden" style={{ background: `${color}15` }}>
        <div className="h-full rounded-full" style={{ background: color, width: `${value}%` }} />
      </div>
    );
  }

  return (
    <div ref={ref} className="h-1.5 rounded-full overflow-hidden" style={{ background: `${color}15` }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={isInView ? { width: `${value}%` } : { width: 0 }}
        transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

function TasteEvolutionSection({ profile }: { profile: ProfileShape }) {
  // Use current archetype as the final phase label
  const currentArchetype = profile.overallArchetype || 'The Aesthetic Pilgrim';
  const phases = EVOLUTION_PHASES.map((p, i) =>
    i === EVOLUTION_PHASES.length - 1 ? { ...p, label: currentArchetype } : p
  );

  return (
    <div className="px-5 py-6" style={{ background: 'var(--t-cream)' }}>
      <FadeInSection>
        <div className="text-[9px] uppercase tracking-[0.25em] mb-1" style={{ color: '#8a6a2a', fontFamily: FONT.mono, fontWeight: 700 }}>
          Taste Evolution
        </div>
        <p className="text-[11px] mb-5" style={{ color: INK['60'], fontFamily: FONT.sans }}>
          How your palate has matured — from comfort zones to curious pilgrim.
        </p>
      </FadeInSection>

      <div className="relative">
        {/* Animated connecting line */}
        {!isMobileSafari() ? (
          <motion.div
            className="absolute left-[7px] top-2 w-[1.5px]"
            style={{ background: 'linear-gradient(to bottom, #8b6b4a, #c8923a)' }}
            initial={{ height: 0 }}
            whileInView={{ height: 'calc(100% - 16px)' }}
            transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true }}
          />
        ) : (
          <div className="absolute left-[7px] top-2 w-[1.5px]" style={{ height: 'calc(100% - 16px)', background: 'linear-gradient(to bottom, #8b6b4a, #c8923a)' }} />
        )}

        <div className="flex flex-col gap-5">
          {phases.map((phase, i) => {
            const isCurrent = i === phases.length - 1;
            return (
              <FadeInSection key={phase.period} delay={i * 0.15} direction="left" distance={24}>
                <div className="flex gap-4">
                  {/* Dot */}
                  <div className="shrink-0 mt-1">
                    {isMobileSafari() ? (
                      <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: phase.color, background: isCurrent ? phase.color : 'white' }} />
                    ) : (
                      <motion.div
                        className="w-4 h-4 rounded-full border-2"
                        style={{ borderColor: phase.color, background: isCurrent ? phase.color : 'white' }}
                        initial={{ scale: 0 }}
                        whileInView={{ scale: 1 }}
                        transition={{ duration: 0.4, delay: i * 0.15, type: 'spring', stiffness: 300 }}
                        viewport={{ once: true }}
                      />
                    )}
                  </div>

                  {/* Card */}
                  <div className="flex-1 p-4 rounded-xl" style={{ background: 'white', border: `1px solid ${isCurrent ? phase.color + '30' : 'var(--t-linen)'}` }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${phase.color}12`, color: phase.color, fontFamily: FONT.mono }}>{phase.period}</span>
                      <span className="text-[13px] font-semibold" style={{ color: 'var(--t-ink)' }}>{phase.label}</span>
                      {isCurrent && <PerriandIcon name="sparkle" size={10} color={phase.color} />}
                    </div>
                    <p className="text-[11px] leading-relaxed mb-3" style={{ color: INK['70'], fontFamily: FONT.sans }}>{phase.description}</p>

                    {/* Mini dimension bars */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {Object.entries(phase.shifts).map(([key, val], j) => (
                        <div key={key}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[9px] capitalize" style={{ color: INK['50'], fontFamily: FONT.mono }}>{key}</span>
                            <AnimatedNumber value={val} suffix="%" style={{ color: phase.color, fontFamily: FONT.mono, fontSize: 9, fontWeight: 700 }} />
                          </div>
                          <EvolutionBar value={val} color={phase.color} delay={i * 0.15 + j * 0.05} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </FadeInSection>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// BUCKET LIST — Dream destinations with progress rings
// ═══════════════════════════════════════════

const BUCKET_LIST: Array<{
  destination: string; reason: string; progress: number;
  color: string; icon: import('@/types').PerriandIconName; status: string;
}> = [
  { destination: 'Oaxaca, Mexico', reason: 'The food culture you\u2019ve been circling for years', progress: 85, color: '#e86830', icon: 'food', status: 'Planning' },
  { destination: 'Fogo Island, Canada', reason: 'Architecture at the edge of the world', progress: 40, color: '#4a6b8b', icon: 'design', status: 'Dreaming' },
  { destination: 'Naoshima, Japan', reason: 'Art islands that blur gallery and landscape', progress: 65, color: '#6844a0', icon: 'museum', status: 'Researching' },
  { destination: 'Pantelleria, Italy', reason: 'Volcanic gardens and dammusi architecture', progress: 30, color: '#4a6741', icon: 'activity', status: 'Dreaming' },
  { destination: 'Bhutan', reason: 'Gross National Happiness — a country built on intention', progress: 20, color: '#c8923a', icon: 'wellness', status: 'Someday' },
  { destination: 'Cape Town, South Africa', reason: 'Where wine, design, and landscape collide', progress: 55, color: '#8b4a4a', icon: 'bar', status: 'Researching' },
];

function ProgressRing({ progress, color, size = 48, delay = 0 }: { progress: number; color: string; size?: number; delay?: number }) {
  const [ref, isInView] = useInView({ threshold: 0.3 });
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div ref={ref} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={`${color}15`} strokeWidth={3} />
        {isMobileSafari() ? (
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={color} strokeWidth={3} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
          />
        ) : (
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={color} strokeWidth={3} strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={isInView ? { strokeDashoffset: offset } : { strokeDashoffset: circumference }}
            transition={{ duration: 1.2, delay, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <AnimatedNumber value={progress} suffix="%" style={{ fontFamily: FONT.mono, fontSize: 10, fontWeight: 700, color }} />
      </div>
    </div>
  );
}

function BucketListSection() {
  const completedCount = BUCKET_LIST.filter(b => b.progress >= 80).length;
  const totalProgress = Math.round(BUCKET_LIST.reduce((acc, b) => acc + b.progress, 0) / BUCKET_LIST.length);

  return (
    <div className="px-5 py-6 pb-8" style={{ background: '#f5f0e6' }}>
      <FadeInSection>
        <div className="text-[9px] uppercase tracking-[0.25em] mb-1" style={{ color: 'var(--t-panton-orange)', fontFamily: FONT.mono, fontWeight: 700 }}>
          The Bucket List
        </div>
        <p className="text-[11px] mb-2" style={{ color: INK['60'], fontFamily: FONT.sans }}>
          Dream destinations matched to your taste DNA — with readiness scores.
        </p>
      </FadeInSection>

      {/* Overall progress header */}
      <FadeInSection delay={0.15}>
        <div className="flex items-center gap-4 p-4 rounded-2xl mb-5" style={{ background: '#2d3a2d' }}>
          <ProgressRing progress={totalProgress} color="#c8923a" size={56} delay={0.2} />
          <div className="flex-1">
            <div className="text-[14px] font-semibold mb-0.5" style={{ color: '#f5f5f0', fontFamily: FONT.sans }}>
              {completedCount > 0 ? `${completedCount} nearly ready` : 'Building your list'}
            </div>
            <div className="text-[11px]" style={{ color: 'rgba(245,245,240,0.6)', fontFamily: FONT.sans }}>
              {BUCKET_LIST.length} destinations · {totalProgress}% average readiness
            </div>
          </div>
        </div>
      </FadeInSection>

      {/* Destination cards */}
      <StaggerContainer className="flex flex-col gap-3" staggerDelay={0.1}>
        {BUCKET_LIST.map((item, i) => (
          <StaggerItem key={item.destination}>
            <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
              <ProgressRing progress={item.progress} color={item.color} size={48} delay={i * 0.1} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <PerriandIcon name={item.icon} size={14} color={item.color} />
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--t-ink)' }}>{item.destination}</span>
                </div>
                <p className="text-[10px] leading-relaxed mb-1.5" style={{ color: INK['60'], fontFamily: FONT.sans }}>{item.reason}</p>
                <span className="text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold" style={{ background: `${item.color}10`, color: item.color, fontFamily: FONT.mono }}>
                  {item.status}
                </span>
              </div>
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>

      {/* Recommendation footer */}
      <FadeInSection delay={0.6}>
        <div className="mt-5 p-4 rounded-xl flex items-start gap-3" style={{ background: 'rgba(200,146,58,0.05)', border: '1px solid rgba(200,146,58,0.12)' }}>
          <PerriandIcon name="sparkle" size={14} color="var(--t-honey)" />
          <div>
            <p className="text-[11px] leading-relaxed" style={{ color: INK['70'], fontFamily: FONT.sans }}>
              Your taste profile suggests <strong style={{ color: 'var(--t-ink)' }}>Oaxaca</strong> as your highest-readiness match —
              93% alignment with your food and character signals.
            </p>
          </div>
        </div>
      </FadeInSection>
    </div>
  );
}
