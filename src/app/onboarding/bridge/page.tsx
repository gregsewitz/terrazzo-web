'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useTripStore } from '@/stores/tripStore';
import { FONT, TEXT, COLOR } from '@/constants/theme';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { getMatchTier } from '@/lib/match-tier';
import { completeBridge } from '@/lib/useBridgeGuard';
import { seedLibraryFromDiscover } from '@/lib/seed-library';
import { apiFetch } from '@/lib/api-client';
import type { DiscoverContent } from '@/hooks/useDiscoverFeed';
import type {
  BecauseYouCard,
  DeepMatch,
  MoodBoard,
} from '@/constants/discover';

// ─── Types ───────────────────────────────────────────────────────────────────

type BridgeScreen = 'ready' | 'flythrough' | 'firstmove';

interface BeatConfig {
  icon: 'discover' | 'saved' | 'plan' | 'sparkle';
  title: string;
  description: string;
  /** Gradient stops [from, to] for the beat background */
  gradient: [string, string];
  /** Accent color for visual elements within this beat */
  accent: string;
}

const BEAT_CONFIGS: BeatConfig[] = [
  {
    icon: 'discover',
    title: 'Discover',
    description: 'Places chosen for your taste — not algorithms, not ads.',
    gradient: ['rgba(58,128,136,0.06)', 'rgba(58,128,136,0.02)'],
    accent: COLOR.darkTeal,
  },
  {
    icon: 'saved',
    title: 'Collect',
    description: 'Save the places that speak to you. Build your personal library.',
    gradient: ['rgba(232,111,90,0.06)', 'rgba(232,111,90,0.02)'],
    accent: COLOR.coral,
  },
  {
    icon: 'plan',
    title: 'Add from anywhere',
    description: 'Paste a link, search by name, or import your Google Maps saves.',
    gradient: ['rgba(232,184,75,0.06)', 'rgba(232,184,75,0.02)'],
    accent: COLOR.ochre,
  },
  {
    icon: 'plan',
    title: 'Plan',
    description: 'Turn saved places into day-by-day itineraries that feel right.',
    gradient: ['rgba(107,124,78,0.06)', 'rgba(107,124,78,0.02)'],
    accent: COLOR.olive,
  },
  {
    icon: 'sparkle',
    title: 'Your taste, everywhere',
    description: 'Every recommendation is scored against your unique profile. Terrazzo learns as you go.',
    gradient: ['rgba(26,45,74,0.06)', 'rgba(26,45,74,0.02)'],
    accent: COLOR.navy,
  },
];

const BEAT_DURATION_MS = 5000;
const TOTAL_BEATS = BEAT_CONFIGS.length;

// ─── Slide transition variants ───────────────────────────────────────────────

const slideVariants = {
  enter: { x: 80, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -80, opacity: 0 },
};

const slideTiming = {
  duration: 0.5,
  ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Safely read discover cache from localStorage. */
function readDiscoverCache(archetype: string): DiscoverContent | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = `terrazzo_discover_${archetype}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DiscoverContent & { _cachedAt?: number };
    return parsed;
  } catch {
    return null;
  }
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function BridgePage() {
  const router = useRouter();
  const [screen, setScreen] = useState<BridgeScreen>('ready');
  const [step, setStep] = useState(0);

  const generatedProfile = useOnboardingStore((s) => s.generatedProfile);
  const lifeContext = useOnboardingStore((s) => s.lifeContext);
  const trips = useTripStore((s) => s.trips);

  // Pre-load discover cache for real content in flythrough
  const discoverContent = useMemo(
    () => readDiscoverCache(generatedProfile?.overallArchetype || ''),
    [generatedProfile?.overallArchetype],
  );

  // Auto-advance flythrough
  useEffect(() => {
    if (screen !== 'flythrough') return;

    const timer = setTimeout(() => {
      if (step < TOTAL_BEATS - 1) {
        setStep((s) => s + 1);
      } else {
        setScreen('firstmove');
      }
    }, BEAT_DURATION_MS);

    return () => clearTimeout(timer);
  }, [screen, step]);

  const advanceBeat = () => {
    if (step < TOTAL_BEATS - 1) {
      setStep((s) => s + 1);
    } else {
      setScreen('firstmove');
    }
  };

  const handleNavigateFromFirstMove = (destination: string) => {
    completeBridge();

    // Fire and forget — don't block navigation on seeding
    const archetype = generatedProfile?.overallArchetype || 'You';
    seedLibraryFromDiscover(archetype).catch(() => {});

    // Seed trip suggestions for any dream destination trips
    const currentTrips = useTripStore.getState().trips;
    for (const trip of currentTrips) {
      if (trip.status === 'planning' && trip.location) {
        apiFetch('/api/onboarding/seed-trip-suggestions', {
          method: 'POST',
          body: JSON.stringify({ tripId: trip.id, destination: trip.location }),
        }).catch(() => {});
      }
    }

    router.push(destination);
  };

  if (!generatedProfile) return null;

  return (
    <div className="h-dvh overflow-hidden" style={{ background: 'var(--t-cream)' }}>
      <AnimatePresence mode="wait">
        {screen === 'ready' && (
          <ReadyScreen
            key="ready"
            generatedProfile={generatedProfile}
            onContinue={() => setScreen('flythrough')}
          />
        )}

        {screen === 'flythrough' && (
          <FlythroughScreen
            key="flythrough"
            step={step}
            discoverContent={discoverContent}
            generatedProfile={generatedProfile}
            onTap={advanceBeat}
            onSkip={() => setScreen('firstmove')}
          />
        )}

        {screen === 'firstmove' && (
          <FirstMoveScreen
            key="firstmove"
            trips={trips}
            lifeContext={lifeContext}
            archetypeName={generatedProfile.overallArchetype}
            onNavigate={handleNavigateFromFirstMove}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Screen 1: Your Terrazzo is Ready ────────────────────────────────────────

interface ReadyScreenProps {
  generatedProfile: {
    overallArchetype: string;
    archetypeDescription: string;
    emotionalDriver?: { primary: string; description: string };
  };
  onContinue: () => void;
}

function ReadyScreen({ generatedProfile, onContinue }: ReadyScreenProps) {
  const firstSentence = generatedProfile.archetypeDescription.split('.')[0] + '.';

  return (
    <motion.div
      key="ready-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.5 }}
      className="h-dvh w-full flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--t-cream)' }}
    >
      <div className="max-w-md w-full text-center" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {/* Archetype name — large, quiet serif */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          style={{
            fontFamily: FONT.serif,
            fontSize: 44,
            fontWeight: 300,
            fontStyle: 'italic',
            color: TEXT.primary,
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          {generatedProfile.overallArchetype}
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          style={{
            fontFamily: FONT.sans,
            fontSize: 15,
            color: TEXT.secondary,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {firstSentence}
        </motion.p>

        {/* Thin separator */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 0.4, scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          style={{
            width: 40,
            height: 1,
            backgroundColor: TEXT.secondary,
            margin: '0 auto',
          }}
        />

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.55 }}
          style={{
            fontFamily: FONT.mono,
            fontSize: 12,
            color: TEXT.tertiary,
            letterSpacing: 0.4,
            margin: 0,
          }}
        >
          Your taste, mapped. Here&apos;s how Terrazzo works.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.65 }}
        >
          <motion.button
            onClick={onContinue}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            style={{
              width: '100%',
              padding: '16px 32px',
              borderRadius: 14,
              border: 'none',
              backgroundColor: COLOR.navy,
              color: 'white',
              fontFamily: FONT.sans,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: 0.2,
            }}
          >
            See how it works
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Screen 2: Flythrough ────────────────────────────────────────────────────

interface FlythroughScreenProps {
  step: number;
  discoverContent: DiscoverContent | null;
  generatedProfile: {
    overallArchetype: string;
    radarData?: { axis: string; value: number }[];
    perfectDay?: { morning: string; afternoon: string; evening: string };
    matchedProperties?: {
      name: string;
      location: string;
      score: number;
      matchReasons: string[];
    }[];
  };
  onTap: () => void;
  onSkip: () => void;
}

function FlythroughScreen({
  step,
  discoverContent,
  generatedProfile,
  onTap,
  onSkip,
}: FlythroughScreenProps) {
  const beat = BEAT_CONFIGS[step];
  if (!beat) return null;

  return (
    <motion.div
      key="flythrough-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="h-dvh w-full relative overflow-hidden"
      style={{ background: 'var(--t-cream)' }}
    >
      {/* Animated background gradient — shifts per beat */}
      <motion.div
        key={`bg-${step}`}
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8 }}
        style={{
          background: `linear-gradient(175deg, ${beat.gradient[0]} 0%, ${beat.gradient[1]} 60%, var(--t-cream) 100%)`,
        }}
      />

      {/* Skip */}
      <button
        onClick={onSkip}
        style={{
          position: 'absolute',
          top: 20,
          right: 24,
          zIndex: 10,
          background: 'none',
          border: 'none',
          fontFamily: FONT.mono,
          fontSize: 12,
          color: TEXT.tertiary,
          cursor: 'pointer',
          letterSpacing: 0.3,
          padding: '8px 0',
        }}
      >
        Skip
      </button>

      {/* Beat content — tappable area */}
      <div
        onClick={onTap}
        className="h-full w-full flex flex-col items-center justify-center relative"
        style={{ cursor: 'pointer', zIndex: 5, padding: '0 24px' }}
      >
        <div style={{ maxWidth: 400, width: '100%' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={`beat-${step}`}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={slideTiming}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 24,
              }}
            >
              {/* Icon */}
              <div style={{ marginBottom: 8 }}>
                {beat.icon === 'plan' && step === 2 ? (
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      backgroundColor: beat.accent,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 24,
                        color: 'white',
                        fontWeight: 300,
                        lineHeight: 1,
                      }}
                    >
                      +
                    </span>
                  </div>
                ) : (
                  <PerriandIcon name={beat.icon} size={48} color={beat.accent} />
                )}
              </div>

              {/* Title */}
              <h2
                style={{
                  fontFamily: FONT.serif,
                  fontSize: 32,
                  fontWeight: 300,
                  fontStyle: 'italic',
                  color: TEXT.primary,
                  margin: 0,
                  textAlign: 'center',
                  lineHeight: 1.15,
                }}
              >
                {beat.title}
              </h2>

              {/* Description */}
              <p
                style={{
                  fontFamily: FONT.sans,
                  fontSize: 15,
                  color: TEXT.secondary,
                  margin: 0,
                  textAlign: 'center',
                  lineHeight: 1.55,
                  maxWidth: 320,
                }}
              >
                {beat.description}
              </p>

              {/* Real content visual */}
              <div style={{ width: '100%', marginTop: 8 }}>
                {step === 0 && (
                  <DiscoverVisual
                    cards={discoverContent?.becauseYouCards}
                    accent={beat.accent}
                  />
                )}
                {step === 1 && (
                  <CollectVisual
                    matched={generatedProfile.matchedProperties}
                    accent={beat.accent}
                  />
                )}
                {step === 2 && (
                  <AddVisual accent={beat.accent} />
                )}
                {step === 3 && (
                  <PlanVisual
                    perfectDay={generatedProfile.perfectDay}
                    accent={beat.accent}
                  />
                )}
                {step === 4 && (
                  <TasteVisual
                    radarData={generatedProfile.radarData}
                    deepMatch={discoverContent?.deepMatch}
                    accent={beat.accent}
                  />
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Tap hint — only on first beat */}
          {step === 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ delay: 2, duration: 0.6 }}
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                color: TEXT.tertiary,
                textAlign: 'center',
                marginTop: 32,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              Tap to continue
            </motion.p>
          )}
        </div>
      </div>

      {/* Progress bar at bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 32,
          left: 24,
          right: 24,
          zIndex: 10,
          display: 'flex',
          gap: 6,
        }}
      >
        {BEAT_CONFIGS.map((_, idx) => (
          <div
            key={idx}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: 'rgba(0,42,85,0.08)',
              overflow: 'hidden',
            }}
          >
            {idx < step && (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: 'rgba(0,42,85,0.25)',
                  borderRadius: 2,
                }}
              />
            )}
            {idx === step && (
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: BEAT_DURATION_MS / 1000, ease: 'linear' }}
                style={{
                  height: '100%',
                  backgroundColor: beat.accent,
                  borderRadius: 2,
                }}
              />
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Flythrough Visuals (Real Content) ───────────────────────────────────────

/** Beat 0: Discover — shows actual BecauseYou place cards from the cached feed */
function DiscoverVisual({
  cards,
  accent,
}: {
  cards?: BecauseYouCard[];
  accent: string;
}) {
  const displayCards = (cards || []).slice(0, 3);
  if (displayCards.length === 0) {
    // Fallback if cache isn't ready
    return (
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <PlaceholderCard key={i} delay={i * 0.1} accent={accent} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
      {displayCards.map((card, i) => {
        const tier = getMatchTier(card.score);
        return (
          <motion.div
            key={card.place}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 + i * 0.12, duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            style={{
              flex: 1,
              maxWidth: 130,
              padding: '14px 12px',
              borderRadius: 12,
              backgroundColor: 'white',
              border: '1px solid rgba(0,42,85,0.06)',
              boxShadow: '0 2px 8px rgba(0,42,85,0.04)',
            }}
          >
            {/* Signal tag */}
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: accent,
                marginBottom: 8,
                lineHeight: 1.3,
              }}
            >
              {card.signal?.split('(')[0]?.trim() || card.signalDomain}
            </div>
            {/* Place name */}
            <div
              style={{
                fontFamily: FONT.sans,
                fontSize: 12,
                fontWeight: 600,
                color: TEXT.primary,
                marginBottom: 4,
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {card.place}
            </div>
            {/* Location */}
            <div
              style={{
                fontFamily: FONT.sans,
                fontSize: 10,
                color: TEXT.tertiary,
                marginBottom: 8,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {card.location}
            </div>
            {/* Tier badge */}
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 9,
                fontWeight: 700,
                color: tier.color,
                backgroundColor: tier.bg,
                padding: '3px 6px',
                borderRadius: 4,
                display: 'inline-block',
                letterSpacing: 0.2,
              }}
            >
              {tier.shortLabel}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/** Beat 1: Collect — shows matched properties as stacked collection cards */
function CollectVisual({
  matched,
  accent,
}: {
  matched?: {
    name: string;
    location: string;
    score: number;
    matchReasons: string[];
  }[];
  accent: string;
}) {
  const places = (matched || []).slice(0, 3);
  if (places.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <PlaceholderStack accent={accent} />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        position: 'relative',
        height: 130,
      }}
    >
      {places.map((p, i) => (
        <motion.div
          key={p.name}
          initial={{ opacity: 0, y: 20, rotate: -6 + i * 6 }}
          animate={{
            opacity: 1,
            y: i * 8,
            rotate: -6 + i * 6,
          }}
          transition={{
            delay: 0.35 + i * 0.15,
            duration: 0.6,
            ease: [0.32, 0.72, 0, 1],
          }}
          style={{
            position: 'absolute',
            width: 180,
            padding: '12px 14px',
            borderRadius: 10,
            backgroundColor: 'white',
            border: '1px solid rgba(0,42,85,0.06)',
            boxShadow: '0 2px 12px rgba(0,42,85,0.05)',
            zIndex: i + 1,
          }}
        >
          <div
            style={{
              fontFamily: FONT.sans,
              fontSize: 12,
              fontWeight: 600,
              color: TEXT.primary,
              marginBottom: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {p.name}
          </div>
          <div
            style={{
              fontFamily: FONT.sans,
              fontSize: 10,
              color: TEXT.tertiary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {p.location}
          </div>
          {/* Bookmark icon hint */}
          <div style={{ position: 'absolute', top: 10, right: 10 }}>
            <PerriandIcon name="saved" size={14} color={accent} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/** Beat 2: Add — animated import sources fanning out from center + */
function AddVisual({ accent }: { accent: string }) {
  const sources = [
    { label: 'Paste a link', icon: 'article' as const },
    { label: 'Google Maps', icon: 'maps' as const },
    { label: 'Search', icon: 'discover' as const },
  ];

  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
      {sources.map((src, i) => (
        <motion.div
          key={src.label}
          initial={{ opacity: 0, y: 16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            delay: 0.35 + i * 0.12,
            duration: 0.5,
            ease: [0.32, 0.72, 0, 1],
          }}
          style={{
            flex: 1,
            maxWidth: 120,
            padding: '16px 10px',
            borderRadius: 12,
            backgroundColor: 'white',
            border: '1px solid rgba(0,42,85,0.06)',
            boxShadow: '0 2px 8px rgba(0,42,85,0.04)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <PerriandIcon name={src.icon} size={20} color={accent} />
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 9,
              color: TEXT.secondary,
              letterSpacing: 0.2,
              textAlign: 'center',
            }}
          >
            {src.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

/** Beat 3: Plan — uses perfectDay data if available, otherwise elegant fallback */
function PlanVisual({
  perfectDay,
  accent,
}: {
  perfectDay?: { morning: string; afternoon: string; evening: string };
  accent: string;
}) {
  const slots = [
    { label: 'Morning', content: perfectDay?.morning },
    { label: 'Afternoon', content: perfectDay?.afternoon },
    { label: 'Evening', content: perfectDay?.evening },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {slots.map((slot, i) => (
        <motion.div
          key={slot.label}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            delay: 0.35 + i * 0.12,
            duration: 0.5,
            ease: [0.32, 0.72, 0, 1],
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 14px',
            borderRadius: 10,
            backgroundColor: 'white',
            border: '1px solid rgba(0,42,85,0.06)',
            boxShadow: '0 1px 4px rgba(0,42,85,0.03)',
          }}
        >
          {/* Time slot label */}
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 9,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: accent,
              width: 64,
              flexShrink: 0,
            }}
          >
            {slot.label}
          </div>
          {/* Content */}
          <div
            style={{
              fontFamily: FONT.sans,
              fontSize: 12,
              color: slot.content ? TEXT.primary : TEXT.tertiary,
              lineHeight: 1.4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {slot.content || 'Drag a saved place here'}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/** Beat 4: Taste — shows radar data visualization + deep match */
function TasteVisual({
  radarData,
  deepMatch,
  accent,
}: {
  radarData?: { axis: string; value: number }[];
  deepMatch?: DeepMatch;
  accent: string;
}) {
  // Show top 4 taste domains as horizontal bars
  const topDomains = (radarData || [])
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Taste domain bars */}
      {topDomains.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          style={{
            padding: '14px 16px',
            borderRadius: 12,
            backgroundColor: 'white',
            border: '1px solid rgba(0,42,85,0.06)',
            boxShadow: '0 2px 8px rgba(0,42,85,0.04)',
          }}
        >
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: TEXT.tertiary,
              marginBottom: 12,
            }}
          >
            Your taste profile
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topDomains.map((d, i) => (
              <div key={d.axis} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    fontFamily: FONT.sans,
                    fontSize: 11,
                    color: TEXT.secondary,
                    width: 72,
                    flexShrink: 0,
                  }}
                >
                  {d.axis}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: 'rgba(0,42,85,0.05)',
                    overflow: 'hidden',
                  }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(d.value * 100)}%` }}
                    transition={{
                      delay: 0.5 + i * 0.1,
                      duration: 0.8,
                      ease: [0.32, 0.72, 0, 1],
                    }}
                    style={{
                      height: '100%',
                      borderRadius: 3,
                      backgroundColor: accent,
                      opacity: 1 - i * 0.15,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Deep match card if available */}
      {deepMatch && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          style={{
            padding: '14px 16px',
            borderRadius: 12,
            backgroundColor: COLOR.navy,
            boxShadow: '0 4px 16px rgba(0,42,85,0.15)',
          }}
        >
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: COLOR.ochre,
              marginBottom: 6,
            }}
          >
            Deep match
          </div>
          <div
            style={{
              fontFamily: FONT.sans,
              fontSize: 14,
              fontWeight: 600,
              color: 'white',
              marginBottom: 2,
            }}
          >
            {deepMatch.name}
          </div>
          <div
            style={{
              fontFamily: FONT.sans,
              fontSize: 11,
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            {deepMatch.location}
          </div>
        </motion.div>
      )}
    </div>
  );
}

/** Placeholder shimmer card when no real data is available */
function PlaceholderCard({ delay, accent }: { delay: number; accent: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 + delay, duration: 0.5 }}
      style={{
        width: 110,
        padding: '14px 12px',
        borderRadius: 12,
        backgroundColor: 'white',
        border: '1px solid rgba(0,42,85,0.06)',
      }}
    >
      <div
        style={{
          width: '60%',
          height: 6,
          borderRadius: 3,
          backgroundColor: `${accent}20`,
          marginBottom: 10,
        }}
      />
      <div
        style={{
          width: '80%',
          height: 8,
          borderRadius: 4,
          backgroundColor: 'rgba(0,42,85,0.06)',
          marginBottom: 6,
        }}
      />
      <div
        style={{
          width: '50%',
          height: 6,
          borderRadius: 3,
          backgroundColor: 'rgba(0,42,85,0.04)',
        }}
      />
    </motion.div>
  );
}

/** Placeholder stack for collect visual */
function PlaceholderStack({ accent }: { accent: string }) {
  return (
    <div style={{ position: 'relative', height: 110, width: 180 }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: i * 8, rotate: -6 + i * 6 }}
          transition={{ delay: 0.35 + i * 0.15, duration: 0.6 }}
          style={{
            position: 'absolute',
            width: 180,
            height: 52,
            borderRadius: 10,
            backgroundColor: 'white',
            border: '1px solid rgba(0,42,85,0.06)',
            padding: '10px 14px',
            zIndex: i + 1,
          }}
        >
          <div
            style={{
              width: '70%',
              height: 8,
              borderRadius: 4,
              backgroundColor: 'rgba(0,42,85,0.06)',
              marginBottom: 6,
            }}
          />
          <div
            style={{
              width: '45%',
              height: 6,
              borderRadius: 3,
              backgroundColor: 'rgba(0,42,85,0.04)',
            }}
          />
        </motion.div>
      ))}
    </div>
  );
}

// ─── Screen 3: Your First Move ───────────────────────────────────────────────

interface FirstMoveScreenProps {
  trips: { id: string; name: string; status?: string; location?: string; destinations?: unknown[] }[];
  lifeContext: {
    dreamDestinations?: { name: string; confidence: number }[];
  } | null;
  archetypeName: string;
  onNavigate: (destination: string) => void;
}

function FirstMoveScreen({
  trips,
  lifeContext,
  archetypeName,
  onNavigate,
}: FirstMoveScreenProps) {
  let cta = 'See what we found for you';
  let destination = '/discover';

  if (trips && trips.length > 0) {
    const firstTrip = trips[0];
    if (firstTrip.destinations && firstTrip.destinations.length > 0) {
      cta = `Start planning ${firstTrip.name}`;
      destination = `/trips/${firstTrip.id}`;
    }
  } else if (
    lifeContext?.dreamDestinations &&
    lifeContext.dreamDestinations.length > 0
  ) {
    const topDest = [...lifeContext.dreamDestinations].sort(
      (a, b) => b.confidence - a.confidence,
    )[0];
    cta = `Explore places in ${topDest.name}`;
    destination = '/discover';
  }

  return (
    <motion.div
      key="firstmove-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="h-dvh w-full flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--t-cream)' }}
    >
      <div
        className="max-w-md w-full text-center"
        style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        {/* Archetype callback */}
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            fontFamily: FONT.serif,
            fontSize: 13,
            color: TEXT.tertiary,
            fontStyle: 'italic',
            margin: 0,
          }}
        >
          {archetypeName}
        </motion.p>

        {/* CTA headline */}
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{
            fontFamily: FONT.serif,
            fontSize: 30,
            fontWeight: 300,
            fontStyle: 'italic',
            color: TEXT.primary,
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {cta}
        </motion.h2>

        {/* Main CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <motion.button
            onClick={() => onNavigate(destination)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            style={{
              width: '100%',
              padding: '16px 32px',
              borderRadius: 14,
              border: 'none',
              backgroundColor: COLOR.navy,
              color: 'white',
              fontFamily: FONT.sans,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: 0.2,
            }}
          >
            Let&apos;s go
          </motion.button>
        </motion.div>

        {/* Secondary link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <button
            onClick={() => onNavigate('/discover')}
            style={{
              background: 'none',
              border: 'none',
              fontFamily: FONT.mono,
              fontSize: 12,
              color: TEXT.tertiary,
              cursor: 'pointer',
              letterSpacing: 0.3,
              padding: 0,
            }}
          >
            or explore on your own
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
