'use client';

import { useCallback, useMemo, useRef, useEffect } from 'react';
import PageTransition from '@/components/ui/PageTransition';
import TabBar from '@/components/ui/TabBar';
import DesktopNav from '@/components/ui/DesktopNav';
import BrandLoader from '@/components/ui/BrandLoader';
import EvolvingWelcome from '@/components/discover/EvolvingWelcome';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useSavedStore } from '@/stores/savedStore';
import { useDiscoverFeed } from '@/hooks/useDiscoverFeed';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import { useAlphaFeedback } from '@/hooks/useAlphaFeedback';
import AlphaFeedbackModal from '@/components/ui/AlphaFeedbackModal';
import { PlaceDetailProvider } from '@/context/PlaceDetailContext';
import { apiFetch } from '@/lib/api-client';
import { recordActivation } from '@/lib/activation-tracker';
import { TASTE_PROFILE } from '@/constants/profile';
import { FONT, TEXT, COLOR, INK } from '@/constants/theme';
import type { ImportedPlace } from '@/types';
import {
  EditorialLetterSection,
  BecauseYouSection,
  SignalThreadSection,
  TasteTensionSection,
  WeeklyEditSection,
  MoodBoardSection,
  DeepMatchSection,
  StretchPickSection,
  ContextModeSection,
  VocabTeaser,
} from '@/components/profile/discover-sections';

export default function DiscoverPage() {
  const ratePlace = useSavedStore(s => s.ratePlace);
  const addPlace = useSavedStore(s => s.addPlace);
  const myPlaces = useSavedStore(s => s.myPlaces);

  const handleSavePreview = useCallback(async (place: ImportedPlace): Promise<string | void> => {
    // Save to library via API — returns the real server ID so PlaceDetailContext
    // can update the detailItem and subsequent actions (rate, etc.) target the
    // correct record instead of the synthetic discover-prefixed ID.
    try {
      const googlePlaceId = (place.google as Record<string, unknown> & { placeId?: string })?.placeId;
      if (!googlePlaceId) return;

      // Check if already in library — if so, just return the existing ID
      const existing = myPlaces.find(p => p.google?.placeId === googlePlaceId);
      if (existing) return existing.id;

      const res = await apiFetch<{ place?: { id: string } }>('/api/places/save', {
        method: 'POST',
        body: JSON.stringify({
          googlePlaceId,
          name: place.name,
          type: place.type,
          location: place.location,
          source: { type: 'url', name: 'Discover Feed' },
        }),
      });

      const realId = res?.place?.id;
      if (realId) {
        // Add to Zustand store so the place appears in the library immediately
        // and future actions resolve the correct ID.
        addPlace({ ...place, id: realId });
        return realId;
      }
    } catch (err) {
      console.error('Failed to save discover place:', err);
    }
  }, [addPlace, myPlaces]);

  return (
    <PlaceDetailProvider config={{
      onRate: (place, rating) => {
        ratePlace(place.id, rating);
      },
      onSavePreview: handleSavePreview,
    }}>
      <DiscoverPageContent />
    </PlaceDetailProvider>
  );
}

function DiscoverPageContent() {
  const isDesktop = useIsDesktop();
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Get profile data from onboarding store
  const generatedProfile = useOnboardingStore(s => s.generatedProfile);
  const lifeContext = useOnboardingStore(s => s.lifeContext);
  const dbHydrated = useOnboardingStore(s => s.dbHydrated);

  // Alpha feedback hook
  const { activePrompt, submitFeedback, dismissFeedback } = useAlphaFeedback();

  // Record activation milestone on mount
  useEffect(() => {
    recordActivation('viewed_discover');
  }, []);

  // Use the discover feed hook for all discover content and infinite scroll logic
  const {
    discoverContent,
    isLoadingDiscover,
    isLoadingMore,
    extraPages,
    hasMoreContent,
  } = useDiscoverFeed(generatedProfile, lifeContext, generatedProfile || TASTE_PROFILE);

  // Wait for DB hydration before rendering profile data
  if (!dbHydrated) {
    return <BrandLoader message="Loading your discover feed…" />;
  }

  const profile = generatedProfile || TASTE_PROFILE;

  const discoverFeed = (
    <>
      <EvolvingWelcome discoverContent={discoverContent} isLoadingDiscover={isLoadingDiscover} />
      <EditorialLetterSection letter={discoverContent?.editorialLetter} />
      <BecauseYouSection cards={discoverContent?.becauseYouCards} />
      <SignalThreadSection thread={discoverContent?.signalThread} />
      <TasteTensionSection tension={discoverContent?.tasteTension} />
      <WeeklyEditSection collection={discoverContent?.weeklyCollection} />
      <MoodBoardSection boards={discoverContent?.moodBoards} />
      <DeepMatchSection match={discoverContent?.deepMatch} />
      <StretchPickSection stretch={discoverContent?.stretchPick} />
      <ContextModeSection recs={discoverContent?.contextRecs} contextLabel={discoverContent?.contextLabel} />
      <VocabTeaser profile={profile} />

      {extraPages.map((page, i) => (
        <div key={`extra-page-${i}`}>
          <div className="flex items-center gap-4 my-10 px-4">
            <div className="flex-1 h-px" style={{ background: 'var(--t-linen)' }} />
            <span style={{ fontFamily: FONT.mono, fontSize: 11, color: TEXT.secondary, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              More for you
            </span>
            <div className="flex-1 h-px" style={{ background: 'var(--t-linen)' }} />
          </div>
          {page.editorialLetter && <EditorialLetterSection letter={page.editorialLetter} />}
          {page.becauseYouCards && <BecauseYouSection cards={page.becauseYouCards} />}
          {page.signalThread && <SignalThreadSection thread={page.signalThread} />}
          {page.tasteTension && <TasteTensionSection tension={page.tasteTension} />}
          {page.weeklyCollection && <WeeklyEditSection collection={page.weeklyCollection} />}
          {page.moodBoards && <MoodBoardSection boards={page.moodBoards} />}
          {page.deepMatch && <DeepMatchSection match={page.deepMatch} />}
          {page.stretchPick && <StretchPickSection stretch={page.stretchPick} />}
          {page.contextRecs && <ContextModeSection recs={page.contextRecs} contextLabel={page.contextLabel} />}
        </div>
      ))}

      {hasMoreContent && (
        <div ref={sentinelRef} className="flex flex-col items-center justify-center py-10 gap-2" style={{ minHeight: 80 }}>
          {isLoadingMore ? (
            <>
              <div className="animate-spin w-5 h-5 rounded-full border-2" style={{ borderColor: 'var(--t-linen)', borderTopColor: 'var(--t-honey)' }} />
              <span style={{ fontFamily: FONT.mono, fontSize: 12, color: TEXT.secondary, letterSpacing: '0.05em' }}>Curating more…</span>
            </>
          ) : (
            <span className="animate-pulse" style={{ fontFamily: FONT.mono, fontSize: 12, color: TEXT.secondary, letterSpacing: '0.05em' }}>Scroll for more</span>
          )}
        </div>
      )}
    </>
  );

  /* ─── Desktop Discover layout ─── */
  if (isDesktop) {
    return (
      <PageTransition className="min-h-screen" style={{ background: 'var(--t-cream)' }}>
        <DesktopNav />
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '36px 48px 48px' }}>
          {discoverFeed}
        </div>
        {activePrompt && (
          <AlphaFeedbackModal
            title={activePrompt.title}
            question={activePrompt.question}
            placeholder={activePrompt.placeholder}
            onSubmit={submitFeedback}
            onDismiss={dismissFeedback}
          />
        )}
      </PageTransition>
    );
  }

  /* ─── Mobile Discover layout ─── */
  return (
    <PageTransition className="min-h-screen" style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto', paddingBottom: 80 }}>
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-lg font-semibold" style={{ color: TEXT.primary, fontFamily: FONT.sans }}>Discover</h1>
      </div>
      {discoverFeed}
      {activePrompt && (
        <AlphaFeedbackModal
          title={activePrompt.title}
          question={activePrompt.question}
          placeholder={activePrompt.placeholder}
          onSubmit={submitFeedback}
          onDismiss={dismissFeedback}
        />
      )}
      <TabBar />
    </PageTransition>
  );
}
