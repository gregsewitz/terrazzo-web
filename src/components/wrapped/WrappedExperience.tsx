'use client';

import { motion } from 'framer-motion';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { TASTE_PROFILE } from '@/constants/profile';
import RevealSequence from '@/components/onboarding/RevealSequence';
import type { GeneratedTasteProfile } from '@/types';

// ─── Props ───

interface WrappedExperienceProps {
  onClose: () => void;
}

/**
 * Thin full-screen overlay that replays the RevealSequence in "replay" mode.
 * Reads the generated profile from the onboarding store, falling back to
 * the static TASTE_PROFILE constant for demo/preview purposes.
 */
export default function WrappedExperience({ onClose }: WrappedExperienceProps) {
  const generatedProfile = useOnboardingStore((s) => s.generatedProfile);

  // Use the real generated profile if available, otherwise adapt the static demo data
  const profile: GeneratedTasteProfile = generatedProfile ?? {
    ...TASTE_PROFILE,
    // GeneratedTasteProfile may have additional optional fields not in TASTE_PROFILE;
    // the reveal cards handle missing data gracefully via null checks
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', flexDirection: 'column',
        height: '100dvh',
        background: 'var(--t-cream)',
        overflow: 'hidden',
      }}
    >
      {/* Subtle grain background */}
      <motion.div
        style={{
          position: 'absolute', inset: 0,
          opacity: 0.02,
          backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
          backgroundSize: '50px 50px',
          zIndex: 0,
          pointerEvents: 'none',
        }}
        animate={{ backgroundPosition: ['0 0', '50px 50px'] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />

      {/* RevealSequence in replay mode fills the overlay */}
      <div style={{ position: 'relative', zIndex: 5, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <RevealSequence
          profile={profile}
          onComplete={onClose}
          mode="replay"
          onBack={onClose}
        />
      </div>
    </div>
  );
}
