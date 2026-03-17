'use client';

import { useState, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GeneratedTasteProfile } from '@/types';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { FONT, INK, TEXT } from '@/constants/theme';
import {
  BRAND,
  CoverReveal,
  ArchetypeReveal,
  QuoteReveal,
  DesignLanguageReveal,
  TasteFingerprintReveal,
  ContradictionReveal,
  ObservationsReveal,
  PerfectDayReveal,
  HowYouShiftReveal,
  TasteNeighborsReveal,
  DestinationsReveal,
  MatchesReveal,
  SeedTripsReveal,
  ShareReveal,
} from './reveal';

interface RevealSequenceProps {
  profile: GeneratedTasteProfile;
  onComplete: () => void;
  /** 'onboarding' = post-onboarding reveal (default), 'replay' = dossier replay from profile */
  mode?: 'onboarding' | 'replay';
  /** Called when user presses back on the first card (replay mode) */
  onBack?: () => void;
}

type RevealStage =
  | 'cover'
  | 'archetype'
  | 'quote'
  | 'design'
  | 'fingerprint'
  | 'contradiction'
  | 'observations'
  | 'perfectday'
  | 'shift'
  | 'neighbors'
  | 'destinations'
  | 'matches'
  | 'trips'
  | 'share';

// Stage transition variants
const stageVariants = {
  enter: { opacity: 0, y: 30, scale: 0.98 },
  center: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
  exit: { opacity: 0, y: -20, scale: 0.98, transition: { duration: 0.3 } },
};

// Accent colors per stage for replay dots
const REPLAY_ACCENTS: Record<string, string> = {
  cover: BRAND.navy, archetype: BRAND.coral, quote: BRAND.coral,
  design: BRAND.darkTeal, fingerprint: BRAND.navy, contradiction: BRAND.olive,
  observations: BRAND.ochre, perfectday: BRAND.coral, shift: BRAND.darkTeal,
  neighbors: BRAND.peach, destinations: BRAND.coral, matches: BRAND.darkTeal,
  trips: BRAND.ochre, share: BRAND.navy,
};


const RevealSequence = memo(function RevealSequence({
  profile, onComplete, mode = 'onboarding', onBack,
}: RevealSequenceProps) {
  const { goBackPlace, seedTrips, lifeContext, mosaicAxes } = useOnboardingStore();
  const isReplay = mode === 'replay';

  // Build dynamic stage list — skip stages with no data
  const stages = useMemo(() => {
    const s: RevealStage[] = [];
    if (isReplay) s.push('cover');
    s.push('archetype');
    if (profile.bestQuote?.quote) s.push('quote');
    if (profile.designInsight || Object.keys(mosaicAxes).length > 0) s.push('design');
    if (profile.radarData?.length > 0) s.push('fingerprint');
    if (profile.contradictions?.length > 0) s.push('contradiction');
    if (profile.microTasteSignals && Object.keys(profile.microTasteSignals).length > 0) s.push('observations');
    if (profile.perfectDay) s.push('perfectday');
    if (profile.howYouShift?.length) s.push('shift');
    if (profile.tasteNeighbors) s.push('neighbors');
    if (profile.destinations) s.push('destinations');
    if (profile.matchedProperties?.length > 0) s.push('matches');
    if (seedTrips?.length > 0) s.push('trips');
    if (isReplay) s.push('share');
    return s;
  }, [profile, mosaicAxes, seedTrips, isReplay]);

  const [stageIndex, setStageIndex] = useState(0);
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');
  const stage = stages[stageIndex];

  const advance = () => {
    if (stageIndex >= stages.length - 1) {
      onComplete();
      return;
    }
    setStageIndex((i) => i + 1);
  };

  const goBackStep = useCallback(() => {
    if (stageIndex > 0) {
      setStageIndex((i) => i - 1);
    } else if (onBack) {
      onBack();
    }
  }, [stageIndex, onBack]);

  const handleShare = useCallback(async () => {
    const text = [
      `My Terrazzo Taste Dossier`,
      `I'm "${profile.overallArchetype}" — ${profile.archetypeDescription.slice(0, 120)}...`,
      ``,
      `Get your own taste profile at terrazzo.travel`,
    ].join('\n');

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'My Taste Dossier — Terrazzo', text });
        return;
      } catch { /* user cancelled or not supported */ }
    }

    try {
      await navigator.clipboard.writeText(text);
      setShareState('copied');
      setTimeout(() => setShareState('idle'), 2500);
    } catch { /* clipboard not available */ }
  }, [profile]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Replay top bar with back + dots ── */}
      {isReplay && (
        <motion.div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '52px 20px 16px',
            flexShrink: 0, position: 'relative', zIndex: 10,
          }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.button
            onClick={goBackStep}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: FONT.sans, fontSize: 13, color: TEXT.secondary, padding: 0,
            }}
            whileHover={{ opacity: 0.7 }}
            whileTap={{ scale: 0.95 }}
          >
            ← {stageIndex === 0 ? 'Close' : 'Back'}
          </motion.button>

          <div style={{ display: 'flex', gap: 5 }}>
            {stages.map((s, i) => (
              <motion.div
                key={i}
                layout
                style={{
                  height: 5, borderRadius: 3,
                  background: i === stageIndex
                    ? (REPLAY_ACCENTS[s] || BRAND.navy)
                    : i < stageIndex ? INK['30'] : INK['12'],
                }}
                animate={{ width: i === stageIndex ? 20 : 5 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            ))}
          </div>

          <div style={{ width: 48 }} />
        </motion.div>
      )}

      {/* ── Card content ── */}
      <div
        onClick={isReplay && stageIndex < stages.length - 1 ? advance : undefined}
        style={{
          flex: 1, overflowY: 'auto',
          padding: isReplay ? '0 16px' : '24px 16px',
          cursor: isReplay && stageIndex < stages.length - 1 ? 'pointer' : 'default',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'flex-start',
          maxWidth: 520, margin: '0 auto', width: '100%',
        }}
      >
        {/* Auto-spacer pushes short content to vertical center; tall content scrolls naturally */}
        {isReplay && <div style={{ flex: '1 1 0', minHeight: 0 }} />}
        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            variants={stageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            style={{ width: '100%', flexShrink: 0 }}
          >
            {stage === 'cover' && <CoverReveal firstName={lifeContext.firstName} />}
            {stage === 'archetype' && <ArchetypeReveal profile={profile} firstName={lifeContext.firstName} />}
            {stage === 'quote' && <QuoteReveal profile={profile} />}
            {stage === 'design' && <DesignLanguageReveal profile={profile} mosaicAxes={mosaicAxes} />}
            {stage === 'fingerprint' && <TasteFingerprintReveal profile={profile} />}
            {stage === 'contradiction' && <ContradictionReveal profile={profile} />}
            {stage === 'observations' && <ObservationsReveal profile={profile} />}
            {stage === 'perfectday' && <PerfectDayReveal profile={profile} />}
            {stage === 'shift' && <HowYouShiftReveal profile={profile} />}
            {stage === 'neighbors' && <TasteNeighborsReveal profile={profile} />}
            {stage === 'destinations' && <DestinationsReveal profile={profile} />}
            {stage === 'matches' && <MatchesReveal profile={profile} />}
            {stage === 'trips' && <SeedTripsReveal seedTrips={seedTrips} />}
            {stage === 'share' && (
              <ShareReveal
                profile={profile}
                onViewProfile={onComplete}
                onShare={handleShare}
                shareState={shareState}
              />
            )}
          </motion.div>
        </AnimatePresence>
        {isReplay && <div style={{ flex: '1 1 0', minHeight: 0 }} />}
      </div>

      {/* ── Replay tap hint ── */}
      {isReplay && (
        <AnimatePresence>
          {stageIndex < stages.length - 1 && (
            <motion.div
              style={{
                paddingBottom: 32, textAlign: 'center',
                flexShrink: 0, position: 'relative', zIndex: 10,
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              <motion.span
                style={{
                  fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: TEXT.secondary, display: 'inline-block',
                }}
                animate={{ opacity: [1, 0.5, 1], y: [0, 2, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                Tap to continue
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* ── Onboarding bottom bar (Continue button + dots) ── */}
      {!isReplay && (
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
              background: 'var(--t-navy)', color: 'var(--t-cream)',
              fontFamily: FONT.sans, fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {stageIndex >= stages.length - 1 ? 'Dive in' : 'Continue'}
          </motion.button>

          <div style={{
            display: 'flex', gap: 5, justifyContent: 'center', marginTop: 14,
          }}>
            {stages.map((s, i) => (
              <motion.div
                key={i}
                layout
                style={{
                  height: 5,
                  borderRadius: 3,
                  background: i === stageIndex ? (REPLAY_ACCENTS[s] || BRAND.navy) : i < stageIndex ? INK['30'] : INK['12'],
                }}
                animate={{ width: i === stageIndex ? 20 : 5 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

RevealSequence.displayName = 'RevealSequence';
export default RevealSequence;
