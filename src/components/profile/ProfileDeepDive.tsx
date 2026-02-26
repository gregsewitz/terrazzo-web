'use client';

import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';

import { useInView, isMobileSafari } from '@/hooks/useAnimations';
import { TASTE_PROFILE, WRAPPED, DIMENSION_COLORS, AXIS_COLORS, CONTEXT_ICONS, CONTEXT_COLORS } from '@/constants/profile';
import type { TasteProfile as ProfileShape } from '@/constants/profile';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { TerrazzoMosaic, MosaicLegend } from '@/components/TerrazzoMosaic';
import { useOnboardingStore } from '@/stores/onboardingStore';
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
          </StaggerItem>
        ))}
      </StaggerContainer>
    </div>
  );
}
