'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { ACT_1_PHASE_IDS, ACT_2_PHASE_IDS } from '@/constants/onboarding';
import PropertyReactionCard from '@/components/onboarding/PropertyReactionCard';
import type { PropertyAnchor, PropertyExemplar } from '@/types';

/** Friendly domain names for headings */
const DOMAIN_DISPLAY: Record<string, string> = {
  Character: 'Character & Identity',
  FoodDrink: 'Food & Drink',
  Service: 'Service Philosophy',
  Atmosphere: 'Atmosphere',
  Design: 'Design Language',
  Setting: 'Setting & Place',
  Wellness: 'Wellness',
  Sustainability: 'Sustainability',
};

/** Brief domain prompts to contextualize the reaction cards */
const DOMAIN_PROMPTS: Record<string, string> = {
  Character: 'What kind of personality draws you to a place?',
  FoodDrink: 'What food and drink experiences matter to you?',
  Service: 'How do you like to be taken care of?',
  Atmosphere: 'What kind of energy should a place have?',
  Design: 'What aesthetic language speaks to you?',
  Setting: 'Where does a place need to be?',
  Wellness: 'How important is rest and renewal?',
  Sustainability: 'How much does a place\u2019s values matter?',
};

export default function GapFillPage() {
  const router = useRouter();
  const {
    gapCheckResult,
    addPropertyAnchors,
    setPhaseIndex,
  } = useOnboardingStore();

  // Flatten gap domains with their exemplars into an ordered list
  const domainExemplars = useMemo(() => {
    if (!gapCheckResult?.coverage?.gapDomains?.length) return [];
    return gapCheckResult.coverage.gapDomains
      .filter((domain) => gapCheckResult.exemplars[domain]?.length > 0)
      .map((domain) => ({
        domain,
        exemplars: gapCheckResult.exemplars[domain],
      }));
  }, [gapCheckResult]);

  // Track which domain we're currently showing (one domain at a time)
  const [currentDomainIndex, setCurrentDomainIndex] = useState(0);
  // Track reactions within current domain
  const [reactedCount, setReactedCount] = useState(0);

  const currentDomain = domainExemplars[currentDomainIndex];
  const totalDomains = domainExemplars.length;
  const isLastDomain = currentDomainIndex >= totalDomains - 1;

  const handleReact = useCallback((
    googlePlaceId: string,
    sentiment: string,
    blendWeight: number,
    propertyName: string,
    placeType: string | null,
  ) => {
    // Skip "meh" reactions — they don't add signal
    if (blendWeight !== 0) {
      const anchor: PropertyAnchor = {
        googlePlaceId,
        propertyName,
        placeType: placeType ?? undefined,
        sentiment: sentiment as PropertyAnchor['sentiment'],
        blendWeight,
        sourcePhaseId: 'gap-fill',
        hasEmbedding: true, // these come from PlaceIntelligence which has embeddings
        resolvedAt: new Date().toISOString(),
      };
      addPropertyAnchors([anchor]);
    }
    setReactedCount((c) => c + 1);
  }, [addPropertyAnchors]);

  const handleNext = () => {
    if (isLastDomain) {
      // All gap domains addressed — proceed to Act 2
      const act2Start = ACT_1_PHASE_IDS.length;
      setPhaseIndex(act2Start);
      router.push(`/onboarding/phase/${ACT_2_PHASE_IDS[0]}`);
    } else {
      setCurrentDomainIndex((i) => i + 1);
      setReactedCount(0);
    }
  };

  // No gap data — redirect to Act 2
  if (!domainExemplars.length) {
    const act2Start = ACT_1_PHASE_IDS.length;
    setPhaseIndex(act2Start);
    router.push(`/onboarding/phase/${ACT_2_PHASE_IDS[0]}`);
    return null;
  }

  const allReacted = currentDomain && reactedCount >= currentDomain.exemplars.length;

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--t-cream)]">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--t-ink)]/30">
              Gap fill &middot; {currentDomainIndex + 1} of {totalDomains}
            </p>
            <h1 className="font-display text-[22px] text-[var(--t-ink)] leading-tight">
              {DOMAIN_DISPLAY[currentDomain.domain] || currentDomain.domain}
            </h1>
          </div>
          <button
            onClick={handleNext}
            className="text-[13px] px-3 py-1 rounded-full"
            style={{ color: 'var(--t-ink)', opacity: 0.4, border: '1px solid rgba(28, 26, 23, 0.1)' }}
          >
            Skip
          </button>
        </div>

        {/* Domain progress dots */}
        <div className="flex gap-1.5 mb-3">
          {domainExemplars.map((de, i) => (
            <div
              key={de.domain}
              className="h-1 rounded-full flex-1 transition-all duration-500"
              style={{
                backgroundColor: i < currentDomainIndex
                  ? 'var(--t-verde)'
                  : i === currentDomainIndex
                    ? 'var(--t-honey)'
                    : 'var(--t-travertine)',
              }}
            />
          ))}
        </div>

        <p className="text-[14px] text-[var(--t-ink)]/50 leading-relaxed mb-2">
          {DOMAIN_PROMPTS[currentDomain.domain] || 'React to these places to sharpen your taste profile.'}
        </p>
      </div>

      {/* Reaction cards */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {currentDomain.exemplars.map((exemplar: PropertyExemplar) => (
          <PropertyReactionCard
            key={exemplar.googlePlaceId}
            exemplar={exemplar}
            domain={currentDomain.domain}
            onReact={handleReact}
          />
        ))}
      </div>

      {/* Continue button — appears after all cards are reacted */}
      <div className="flex-shrink-0 px-5 pb-6 pt-2">
        <button
          onClick={handleNext}
          className={`
            w-full py-3.5 rounded-xl text-[15px] font-medium text-white
            transition-all duration-500
            hover:opacity-90 active:scale-[0.98]
            ${allReacted ? 'opacity-100 translate-y-0' : 'opacity-40 translate-y-1'}
          `}
          style={{ backgroundColor: 'var(--t-ink)' }}
        >
          {isLastDomain ? "On to Act II" : "Next domain"}
        </button>
      </div>
    </div>
  );
}
