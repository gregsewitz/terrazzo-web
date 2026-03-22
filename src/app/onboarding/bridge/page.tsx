'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useTripStore } from '@/stores/tripStore';
import { FONT, TEXT, COLOR } from '@/constants/theme';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { getMatchTier, getMatchTierByLabel } from '@/lib/match-tier';
import { completeBridge } from '@/lib/useBridgeGuard';
import { seedLibraryFromDiscover } from '@/lib/seed-library';
import { apiFetch } from '@/lib/api-client';
import type { DiscoverContent } from '@/hooks/useDiscoverFeed';
import type {
  BecauseYouCard,
  DeepMatch,
} from '@/constants/discover';

// ─── Types ───────────────────────────────────────────────────────────────────

type BridgeScreen = 'ready' | 'flythrough' | 'firstmove';

interface BeatTheme {
  icon: 'discover' | 'saved' | 'plan' | 'sparkle';
  title: string;
  gradient: [string, string];
  accent: string;
}

/** Static theme per beat — descriptions are generated dynamically from profile data */
const BEAT_THEMES: BeatTheme[] = [
  {
    icon: 'discover',
    title: 'Discover',
    gradient: ['rgba(58,128,136,0.06)', 'rgba(58,128,136,0.02)'],
    accent: COLOR.darkTeal,
  },
  {
    icon: 'saved',
    title: 'Collect',
    gradient: ['rgba(232,111,90,0.06)', 'rgba(232,111,90,0.02)'],
    accent: COLOR.coral,
  },
  {
    icon: 'plan',
    title: 'Add from anywhere',
    gradient: ['rgba(232,184,75,0.06)', 'rgba(232,184,75,0.02)'],
    accent: COLOR.ochre,
  },
  {
    icon: 'plan',
    title: 'Plan',
    gradient: ['rgba(107,124,78,0.06)', 'rgba(107,124,78,0.02)'],
    accent: COLOR.olive,
  },
  {
    icon: 'sparkle',
    title: 'Your taste, everywhere',
    gradient: ['rgba(26,45,74,0.06)', 'rgba(26,45,74,0.02)'],
    accent: COLOR.navy,
  },
];

const BEAT_DURATION_MS = 5000;
const TOTAL_BEATS = BEAT_THEMES.length;

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

/** Safely read discover cache from localStorage (ignores TTL — we want data even if stale). */
function readDiscoverCache(archetype: string): DiscoverContent | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = `terrazzo_discover_${archetype}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as DiscoverContent;
  } catch {
    return null;
  }
}

/**
 * Build personalized description text for each beat.
 * Uses actual profile data so the copy is unmistakably about THIS user.
 */
function buildBeatDescriptions(profile: {
  overallArchetype: string;
  radarData?: { axis: string; value: number }[];
  matchedProperties?: { name: string; score: number }[];
  microTasteSignals?: Record<string, string[]>;
  contradictions?: { stated: string; revealed: string }[];
}, discover: DiscoverContent | null, dreamDestinations?: { name: string }[]): string[] {
  // Beat 0: Discover — reference a real signal or contradiction
  let discoverDesc = 'Places chosen for your taste — not algorithms, not ads.';
  const firstCard = discover?.becauseYouCards?.[0];
  if (firstCard?.signal) {
    const signal = firstCard.signal.split('(')[0]?.trim();
    discoverDesc = `Because you value ${signal.toLowerCase()}, we found places that match — not algorithms, not ads.`;
  } else if (profile.contradictions && profile.contradictions.length > 0) {
    const c = profile.contradictions[0];
    discoverDesc = `You love both ${c.stated.toLowerCase()} and ${c.revealed.toLowerCase()}. We find places that honor both.`;
  } else {
    // Reference top taste domain
    const topDomain = (profile.radarData || []).sort((a, b) => b.value - a.value)[0];
    if (topDomain) {
      discoverDesc = `Tuned to your ${topDomain.axis.toLowerCase()} sensibility — not algorithms, not ads.`;
    }
  }

  // Beat 1: Collect — mention how many matches were found
  let collectDesc = 'Save the places that speak to you. Build your personal library.';
  const matchCount = profile.matchedProperties?.length || 0;
  if (matchCount > 0) {
    const topMatch = profile.matchedProperties![0];
    const tier = getMatchTier(topMatch.score);
    collectDesc = `We found ${matchCount} matches for ${profile.overallArchetype}. Save your favorites, like ${topMatch.name} (${tier.label.toLowerCase()}).`;
  }

  // Beat 2: Add — static but mention import breadth
  const addDesc = 'Paste an article link, search by name, or import your Google Maps saves. All in one place.';

  // Beat 3: Plan — mention dream destinations if available
  let planDesc = 'Turn saved places into day-by-day itineraries that feel right.';
  if (dreamDestinations && dreamDestinations.length > 0) {
    const destNames = dreamDestinations.slice(0, 2).map((d) => d.name);
    if (destNames.length === 1) {
      planDesc = `Build your ${destNames[0]} itinerary day by day — morning, afternoon, evening.`;
    } else {
      planDesc = `Build itineraries for ${destNames.join(' and ')} — day by day, morning to evening.`;
    }
  }

  // Beat 4: Taste — reference the archetype
  const tasteDesc = `Every recommendation is scored against ${profile.overallArchetype}. The more you use Terrazzo, the sharper it gets.`;

  return [discoverDesc, collectDesc, addDesc, planDesc, tasteDesc];
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

  // Build personalized descriptions
  const beatDescriptions = useMemo(
    () =>
      generatedProfile
        ? buildBeatDescriptions(
            generatedProfile,
            discoverContent,
            lifeContext?.dreamDestinations,
          )
        : BEAT_THEMES.map(() => ''),
    [generatedProfile, discoverContent, lifeContext?.dreamDestinations],
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
            matchCount={generatedProfile.matchedProperties?.length || 0}
            onContinue={() => setScreen('flythrough')}
          />
        )}

        {screen === 'flythrough' && (
          <FlythroughScreen
            key="flythrough"
            step={step}
            beatDescriptions={beatDescriptions}
            discoverContent={discoverContent}
            generatedProfile={generatedProfile}
            dreamDestinations={lifeContext?.dreamDestinations}
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
  matchCount: number;
  onContinue: () => void;
}

function ReadyScreen({ generatedProfile, matchCount, onContinue }: ReadyScreenProps) {
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
        {/* Archetype name */}
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

        {/* Match count callout — real number */}
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
          {matchCount > 0
            ? `${matchCount} places matched to your taste. Here's how it works.`
            : 'Your taste, mapped. Here\u2019s how Terrazzo works.'}
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
  beatDescriptions: string[];
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
  dreamDestinations?: { name: string; confidence: number }[];
  onTap: () => void;
  onSkip: () => void;
}

function FlythroughScreen({
  step,
  beatDescriptions,
  discoverContent,
  generatedProfile,
  dreamDestinations,
  onTap,
  onSkip,
}: FlythroughScreenProps) {
  const beat = BEAT_THEMES[step];
  if (!beat) return null;

  const description = beatDescriptions[step] || '';

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
      {/* Animated background gradient */}
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
                    <span style={{ fontSize: 24, color: 'white', fontWeight: 300, lineHeight: 1 }}>
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

              {/* Personalized description */}
              <p
                style={{
                  fontFamily: FONT.sans,
                  fontSize: 15,
                  color: TEXT.secondary,
                  margin: 0,
                  textAlign: 'center',
                  lineHeight: 1.55,
                  maxWidth: 340,
                }}
              >
                {description}
              </p>

              {/* Real content visual */}
              <div style={{ width: '100%', marginTop: 8 }}>
                {step === 0 && (
                  <DiscoverVisual
                    cards={discoverContent?.becauseYouCards}
                    matchedProperties={generatedProfile.matchedProperties}
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
                    dreamDestination={dreamDestinations?.[0]?.name}
                    accent={beat.accent}
                  />
                )}
                {step === 4 && (
                  <TasteVisual
                    radarData={generatedProfile.radarData}
                    deepMatch={discoverContent?.deepMatch}
                    archetype={generatedProfile.overallArchetype}
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

      {/* Progress bar */}
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
        {BEAT_THEMES.map((_, idx) => (
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
                key={`progress-${step}`}
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

/**
 * Beat 0: Discover — shows real place cards.
 * Primary source: BecauseYouCards from discover cache.
 * Fallback: matchedProperties from profile (always available after onboarding).
 */
function DiscoverVisual({
  cards,
  matchedProperties,
  accent,
}: {
  cards?: BecauseYouCard[];
  matchedProperties?: { name: string; location: string; score: number; matchReasons: string[] }[];
  accent: string;
}) {
  // Try discover cache first, fall back to matchedProperties
  const fromCache = (cards || []).slice(0, 3);
  const fromProfile = (matchedProperties || []).slice(0, 3);

  if (fromCache.length > 0) {
    return (
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {fromCache.map((card, i) => {
          const tier = getMatchTierByLabel(card.matchTier);
          return (
            <motion.div
              key={card.place}
              initial={{ opacity: 0, y: 14 }}
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
              {/* "Because you..." tag */}
              <div style={{
                fontFamily: FONT.mono,
                fontSize: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: accent,
                marginBottom: 8,
                lineHeight: 1.3,
              }}>
                {card.signal
                  ? `Because: ${card.signal.split('(')[0]?.trim()}`
                  : card.signalDomain}
              </div>
              {/* Place name */}
              <div style={{
                fontFamily: FONT.sans,
                fontSize: 12,
                fontWeight: 600,
                color: TEXT.primary,
                marginBottom: 3,
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {card.place}
              </div>
              {/* Location */}
              <div style={{
                fontFamily: FONT.sans,
                fontSize: 10,
                color: TEXT.tertiary,
                marginBottom: 8,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {card.location}
              </div>
              {/* Tier badge */}
              <div style={{
                fontFamily: FONT.mono,
                fontSize: 9,
                fontWeight: 700,
                color: tier.color,
                backgroundColor: tier.bg,
                padding: '3px 6px',
                borderRadius: 4,
                display: 'inline-block',
                letterSpacing: 0.2,
              }}>
                {tier.shortLabel}
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  }

  // Fallback: use matchedProperties (always populated after onboarding)
  if (fromProfile.length > 0) {
    return (
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {fromProfile.map((mp, i) => {
          const tier = getMatchTier(mp.score);
          return (
            <motion.div
              key={mp.name}
              initial={{ opacity: 0, y: 14 }}
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
              {/* Match reason */}
              <div style={{
                fontFamily: FONT.mono,
                fontSize: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: accent,
                marginBottom: 8,
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {mp.matchReasons?.[0] || 'Matched for you'}
              </div>
              {/* Place name */}
              <div style={{
                fontFamily: FONT.sans,
                fontSize: 12,
                fontWeight: 600,
                color: TEXT.primary,
                marginBottom: 3,
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {mp.name}
              </div>
              {/* Location */}
              <div style={{
                fontFamily: FONT.sans,
                fontSize: 10,
                color: TEXT.tertiary,
                marginBottom: 8,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {mp.location}
              </div>
              {/* Tier badge */}
              <div style={{
                fontFamily: FONT.mono,
                fontSize: 9,
                fontWeight: 700,
                color: tier.color,
                backgroundColor: tier.bg,
                padding: '3px 6px',
                borderRadius: 4,
                display: 'inline-block',
                letterSpacing: 0.2,
              }}>
                {tier.shortLabel}
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  }

  // Last resort: should rarely hit this
  return null;
}

/** Beat 1: Collect — matched properties with tier badges and match reasons */
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
  if (places.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        position: 'relative',
        height: 150,
      }}
    >
      {places.map((p, i) => {
        const tier = getMatchTier(p.score);
        return (
          <motion.div
            key={p.name}
            initial={{ opacity: 0, y: 20, rotate: -6 + i * 6 }}
            animate={{
              opacity: 1,
              y: i * 10,
              rotate: -6 + i * 6,
            }}
            transition={{
              delay: 0.35 + i * 0.15,
              duration: 0.6,
              ease: [0.32, 0.72, 0, 1],
            }}
            style={{
              position: 'absolute',
              width: 220,
              padding: '12px 14px',
              borderRadius: 10,
              backgroundColor: 'white',
              border: '1px solid rgba(0,42,85,0.06)',
              boxShadow: '0 2px 12px rgba(0,42,85,0.05)',
              zIndex: i + 1,
            }}
          >
            {/* Place name + location */}
            <div style={{
              fontFamily: FONT.sans,
              fontSize: 13,
              fontWeight: 600,
              color: TEXT.primary,
              marginBottom: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              paddingRight: 60,
            }}>
              {p.name}
            </div>
            <div style={{
              fontFamily: FONT.sans,
              fontSize: 10,
              color: TEXT.tertiary,
              marginBottom: 6,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {p.location}
            </div>
            {/* Match reason */}
            {p.matchReasons?.[0] && (
              <div style={{
                fontFamily: FONT.mono,
                fontSize: 8,
                color: TEXT.tertiary,
                letterSpacing: 0.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {p.matchReasons[0]}
              </div>
            )}
            {/* Tier badge — top right */}
            <div style={{
              position: 'absolute',
              top: 12,
              right: 12,
              fontFamily: FONT.mono,
              fontSize: 8,
              fontWeight: 700,
              color: tier.color,
              backgroundColor: tier.bg,
              padding: '2px 6px',
              borderRadius: 4,
              letterSpacing: 0.2,
            }}>
              {tier.shortLabel}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/** Beat 2: Add — animated import source cards */
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
          <span style={{
            fontFamily: FONT.mono,
            fontSize: 9,
            color: TEXT.secondary,
            letterSpacing: 0.2,
            textAlign: 'center',
          }}>
            {src.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

/** Beat 3: Plan — uses perfectDay data + dream destination label */
function PlanVisual({
  perfectDay,
  dreamDestination,
  accent,
}: {
  perfectDay?: { morning: string; afternoon: string; evening: string };
  dreamDestination?: string;
  accent: string;
}) {
  const slots = [
    { label: 'Morning', content: perfectDay?.morning },
    { label: 'Afternoon', content: perfectDay?.afternoon },
    { label: 'Evening', content: perfectDay?.evening },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Destination header if available */}
      {dreamDestination && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          style={{
            fontFamily: FONT.mono,
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: accent,
            textAlign: 'center',
            marginBottom: 4,
          }}
        >
          Your perfect day in {dreamDestination}
        </motion.div>
      )}
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
          <div style={{
            fontFamily: FONT.mono,
            fontSize: 9,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: accent,
            width: 64,
            flexShrink: 0,
          }}>
            {slot.label}
          </div>
          <div style={{
            fontFamily: FONT.sans,
            fontSize: 12,
            color: slot.content ? TEXT.primary : TEXT.tertiary,
            fontStyle: slot.content ? 'normal' : 'italic',
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {slot.content || 'Drag a saved place here'}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/** Beat 4: Taste — radar bars labeled with archetype + deep match card */
function TasteVisual({
  radarData,
  deepMatch,
  archetype,
  accent,
}: {
  radarData?: { axis: string; value: number }[];
  deepMatch?: DeepMatch;
  archetype: string;
  accent: string;
}) {
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
          <div style={{
            fontFamily: FONT.mono,
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: TEXT.tertiary,
            marginBottom: 12,
          }}>
            {archetype}&apos;s taste profile
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topDomains.map((d, i) => (
              <div key={d.axis} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontFamily: FONT.sans,
                  fontSize: 11,
                  color: TEXT.secondary,
                  width: 72,
                  flexShrink: 0,
                }}>
                  {d.axis}
                </span>
                <div style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: 'rgba(0,42,85,0.05)',
                  overflow: 'hidden',
                }}>
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

      {/* Deep match card */}
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
          <div style={{
            fontFamily: FONT.mono,
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: COLOR.ochre,
            marginBottom: 6,
          }}>
            Your #1 deep match
          </div>
          <div style={{
            fontFamily: FONT.sans,
            fontSize: 14,
            fontWeight: 600,
            color: 'white',
            marginBottom: 2,
          }}>
            {deepMatch.name}
          </div>
          <div style={{
            fontFamily: FONT.sans,
            fontSize: 11,
            color: 'rgba(255,255,255,0.6)',
            marginBottom: deepMatch.headline ? 6 : 0,
          }}>
            {deepMatch.location}
          </div>
          {deepMatch.headline && (
            <div style={{
              fontFamily: FONT.serif,
              fontSize: 12,
              fontStyle: 'italic',
              color: 'rgba(255,255,255,0.75)',
              lineHeight: 1.4,
            }}>
              {deepMatch.headline}
            </div>
          )}
        </motion.div>
      )}
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
