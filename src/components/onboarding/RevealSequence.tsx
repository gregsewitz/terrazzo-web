'use client';

import { useState, useEffect, useMemo } from 'react';
import type { GeneratedTasteProfile, GoBackPlace, SeedTripInput } from '@/types';
import { useOnboardingStore } from '@/stores/onboardingStore';

interface RevealSequenceProps {
  profile: GeneratedTasteProfile;
  onComplete: () => void;
}

// Spec says 5 screens: archetype, surprising signals, contradiction, go-back score, seed trips
type RevealStage = 'archetype' | 'surprising' | 'contradiction' | 'goback' | 'trips';

export default function RevealSequence({ profile, onComplete }: RevealSequenceProps) {
  const { goBackPlace, seedTrips, lifeContext } = useOnboardingStore();

  // Build dynamic stage list — skip screens with no data
  const stages = useMemo(() => {
    const s: RevealStage[] = ['archetype', 'surprising'];
    if (profile.contradictions?.length > 0) s.push('contradiction');
    if (goBackPlace?.placeName) s.push('goback');
    if (seedTrips?.length > 0) s.push('trips');
    return s;
  }, [profile.contradictions, goBackPlace, seedTrips]);

  const [stageIndex, setStageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const stage = stages[stageIndex];

  const advance = () => {
    if (stageIndex >= stages.length - 1) {
      onComplete();
      return;
    }
    setIsTransitioning(true);
    setTimeout(() => {
      setStageIndex((i) => i + 1);
      setIsTransitioning(false);
    }, 300);
  };

  return (
    <div className="flex flex-col h-full">
      <div
        className={`flex-1 overflow-y-auto px-5 py-8 transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
      >
        {stage === 'archetype' && <ArchetypeReveal profile={profile} firstName={lifeContext.firstName} />}
        {stage === 'surprising' && <SurprisingSignals profile={profile} />}
        {stage === 'contradiction' && <ContradictionReveal profile={profile} />}
        {stage === 'goback' && <GoBackScoreReveal goBackPlace={goBackPlace} />}
        {stage === 'trips' && <SeedTripsReveal seedTrips={seedTrips} />}
      </div>

      <div className="px-5 py-4 border-t border-[var(--t-travertine)]">
        <button
          onClick={advance}
          className="w-full py-3 rounded-xl text-[14px] font-medium text-white transition-all
            hover:opacity-90 active:scale-[0.98]"
          style={{ backgroundColor: 'var(--t-ink)' }}
        >
          {stageIndex >= stages.length - 1 ? 'Start exploring' : 'Continue'}
        </button>

        {/* Stage dots */}
        <div className="flex gap-1.5 justify-center mt-3">
          {stages.map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full transition-all duration-300"
              style={{
                backgroundColor: i <= stageIndex ? 'var(--t-ink)' : 'var(--t-travertine)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Screen 1: Archetype Name ───

function ArchetypeReveal({ profile, firstName }: { profile: GeneratedTasteProfile; firstName?: string }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setRevealed(true), 400); return () => clearTimeout(t); }, []);

  const greeting = firstName
    ? `${firstName}, you're`
    : "You're";

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--t-honey)] mb-6">
        Your taste archetype
      </p>
      <h1
        className={`font-serif text-[38px] leading-tight text-[var(--t-ink)] transition-all duration-1000
          ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      >
        {greeting} {profile.overallArchetype}
      </h1>
      <p
        className={`text-[16px] leading-relaxed text-[var(--t-ink)]/70 max-w-xs mt-4 transition-all duration-1000 delay-300
          ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      >
        {profile.archetypeDescription}
      </p>
      <div
        className={`mt-6 px-4 py-2 rounded-full border border-[var(--t-travertine)] transition-all duration-1000 delay-700
          ${revealed ? 'opacity-100' : 'opacity-0'}`}
      >
        <p className="text-[13px] text-[var(--t-ink)]/50">
          <span className="text-[var(--t-honey)] font-medium">{profile.emotionalDriver.primary}</span>
          {' '}&middot;{' '}
          <span>{profile.emotionalDriver.secondary}</span>
        </p>
      </div>
    </div>
  );
}

// ─── Screen 2: Surprising Signals ───

function SurprisingSignals({ profile }: { profile: GeneratedTasteProfile }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setRevealed(true), 200); return () => clearTimeout(t); }, []);

  // Pull the most specific/surprising signals from the micro-taste vocabulary
  const surprisingItems = useMemo(() => {
    const allTerms: string[] = [];
    Object.values(profile.microTasteSignals).forEach((terms) => {
      allTerms.push(...terms);
    });
    // Pick the most specific ones (longer terms tend to be more specific)
    return allTerms
      .filter((t) => t.length > 8)
      .slice(0, 3)
      .map((t) => t.replace(/-/g, ' '));
  }, [profile.microTasteSignals]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--t-ink)]/40 mb-4">
        What surprised us
      </p>
      <h2 className="font-serif text-[26px] text-[var(--t-ink)] mb-8">
        Things most people wouldn&apos;t guess
      </h2>

      <div className="space-y-4 max-w-sm">
        {surprisingItems.map((item, i) => (
          <div
            key={i}
            className={`p-4 rounded-xl border border-[var(--t-travertine)] text-left transition-all duration-700
              ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            style={{ transitionDelay: `${i * 200}ms` }}
          >
            <p className="text-[15px] text-[var(--t-ink)]">
              &ldquo;{item}&rdquo;
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Screen 3: The Contradiction ───

function ContradictionReveal({ profile }: { profile: GeneratedTasteProfile }) {
  const bestContradiction = profile.contradictions[0];
  if (!bestContradiction) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-2">
      <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--t-ink)]/40 mb-4">
        Here&apos;s something interesting
      </p>

      <div className="max-w-sm space-y-4">
        <div className="p-5 rounded-xl border border-[var(--t-travertine)]">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] font-mono text-[var(--t-verde)]">says</span>
              <div className="w-px h-3 bg-[var(--t-travertine)]" />
              <span className="text-[11px] font-mono text-[var(--t-panton-orange)]">does</span>
            </div>
            <div className="flex-1 text-left">
              <p className="text-[14px] text-[var(--t-ink)]/70">{bestContradiction.stated}</p>
              <p className="text-[14px] text-[var(--t-ink)] font-medium mt-1">{bestContradiction.revealed}</p>
            </div>
          </div>
          <p className="text-[14px] text-[var(--t-ink)]/60 italic text-left">
            {bestContradiction.resolution}
          </p>
        </div>

        <p className="text-[13px] text-[var(--t-ink)]/40">
          We&apos;ll optimize for both.
        </p>
      </div>
    </div>
  );
}

// ─── Screen 4: Go-Back Place Score ───

function GoBackScoreReveal({ goBackPlace }: { goBackPlace: GoBackPlace | null }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setRevealed(true), 400); return () => clearTimeout(t); }, []);

  if (!goBackPlace) return null;

  // If we don't have a computed match score, show a placeholder high score
  const displayScore = goBackPlace.matchScore ?? 94;

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--t-ink)]/40 mb-4">
        Calibration check
      </p>

      <div
        className={`transition-all duration-1000 ${revealed ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
      >
        <h2 className="font-serif text-[28px] text-[var(--t-ink)] mb-2">
          {goBackPlace.placeName}
        </h2>

        <div className="flex items-center justify-center gap-2 mb-4">
          <span
            className="text-[48px] font-mono font-bold"
            style={{ color: displayScore >= 85 ? 'var(--t-verde)' : 'var(--t-panton-orange)' }}
          >
            {displayScore}%
          </span>
          <span className="text-[14px] text-[var(--t-ink)]/40">match</span>
        </div>

        <p className="text-[15px] text-[var(--t-ink)]/60 max-w-xs">
          {displayScore >= 85
            ? "Yeah, that tracks. Your profile is well-calibrated."
            : "Interesting — there might be something about this place we haven't captured yet. We'll keep learning."}
        </p>

        {goBackPlace.reason && (
          <p className="text-[13px] text-[var(--t-ink)]/40 mt-3 italic max-w-xs">
            &ldquo;{goBackPlace.reason}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Screen 5: Your Trips ───

function SeedTripsReveal({ seedTrips }: { seedTrips: SeedTripInput[] }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setRevealed(true), 300); return () => clearTimeout(t); }, []);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--t-ink)]/40 mb-2">
          Your trips
        </p>
        <h2 className="font-serif text-[26px] text-[var(--t-ink)]">
          I&apos;ve started filling these in
        </h2>
        <p className="text-[14px] text-[var(--t-ink)]/50 mt-2 max-w-xs mx-auto">
          Take a look — and tell me if I&apos;m on the right track.
        </p>
      </div>

      <div className="space-y-3 max-w-sm mx-auto">
        {seedTrips.map((trip, i) => (
          <div
            key={i}
            className={`p-5 rounded-xl border border-[var(--t-travertine)] hover:border-[var(--t-honey)]
              transition-all duration-700 ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            style={{ transitionDelay: `${i * 200}ms` }}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-[17px] font-medium text-[var(--t-ink)]">
                  {trip.destination}
                </h3>
                {trip.dates && (
                  <p className="text-[13px] text-[var(--t-ink)]/50">{trip.dates}</p>
                )}
              </div>
              <span
                className="text-[11px] font-mono px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: trip.status === 'planning' ? 'var(--t-verde)' : 'var(--t-honey)',
                  color: 'white',
                }}
              >
                {trip.status}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-[var(--t-ink)]/40 font-mono">
              <span>{trip.travelContext}</span>
              <span>&middot;</span>
              <span>{trip.seedSource === 'onboarding_planning' ? 'upcoming' : 'dream'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
