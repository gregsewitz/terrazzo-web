'use client';

import { useMemo } from 'react';

import { TASTE_PROFILE, WRAPPED } from '@/constants/profile';
import type { TasteProfile as ProfileShape } from '@/constants/profile';
import { useOnboardingStore } from '@/stores/onboardingStore';
import type { TasteProfile as NumericProfile, GeneratedTasteProfile } from '@/types';
import {
  IdentitySection,
  TasteDNASection,
  DesignLanguageSection,
  ContradictionsSection,
  PerfectDaySection,
  ContextShiftsSection,
  TasteNeighborsSection,
  DimensionsSection,
  VocabularySection,
  MatchesSection,
  TravelStatsSection,
  TravelTimelineSection,
  TasteEvolutionSection,
  BucketListSection,
} from './sections';

export default function ProfileDeepDive() {
  const generatedProfile = useOnboardingStore(s => s.generatedProfile);
  const allSignals = useOnboardingStore(s => s.allSignals);
  const mosaicAxes = useOnboardingStore(s => s.mosaicAxes);
  const profile: ProfileShape = (generatedProfile as unknown as ProfileShape) || TASTE_PROFILE;
  const gp = generatedProfile as GeneratedTasteProfile | null;
  const signalCount = allSignals?.length || WRAPPED.totalSignals;

  const numericProfile: NumericProfile = useMemo(() => {
    const result: NumericProfile = { Design: 0.5, Atmosphere: 0.5, Character: 0.5, Service: 0.5, FoodDrink: 0.5, Setting: 0.5, Wellness: 0.5, Sustainability: 0.5 };
    for (const r of profile.radarData || []) {
      if (r.axis in result) {
        result[r.axis as keyof NumericProfile] = Math.max(result[r.axis as keyof NumericProfile], r.value);
      }
    }
    return result;
  }, [profile]);

  return (
    <div style={{ background: 'var(--t-cream)' }}>
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
      <TravelStatsSection />
      <TravelTimelineSection />
      <TasteEvolutionSection profile={profile} />
      <BucketListSection />
    </div>
  );
}
