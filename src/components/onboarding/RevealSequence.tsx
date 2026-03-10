'use client';

import { useState, useEffect, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GeneratedTasteProfile, GoBackPlace, SeedTripInput } from '@/types';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { FONT, INK } from '@/constants/theme';
import { T } from '@/types';
import { SafeFadeIn } from '@/components/animations/SafeFadeIn';

interface RevealSequenceProps {
  profile: GeneratedTasteProfile;
  onComplete: () => void;
}

type RevealStage =
  | 'archetype'
  | 'quote'
  | 'design'
  | 'fingerprint'
  | 'contradiction'
  | 'perfectday'
  | 'shift'
  | 'neighbors'
  | 'destinations'
  | 'trips';

// Animation constants
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
const SPRING_GENTLE = { type: 'spring' as const, stiffness: 200, damping: 24 };
const SPRING_BOUNCY = { type: 'spring' as const, stiffness: 300, damping: 20 };

// Stage transition variants
const stageVariants = {
  enter: { opacity: 0, y: 30, scale: 0.98 },
  center: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: EASE_OUT_EXPO } },
  exit: { opacity: 0, y: -20, scale: 0.98, transition: { duration: 0.3 } },
};

// ─── Shared decorative elements ───

function GoldDivider({ width = 40, delay = 0 }: { width?: number; delay?: number }) {
  return (
    <motion.div
      initial={{ scaleX: 0, opacity: 0 }}
      animate={{ scaleX: 1, opacity: 1 }}
      transition={{ duration: 0.8, ease: EASE_OUT_EXPO, delay }}
      style={{
        width, height: 1.5,
        background: `linear-gradient(90deg, transparent, ${T.honey}, transparent)`,
        margin: '0 auto',
      }}
    />
  );
}

function SectionLabel({ children, color = T.honey, delay = 0.1 }: { children: string; color?: string; delay?: number }) {
  return (
    <SafeFadeIn delay={delay} direction="up" distance={12} duration={0.5}>
      <div style={{
        fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
        letterSpacing: '0.18em', textTransform: 'uppercase',
        color, marginBottom: 16,
      }}>
        {children}
      </div>
    </SafeFadeIn>
  );
}


const RevealSequence = memo(function RevealSequence({ profile, onComplete }: RevealSequenceProps) {
  const { goBackPlace, seedTrips, lifeContext, mosaicAxes } = useOnboardingStore();

  // Build dynamic stage list — skip stages with no data
  const stages = useMemo(() => {
    const s: RevealStage[] = ['archetype'];
    if (profile.bestQuote?.quote) s.push('quote');
    if (profile.designInsight || Object.keys(mosaicAxes).length > 0) s.push('design');
    if (profile.radarData?.length > 0) s.push('fingerprint');
    if (profile.contradictions?.length > 0) s.push('contradiction');
    if (profile.perfectDay) s.push('perfectday');
    if (profile.howYouShift?.length) s.push('shift');
    if (profile.tasteNeighbors) s.push('neighbors');
    if (profile.destinations) s.push('destinations');
    if (seedTrips?.length > 0) s.push('trips');
    return s;
  }, [profile, mosaicAxes, seedTrips]);

  const [stageIndex, setStageIndex] = useState(0);
  const stage = stages[stageIndex];

  const advance = () => {
    if (stageIndex >= stages.length - 1) {
      onComplete();
      return;
    }
    setStageIndex((i) => i + 1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={stage}
          variants={stageVariants}
          initial="enter"
          animate="center"
          exit="exit"
          style={{
            flex: 1, overflowY: 'auto', padding: '32px 24px',
          }}
        >
          {stage === 'archetype' && <ArchetypeReveal profile={profile} firstName={lifeContext.firstName} />}
          {stage === 'quote' && <QuoteReveal profile={profile} />}
          {stage === 'design' && <DesignLanguageReveal profile={profile} mosaicAxes={mosaicAxes} />}
          {stage === 'fingerprint' && <TasteFingerprintReveal profile={profile} />}
          {stage === 'contradiction' && <ContradictionReveal profile={profile} />}
          {stage === 'perfectday' && <PerfectDayReveal profile={profile} />}
          {stage === 'shift' && <HowYouShiftReveal profile={profile} />}
          {stage === 'neighbors' && <TasteNeighborsReveal profile={profile} />}
          {stage === 'destinations' && <DestinationsReveal profile={profile} />}
          {stage === 'trips' && <SeedTripsReveal seedTrips={seedTrips} />}
        </motion.div>
      </AnimatePresence>

      <div style={{
        padding: '16px 24px 20px',
        borderTop: '1px solid var(--t-linen)',
        flexShrink: 0,
        maxWidth: 520,
        margin: '0 auto',
        width: '100%',
      }}>
        <motion.button
          onClick={advance}
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          style={{
            width: '100%', padding: '14px 0',
            borderRadius: 14, border: 'none',
            background: 'var(--t-ink)', color: 'var(--t-cream)',
            fontFamily: FONT.sans, fontSize: 14, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {stageIndex >= stages.length - 1 ? 'Dive in' : 'Continue'}
        </motion.button>

        {/* Stage dots */}
        <div style={{
          display: 'flex', gap: 6, justifyContent: 'center', marginTop: 14,
        }}>
          {stages.map((_, i) => (
            <motion.div
              key={i}
              layout
              style={{
                height: 6,
                borderRadius: 3,
                background: i === stageIndex ? T.honey : i < stageIndex ? INK['30'] : INK['12'],
              }}
              animate={{
                width: i === stageIndex ? 18 : 6,
              }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

RevealSequence.displayName = 'RevealSequence';
export default RevealSequence;


// ─── Card 1: Archetype ───

function ArchetypeReveal({ profile, firstName }: { profile: GeneratedTasteProfile; firstName?: string }) {
  const greeting = firstName ? `${firstName}, you're` : "You're";

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '65vh', textAlign: 'center',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Subtle radial glow */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 500, height: 500, borderRadius: '50%',
        background: `radial-gradient(circle, ${T.honey}08 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Decorative ring */}
      <SafeFadeIn delay={0} direction="none" scale={0.6} duration={1}>
        <motion.div
          style={{
            width: 80, height: 80, borderRadius: '50%',
            border: `1.5px solid ${T.honey}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 24,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
        >
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: T.honey,
          }} />
        </motion.div>
      </SafeFadeIn>

      <SectionLabel delay={0.15}>Your taste archetype</SectionLabel>

      <SafeFadeIn delay={0.3} direction="up" distance={24} duration={0.7}>
        <h1
          style={{
            fontFamily: FONT.serif, fontSize: 42, fontStyle: 'italic',
            fontWeight: 400, color: 'var(--t-ink)',
            margin: 0, lineHeight: 1.12,
            maxWidth: 360,
          }}
        >
          {greeting} {profile.overallArchetype}
        </h1>
      </SafeFadeIn>

      <SafeFadeIn delay={0.5} direction="none" duration={0.8}>
        <GoldDivider width={50} delay={0.5} />
      </SafeFadeIn>

      <SafeFadeIn delay={0.6} direction="up" distance={16} duration={0.6}>
        <p
          style={{
            fontFamily: FONT.sans, fontSize: 15, lineHeight: 1.7,
            color: INK['75'], maxWidth: 300, marginTop: 20,
          }}
        >
          {profile.archetypeDescription}
        </p>
      </SafeFadeIn>

      <SafeFadeIn delay={0.8} direction="up" distance={12} scale={0.9} duration={0.5}>
        <div
          style={{
            marginTop: 28, padding: '10px 24px',
            borderRadius: 100,
            background: `linear-gradient(135deg, ${T.honey}06, ${T.honey}12)`,
            border: `1px solid ${T.honey}18`,
            backdropFilter: 'blur(8px)',
          }}
        >
          <span style={{
            fontFamily: FONT.sans, fontSize: 13, color: INK['70'],
          }}>
            <span style={{ color: T.honey, fontWeight: 600 }}>{profile.emotionalDriver.primary}</span>
            {' · '}
            <span>{profile.emotionalDriver.secondary}</span>
          </span>
        </div>
      </SafeFadeIn>
    </div>
  );
}


// ─── Card 2: The Quote ───

function QuoteReveal({ profile }: { profile: GeneratedTasteProfile }) {
  if (!profile.bestQuote) return null;

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh', textAlign: 'center',
        padding: '0 4px', position: 'relative',
      }}
    >
      <SectionLabel delay={0.1}>The moment that told us the most</SectionLabel>

      {/* Quote card with layered background */}
      <SafeFadeIn delay={0.2} direction="up" distance={20} duration={0.7}>
        <div style={{
          position: 'relative',
          borderRadius: 24, padding: '44px 32px 36px',
          maxWidth: 420, width: '100%',
          background: 'linear-gradient(165deg, rgba(201,171,113,0.04) 0%, var(--t-cream) 40%, rgba(201,171,113,0.06) 100%)',
          border: `1px solid ${T.honey}12`,
          boxShadow: `0 2px 24px rgba(201,171,113,0.06), 0 8px 32px rgba(28,26,23,0.03)`,
        }}>
          {/* Decorative quote mark */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 180, damping: 20, delay: 0.35 }}
            style={{
              position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)',
              width: 36, height: 36, borderRadius: '50%',
              background: `linear-gradient(135deg, ${T.honey}, ${T.honey}cc)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 12px ${T.honey}30`,
            }}
          >
            <span style={{
              fontFamily: FONT.serif, fontSize: 28, color: 'white',
              lineHeight: 1, marginTop: 4,
            }}>
              &ldquo;
            </span>
          </motion.div>

          <motion.p
            style={{
              fontFamily: FONT.serif, fontSize: 22, fontStyle: 'italic',
              fontWeight: 400, color: 'var(--t-ink)',
              lineHeight: 1.5, margin: '8px 0 0',
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.4 }}
          >
            {profile.bestQuote.quote}
          </motion.p>
        </div>
      </SafeFadeIn>

      {/* Insight below */}
      <SafeFadeIn delay={0.7} direction="up" distance={10} duration={0.5}>
        <div style={{ marginTop: 28, maxWidth: 360 }}>
          <GoldDivider width={30} delay={0} />
          <p
            style={{
              fontFamily: FONT.sans, fontSize: 14, lineHeight: 1.7,
              color: INK['70'], margin: '16px 0 0',
            }}
          >
            {profile.bestQuote.insight}
          </p>
        </div>
      </SafeFadeIn>
    </div>
  );
}


// ─── Card 3: Design Language ───

function DesignLanguageReveal({
  profile,
  mosaicAxes,
}: {
  profile: GeneratedTasteProfile;
  mosaicAxes: Record<string, number>;
}) {
  const spectrums = useMemo(() => {
    const axisOrder = ['volume', 'temperature', 'time', 'formality', 'culture', 'mood'];
    const defaultLabels: Record<string, [string, string]> = {
      volume: ['Minimal', 'Maximal'],
      temperature: ['Cool & Composed', 'Warm & Rich'],
      time: ['Contemporary', 'Historic & Layered'],
      formality: ['Raw & Natural', 'Polished & Sleek'],
      culture: ['International', 'Deeply Local'],
      mood: ['Serene', 'Energetic'],
    };

    return axisOrder.map((axis) => {
      const eloValue = mosaicAxes[axis] ?? 0.5;
      const annotation = profile.designInsight?.annotations?.find((a) => a.axis === axis);
      return {
        axis,
        value: eloValue,
        labels: annotation?.label ?? defaultLabels[axis] ?? [axis, axis],
        note: annotation?.note,
      };
    });
  }, [mosaicAxes, profile.designInsight]);

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <SectionLabel>Your design language</SectionLabel>
        <SafeFadeIn delay={0.2} direction="up" distance={16} duration={0.6}>
          <h2 style={{
            fontFamily: FONT.serif, fontSize: 26, fontStyle: 'italic',
            fontWeight: 400, color: 'var(--t-ink)',
            margin: '0 0 8px',
          }}>
            {profile.designInsight?.headline ?? 'How you see space'}
          </h2>
        </SafeFadeIn>
        <GoldDivider width={36} delay={0.3} />
      </div>

      <motion.div
        style={{
          maxWidth: 440, margin: '0 auto',
          display: 'flex', flexDirection: 'column', gap: 22,
          padding: '24px 28px',
          borderRadius: 20,
          background: 'linear-gradient(180deg, rgba(201,171,113,0.02) 0%, rgba(28,26,23,0.01) 100%)',
          border: `1px solid ${INK['04']}`,
        }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: 0.3 }}
      >
        {spectrums.map((spec, idx) => (
          <motion.div
            key={spec.axis}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: 0.35 + idx * 0.08 }}
          >
            {/* Labels */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', marginBottom: 8,
            }}>
              <span style={{
                fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                color: INK['50'],
              }}>
                {spec.labels[0]}
              </span>
              <span style={{
                fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                color: INK['50'],
              }}>
                {spec.labels[1]}
              </span>
            </div>

            {/* Track */}
            <div style={{
              position: 'relative', height: 6, borderRadius: 3,
              background: INK['06'],
              overflow: 'hidden',
            }}>
              {/* Filled portion with gradient */}
              <motion.div
                style={{
                  position: 'absolute', top: 0, left: 0,
                  height: '100%', borderRadius: 3,
                  background: `linear-gradient(90deg, ${T.honey}90, ${T.honey})`,
                }}
                initial={{ width: '0%' }}
                animate={{ width: `${Math.round(spec.value * 100)}%` }}
                transition={{ duration: 1, ease: EASE_OUT_EXPO, delay: 0.4 + idx * 0.08 }}
              />
              {/* Position dot */}
              <motion.div
                style={{
                  position: 'absolute', top: '50%',
                  width: 14, height: 14, borderRadius: '50%',
                  background: 'white',
                  border: `2.5px solid ${T.honey}`,
                  boxShadow: `0 1px 4px ${T.honey}30, 0 2px 8px rgba(28,26,23,0.08)`,
                  transform: 'translateY(-50%)',
                }}
                initial={{ left: '0%', opacity: 0, scale: 0 }}
                animate={{ left: `calc(${Math.round(spec.value * 100)}% - 7px)`, opacity: 1, scale: 1 }}
                transition={{ duration: 1, ease: EASE_OUT_EXPO, delay: 0.4 + idx * 0.08 }}
              />
            </div>

            {/* Annotation */}
            {spec.note && (
              <p style={{
                fontFamily: FONT.sans, fontSize: 12, lineHeight: 1.55,
                color: INK['60'], marginTop: 6, marginBottom: 0,
                fontStyle: 'italic',
              }}>
                {spec.note}
              </p>
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}


// ─── Card 4: Taste Fingerprint ───

function TasteFingerprintReveal({ profile }: { profile: GeneratedTasteProfile }) {
  const radar = profile.radarData;
  if (!radar?.length) return null;

  const sorted = [...radar].sort((a, b) => b.value - a.value);
  const top2 = sorted.slice(0, 2).map((d) => d.axis);

  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 28;

  const points = radar.map((d, i) => {
    const angle = (Math.PI * 2 * i) / radar.length - Math.PI / 2;
    const r = d.value * maxR;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      axis: d.axis,
      value: d.value,
    };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '55vh', textAlign: 'center',
        position: 'relative',
      }}
    >
      <SectionLabel>Your taste fingerprint</SectionLabel>

      {/* Chart with glow */}
      <SafeFadeIn delay={0.15} direction="none" scale={0.85} duration={0.8}>
        <div style={{
          position: 'relative',
          padding: 24,
        }}>
          {/* Ambient glow behind chart */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: size * 0.6, height: size * 0.6, borderRadius: '50%',
            background: `radial-gradient(circle, ${T.honey}10 0%, transparent 70%)`,
            filter: 'blur(30px)',
            pointerEvents: 'none',
          }} />

          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Grid circles — softer */}
            {[0.33, 0.66, 1].map((r) => (
              <circle
                key={r}
                cx={cx} cy={cy} r={maxR * r}
                fill="none" stroke={INK['05']} strokeWidth={0.75}
                strokeDasharray={r < 1 ? '4 4' : 'none'}
              />
            ))}
            {/* Grid lines */}
            {points.map((_, i) => (
              <line
                key={i}
                x1={cx} y1={cy}
                x2={cx + maxR * Math.cos((Math.PI * 2 * i) / radar.length - Math.PI / 2)}
                y2={cy + maxR * Math.sin((Math.PI * 2 * i) / radar.length - Math.PI / 2)}
                stroke={INK['04']} strokeWidth={0.75}
              />
            ))}
            {/* Filled shape with gradient */}
            <defs>
              <linearGradient id="radarFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={T.honey} stopOpacity={0.15} />
                <stop offset="100%" stopColor={T.honey} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <motion.path
              d={pathD}
              fill="url(#radarFill)"
              stroke={T.honey}
              strokeWidth={2}
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.2, ease: EASE_OUT_EXPO, delay: 0.3 }}
            />
            {/* Dots with stagger */}
            {points.map((p, i) => (
              <motion.circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={4.5}
                fill="white"
                stroke={T.honey}
                strokeWidth={2}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ ...SPRING_BOUNCY, delay: 0.5 + i * 0.06 }}
              />
            ))}
          </svg>
        </div>
      </SafeFadeIn>

      {/* Axis labels — cleaner layout */}
      <SafeFadeIn delay={0.6} direction="up" distance={10} duration={0.5}>
        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
          gap: '8px 16px', marginTop: 8, maxWidth: 320,
        }}>
          {radar.map((d) => (
            <span key={d.axis} style={{
              fontFamily: FONT.sans, fontSize: 12,
              fontWeight: top2.includes(d.axis) ? 700 : 400,
              color: top2.includes(d.axis) ? T.honey : INK['50'],
              letterSpacing: '0.01em',
            }}>
              {d.axis}
            </span>
          ))}
        </div>
      </SafeFadeIn>

      <SafeFadeIn delay={0.75} direction="up" distance={10} duration={0.5}>
        <div style={{ marginTop: 20 }}>
          <GoldDivider width={30} delay={0} />
          <p
            style={{
              fontFamily: FONT.sans, fontSize: 14, lineHeight: 1.7,
              color: INK['75'], maxWidth: 320, marginTop: 14,
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--t-ink)' }}>{top2[0]}</span>
            {' and '}
            <span style={{ fontWeight: 600, color: 'var(--t-ink)' }}>{top2[1]}</span>
            {' drive you. Most travelers lead with other dimensions — you lead with these.'}
          </p>
        </div>
      </SafeFadeIn>
    </div>
  );
}


// ─── Card 5: Contradiction ───

function ContradictionReveal({ profile }: { profile: GeneratedTasteProfile }) {
  const c = profile.contradictions[0];
  if (!c) return null;

  const PURPLE = '#6844a0';

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '55vh', textAlign: 'center',
        padding: '0 4px',
      }}
    >
      <SectionLabel color={PURPLE}>The interesting part</SectionLabel>

      <SafeFadeIn delay={0.2} direction="up" distance={16} duration={0.6}>
        <h2 style={{
          fontFamily: FONT.serif, fontSize: 24, fontStyle: 'italic',
          fontWeight: 400, color: 'var(--t-ink)',
          margin: '0 0 28px', maxWidth: 300,
        }}>
          You contain contradictions
        </h2>
      </SafeFadeIn>

      <div style={{ maxWidth: 420, width: '100%' }}>
        {/* The two poles — side by side */}
        <div style={{
          display: 'flex', alignItems: 'stretch', justifyContent: 'center',
          gap: 12, marginBottom: 24,
        }}>
          <SafeFadeIn delay={0.35} direction="left" distance={24} duration={0.6}>
            <div
              style={{
                flex: 1,
                fontFamily: FONT.serif, fontSize: 16, fontStyle: 'italic',
                color: 'var(--t-ink)', textAlign: 'center',
                padding: '20px 20px',
                borderRadius: 16,
                background: `linear-gradient(135deg, ${T.honey}06, ${T.honey}10)`,
                border: `1px solid ${T.honey}15`,
              }}
            >
              {c.stated}
            </div>
          </SafeFadeIn>

          <SafeFadeIn delay={0.4} direction="none" scale={0.5} duration={0.4}>
            <div style={{
              display: 'flex', alignItems: 'center',
            }}>
              <span style={{
                fontFamily: FONT.sans, fontSize: 18, fontWeight: 300,
                color: `${PURPLE}40`,
              }}>
                &times;
              </span>
            </div>
          </SafeFadeIn>

          <SafeFadeIn delay={0.35} direction="right" distance={24} duration={0.6}>
            <div
              style={{
                flex: 1,
                fontFamily: FONT.serif, fontSize: 16, fontStyle: 'italic',
                color: 'var(--t-ink)', textAlign: 'center',
                padding: '20px 20px',
                borderRadius: 16,
                background: `linear-gradient(135deg, ${PURPLE}04, ${PURPLE}08)`,
                border: `1px solid ${PURPLE}12`,
              }}
            >
              {c.revealed}
            </div>
          </SafeFadeIn>
        </div>

        {/* Resolution */}
        <SafeFadeIn delay={0.55} direction="up" distance={12} duration={0.6}>
          <div
            style={{
              padding: '24px 28px', borderRadius: 18,
              background: 'white',
              boxShadow: `0 2px 16px rgba(28,26,23,0.04), 0 8px 24px rgba(28,26,23,0.02)`,
              border: `1px solid ${INK['04']}`,
              textAlign: 'left',
            }}
          >
            <p style={{
              fontFamily: FONT.sans, fontSize: 14, lineHeight: 1.7,
              color: INK['80'], margin: 0,
            }}>
              {c.resolution}
            </p>
          </div>
        </SafeFadeIn>

        <SafeFadeIn delay={0.7} direction="none" duration={0.5}>
          <p style={{
            fontFamily: FONT.sans, fontSize: 13, color: INK['55'],
            marginTop: 18, fontStyle: 'italic',
          }}>
            We&apos;ll find places that understand both sides.
          </p>
        </SafeFadeIn>
      </div>
    </div>
  );
}


// ─── Card 6: Your Perfect Day ───

function PerfectDayReveal({ profile }: { profile: GeneratedTasteProfile }) {
  if (!profile.perfectDay) return null;

  const segments = [
    {
      label: 'Morning', text: profile.perfectDay.morning,
      icon: '○', // abstract circle — dawn
      gradient: `linear-gradient(135deg, ${T.honey}04, white)`,
      accentColor: `${T.honey}50`,
    },
    {
      label: 'Afternoon', text: profile.perfectDay.afternoon,
      icon: '◐', // half circle — midday
      gradient: `linear-gradient(135deg, ${T.honey}08, white)`,
      accentColor: `${T.honey}80`,
    },
    {
      label: 'Evening', text: profile.perfectDay.evening,
      icon: '●', // full circle — evening
      gradient: `linear-gradient(135deg, ${T.honey}12, rgba(28,26,23,0.02))`,
      accentColor: T.honey,
    },
  ];

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <SectionLabel>Your perfect day</SectionLabel>
        <SafeFadeIn delay={0.2} direction="up" distance={16} duration={0.6}>
          <h2 style={{
            fontFamily: FONT.serif, fontSize: 26, fontStyle: 'italic',
            fontWeight: 400, color: 'var(--t-ink)',
            margin: '0 0 8px',
          }}>
            How a great day unfolds for you
          </h2>
        </SafeFadeIn>
        <GoldDivider width={36} delay={0.3} />
      </div>

      <div
        style={{
          maxWidth: 440, margin: '0 auto',
          display: 'flex', flexDirection: 'column', gap: 14,
          position: 'relative',
        }}
      >
        {/* Connecting line */}
        <div style={{
          position: 'absolute', left: 31, top: 36, bottom: 36,
          width: 1.5,
          background: `linear-gradient(to bottom, ${T.honey}15, ${T.honey}40, ${T.honey}15)`,
          pointerEvents: 'none',
        }} />

        {segments.map((seg, idx) => (
          <SafeFadeIn
            key={seg.label}
            delay={0.35 + idx * 0.15}
            direction="up"
            distance={16}
            duration={0.5}
          >
            <div
              style={{
                display: 'flex', gap: 20, alignItems: 'flex-start',
                padding: '22px 24px',
                borderRadius: 18,
                background: seg.gradient,
                border: `1px solid ${INK['04']}`,
                boxShadow: '0 1px 8px rgba(28,26,23,0.03)',
                position: 'relative',
              }}
            >
              {/* Time icon */}
              <div style={{
                width: 20, minWidth: 20, textAlign: 'center',
                fontSize: 14, color: seg.accentColor, marginTop: 1,
              }}>
                {seg.icon}
              </div>
              <div>
                <div style={{
                  fontFamily: FONT.sans, fontSize: 11, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: T.honey, marginBottom: 6,
                }}>
                  {seg.label}
                </div>
                <p style={{
                  fontFamily: FONT.sans, fontSize: 14, lineHeight: 1.7,
                  color: INK['80'], margin: 0,
                }}>
                  {seg.text}
                </p>
              </div>
            </div>
          </SafeFadeIn>
        ))}
      </div>
    </div>
  );
}


// ─── Card 7: How You Shift ───

function HowYouShiftReveal({ profile }: { profile: GeneratedTasteProfile }) {
  if (!profile.howYouShift?.length) return null;

  const accentColors = [T.honey, T.verde, '#6844a0'];
  const bgGradients = [
    `linear-gradient(135deg, ${T.honey}06, white)`,
    `linear-gradient(135deg, ${T.verde}06, white)`,
    `linear-gradient(135deg, #6844a008, white)`,
  ];

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <SectionLabel>How you shift</SectionLabel>
        <SafeFadeIn delay={0.2} direction="up" distance={16} duration={0.6}>
          <h2 style={{
            fontFamily: FONT.serif, fontSize: 26, fontStyle: 'italic',
            fontWeight: 400, color: 'var(--t-ink)',
            margin: '0 0 8px',
          }}>
            You&apos;re not the same traveler every time
          </h2>
        </SafeFadeIn>
        <GoldDivider width={36} delay={0.3} />
      </div>

      <div
        style={{ maxWidth: 440, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        {profile.howYouShift.map((shift, idx) => {
          const accent = accentColors[idx % accentColors.length];
          return (
            <SafeFadeIn
              key={shift.context}
              delay={0.35 + idx * 0.12}
              direction="up"
              distance={16}
              duration={0.5}
            >
              <div
                style={{
                  padding: '24px 28px', borderRadius: 18,
                  background: bgGradients[idx % bgGradients.length],
                  boxShadow: `0 2px 12px rgba(28,26,23,0.03)`,
                  border: `1px solid ${INK['04']}`,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Accent bar at top */}
                <div style={{
                  position: 'absolute', top: 0, left: 24, right: 24, height: 2,
                  background: `linear-gradient(90deg, ${accent}, transparent)`,
                  borderRadius: 1,
                }} />
                <div style={{
                  fontFamily: FONT.sans, fontSize: 13, fontWeight: 700,
                  color: 'var(--t-ink)', marginBottom: 8, marginTop: 4,
                }}>
                  {shift.context}
                </div>
                <p style={{
                  fontFamily: FONT.sans, fontSize: 14, lineHeight: 1.7,
                  color: INK['75'], margin: 0,
                }}>
                  {shift.insight}
                </p>
              </div>
            </SafeFadeIn>
          );
        })}
      </div>
    </div>
  );
}


// ─── Card 8: Taste Neighbors ───

function TasteNeighborsReveal({ profile }: { profile: GeneratedTasteProfile }) {
  if (!profile.tasteNeighbors) return null;
  const { nearbyArchetypes, distinction, rarityStat } = profile.tasteNeighbors;

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '55vh', textAlign: 'center',
        padding: '0 4px',
      }}
    >
      <SectionLabel>Your taste neighbors</SectionLabel>

      <SafeFadeIn delay={0.2} direction="up" distance={16} duration={0.6}>
        <h2 style={{
          fontFamily: FONT.serif, fontSize: 24, fontStyle: 'italic',
          fontWeight: 400, color: 'var(--t-ink)',
          margin: '0 0 24px',
        }}>
          Travelers with a similar lens
        </h2>
      </SafeFadeIn>

      {/* Nearby archetypes as pills */}
      <div
        style={{
          display: 'flex', flexWrap: 'wrap', gap: 10,
          justifyContent: 'center', marginBottom: 24,
        }}
      >
        {nearbyArchetypes.map((name, idx) => (
          <SafeFadeIn
            key={name}
            delay={0.35 + idx * 0.1}
            scale={0.8}
            direction="none"
            duration={0.5}
          >
            <span
              style={{
                fontFamily: FONT.serif, fontSize: 15, fontStyle: 'italic',
                color: 'var(--t-ink)',
                padding: '10px 22px', borderRadius: 100,
                background: 'white',
                border: `1px solid ${INK['06']}`,
                boxShadow: `0 2px 12px rgba(28,26,23,0.04), 0 1px 3px rgba(28,26,23,0.03)`,
                display: 'inline-block',
              }}
            >
              {name}
            </span>
          </SafeFadeIn>
        ))}
      </div>

      <GoldDivider width={30} delay={0.5} />

      {/* Distinction */}
      <SafeFadeIn delay={0.55} direction="up" distance={12} duration={0.5}>
        <p
          style={{
            fontFamily: FONT.sans, fontSize: 15, lineHeight: 1.7,
            color: INK['80'], maxWidth: 340, margin: '20px 0 24px',
          }}
        >
          {distinction}
        </p>
      </SafeFadeIn>

      {/* Rarity stat — as a standout badge */}
      <SafeFadeIn delay={0.65} scale={0.95} direction="up" distance={10} duration={0.5}>
        <div
          style={{
            padding: '16px 28px', borderRadius: 16,
            background: `linear-gradient(135deg, ${T.honey}06, ${T.honey}10)`,
            border: `1px solid ${T.honey}15`,
            maxWidth: 380,
          }}
        >
          <p style={{
            fontFamily: FONT.sans, fontSize: 13, lineHeight: 1.65,
            color: INK['70'], margin: 0, fontStyle: 'italic',
          }}>
            {rarityStat}
          </p>
        </div>
      </SafeFadeIn>
    </div>
  );
}


// ─── Card 9: Where You'd Thrive ───

function DestinationsReveal({ profile }: { profile: GeneratedTasteProfile }) {
  if (!profile.destinations) return null;
  const { familiar, surprise } = profile.destinations;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '55vh', textAlign: 'center',
    }}>
      <SectionLabel>Where you&apos;d thrive</SectionLabel>
      <SafeFadeIn delay={0.2} direction="up" distance={16} duration={0.6}>
        <h2 style={{
          fontFamily: FONT.serif, fontSize: 26, fontStyle: 'italic',
          fontWeight: 400, color: 'var(--t-ink)',
          margin: '0 0 8px',
        }}>
          Your signals point toward
        </h2>
      </SafeFadeIn>
      <GoldDivider width={36} delay={0.3} />

      {/* Familiar destinations */}
      <div
        style={{
          display: 'flex', flexDirection: 'column', gap: 10,
          marginTop: 24, marginBottom: 20, width: '100%', maxWidth: 380,
        }}
      >
        {familiar.map((dest, idx) => (
          <SafeFadeIn
            key={dest}
            delay={0.35 + idx * 0.12}
            direction="up"
            distance={10}
            duration={0.5}
          >
            <div
              style={{
                fontFamily: FONT.serif, fontSize: 18, fontStyle: 'italic',
                color: 'var(--t-ink)', padding: '16px 24px',
                borderRadius: 16,
                background: 'white',
                border: `1px solid ${INK['05']}`,
                boxShadow: `0 2px 12px rgba(28,26,23,0.03)`,
                display: 'flex', alignItems: 'center', gap: 12,
              }}
            >
              <div style={{
                width: 4, height: 28, borderRadius: 2,
                background: T.honey,
                flexShrink: 0,
              }} />
              {dest}
            </div>
          </SafeFadeIn>
        ))}
      </div>

      {/* Surprise destination */}
      <SafeFadeIn
        scale={0.95}
        delay={0.35 + familiar.length * 0.12}
        direction="up"
        distance={14}
        duration={0.6}
      >
        <div
          style={{
            width: '100%', maxWidth: 380,
            padding: '22px 24px', borderRadius: 18,
            background: `linear-gradient(135deg, ${T.honey}08, ${T.honey}14)`,
            border: `1px solid ${T.honey}25`,
            boxShadow: `0 4px 20px ${T.honey}08`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Sparkle accent */}
          <div style={{
            position: 'absolute', top: -20, right: -20,
            width: 80, height: 80, borderRadius: '50%',
            background: `radial-gradient(circle, ${T.honey}12 0%, transparent 70%)`,
            pointerEvents: 'none',
          }} />
          <div style={{
            fontFamily: FONT.sans, fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            color: T.honey, marginBottom: 8,
          }}>
            ✦ This one might surprise you
          </div>
          <div style={{
            fontFamily: FONT.serif, fontSize: 20, fontStyle: 'italic',
            color: 'var(--t-ink)', marginBottom: 8,
          }}>
            {surprise.name}
          </div>
          <p style={{
            fontFamily: FONT.sans, fontSize: 13, lineHeight: 1.65,
            color: INK['70'], margin: 0,
          }}>
            {surprise.reason}
          </p>
        </div>
      </SafeFadeIn>
    </div>
  );
}


// ─── Final: Your Trips ───

function SeedTripsReveal({ seedTrips }: { seedTrips: SeedTripInput[] }) {
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <SectionLabel>Already started</SectionLabel>
        <SafeFadeIn delay={0.2} direction="up" distance={16} duration={0.6}>
          <h2 style={{
            fontFamily: FONT.serif, fontSize: 26, fontStyle: 'italic',
            fontWeight: 400, color: 'var(--t-ink)',
            margin: '0 0 6px',
          }}>
            I&apos;ve started filling these in
          </h2>
        </SafeFadeIn>
        <SafeFadeIn delay={0.3} direction="up" distance={10} duration={0.5}>
          <p style={{
            fontFamily: FONT.sans, fontSize: 14, color: INK['60'],
            maxWidth: 320, margin: '0 auto 4px',
          }}>
            Take a look — tell me if I&apos;m on the right track.
          </p>
        </SafeFadeIn>
        <GoldDivider width={30} delay={0.35} />
      </div>

      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 440, margin: '0 auto' }}
      >
        {seedTrips.map((trip, i) => (
          <SafeFadeIn
            key={i}
            delay={0.4 + i * 0.12}
            direction="up"
            distance={16}
            duration={0.5}
          >
            <div
              style={{
                padding: '22px 24px', borderRadius: 18,
                background: 'white',
                boxShadow: '0 2px 12px rgba(28,26,23,0.04)',
                border: `1px solid ${INK['05']}`,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Subtle accent stripe */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                background: trip.status === 'planning'
                  ? `linear-gradient(90deg, ${T.verde}, transparent)`
                  : `linear-gradient(90deg, ${T.honey}, transparent)`,
              }} />

              <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: 8, marginTop: 4 }}>
                <div>
                  <div style={{
                    fontFamily: FONT.serif, fontSize: 18, fontStyle: 'italic',
                    color: 'var(--t-ink)',
                  }}>
                    {trip.destination}
                  </div>
                  {trip.dates && (
                    <div style={{
                      fontFamily: FONT.sans, fontSize: 12, color: INK['60'], marginTop: 3,
                    }}>
                      {trip.dates}
                    </div>
                  )}
                </div>
                <span style={{
                  fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
                  padding: '4px 12px', borderRadius: 100,
                  background: trip.status === 'planning'
                    ? `${T.verde}12`
                    : `${T.honey}12`,
                  color: trip.status === 'planning' ? T.verde : T.honey,
                }}>
                  {trip.status}
                </span>
              </div>
              <div style={{
                fontFamily: FONT.sans, fontSize: 12, color: INK['55'],
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span>{trip.travelContext}</span>
                <span style={{ color: INK['30'] }}>·</span>
                <span>{trip.seedSource === 'onboarding_planning' ? 'upcoming' : 'dream'}</span>
              </div>
            </div>
          </SafeFadeIn>
        ))}
      </div>
    </div>
  );
}
