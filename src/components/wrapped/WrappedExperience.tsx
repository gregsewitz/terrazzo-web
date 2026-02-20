'use client';

import { useState } from 'react';
import { TASTE_PROFILE, WRAPPED, AXIS_COLORS } from '@/constants/profile';
import RadarChart from '@/components/profile/RadarChart';
import { FONT } from '@/constants/theme';

interface WrappedExperienceProps {
  onClose: () => void;
}

const CARD_BACKGROUNDS = [
  '#2d3a2d', // 0 intro
  '#2d3a2d', // 1 archetype
  '#1a2b1a', // 2 radar
  '#1a2b1a', // 3 stats
  '#5c3d2e', // 4 rarest signal
  '#2e4a5c', // 5 tension
  '#1a1a2e', // 6 aura
  '#2d3a2d', // 7 cta
];

const TOTAL_CARDS = 8;

export default function WrappedExperience({ onClose }: WrappedExperienceProps) {
  const [currentCard, setCurrentCard] = useState(0);
  const profile = TASTE_PROFILE;
  const stats = WRAPPED;

  const advance = () => {
    if (currentCard < TOTAL_CARDS - 1) {
      setCurrentCard(currentCard + 1);
    }
  };

  const goBack = () => {
    if (currentCard > 0) {
      setCurrentCard(currentCard - 1);
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ height: '100dvh', background: CARD_BACKGROUNDS[currentCard] }}
    >
      {/* Top bar: back + dots */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <button
          onClick={goBack}
          className="text-sm bg-transparent border-none cursor-pointer"
          style={{ color: 'rgba(245,245,240,0.6)', fontFamily: FONT.sans }}
        >
          ← {currentCard === 0 ? 'Close' : 'Back'}
        </button>
        <div className="flex gap-1.5">
          {Array.from({ length: TOTAL_CARDS }).map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all"
              style={{
                width: i === currentCard ? 16 : 6,
                height: 6,
                background: i === currentCard ? '#f5f5f0' : 'rgba(245,245,240,0.2)',
              }}
            />
          ))}
        </div>
        <div style={{ width: 48 }} />
      </div>

      {/* Card content */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-8 cursor-pointer"
        onClick={advance}
        style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}
      >
        {currentCard === 0 && <CardIntro />}
        {currentCard === 1 && <CardArchetype archetype={profile.overallArchetype} description={profile.archetypeDescription} />}
        {currentCard === 2 && <CardRadar data={profile.radarData} />}
        {currentCard === 3 && <CardStats stats={stats} />}
        {currentCard === 4 && <CardRarestSignal signal={stats.rarestSignal} percent={stats.rarestPercent} />}
        {currentCard === 5 && <CardTension contradiction={profile.contradictions[0]} />}
        {currentCard === 6 && <CardAura driver={profile.emotionalDriver} />}
        {currentCard === 7 && <CardCTA onViewProfile={onClose} />}
      </div>

      {/* Tap hint */}
      {currentCard < TOTAL_CARDS - 1 && (
        <div className="pb-10 text-center">
          <span
            className="text-[10px] uppercase tracking-widest"
            style={{ color: 'rgba(245,245,240,0.25)', fontFamily: FONT.mono }}
          >
            Tap to continue
          </span>
        </div>
      )}
    </div>
  );
}

// ── Card 0: Intro ──
function CardIntro() {
  return (
    <div className="text-center">
      <div
        className="text-[10px] uppercase tracking-[0.25em] mb-6"
        style={{ color: 'rgba(245,245,240,0.5)', fontFamily: FONT.mono }}
      >
        Terrazzo
      </div>
      <h1
        className="text-5xl mb-4 leading-tight"
        style={{ fontFamily: FONT.serif, color: '#f5f5f0' }}
      >
        Your Taste<br />Profile
      </h1>
      <p
        className="text-sm leading-relaxed"
        style={{ color: 'rgba(245,245,240,0.6)', fontFamily: FONT.sans }}
      >
        We analyzed your signals — here&apos;s what<br />your choices say about how you travel.
      </p>
    </div>
  );
}

// ── Card 1: Archetype ──
function CardArchetype({ archetype, description }: { archetype: string; description: string }) {
  return (
    <div className="text-center">
      <div
        className="text-[10px] uppercase tracking-[0.2em] mb-4"
        style={{ color: 'rgba(245,245,240,0.4)', fontFamily: FONT.mono }}
      >
        You are
      </div>
      <h1
        className="text-4xl mb-6 leading-tight"
        style={{ fontFamily: FONT.serif, color: '#f5f5f0' }}
      >
        {archetype}
      </h1>
      <p
        className="text-[14px] leading-relaxed"
        style={{ color: 'rgba(245,245,240,0.7)', fontFamily: FONT.sans }}
      >
        {description}
      </p>
    </div>
  );
}

// ── Card 2: Radar ──
function CardRadar({ data }: { data: Array<{ axis: string; value: number }> }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="text-[10px] uppercase tracking-[0.2em] mb-6"
        style={{ color: 'rgba(245,245,240,0.4)', fontFamily: FONT.mono }}
      >
        Your taste shape
      </div>
      <RadarChart data={data} size={260} />
    </div>
  );
}

// ── Card 3: Stats ──
function CardStats({ stats }: { stats: typeof WRAPPED }) {
  const items = [
    { value: stats.totalSignals, label: 'Signals analyzed' },
    { value: stats.tensions, label: 'Tensions found' },
    { value: stats.vocabTerms, label: 'Taste vocabulary' },
    { value: stats.contextModes, label: 'Context modes' },
  ];

  return (
    <div>
      <div
        className="text-[10px] uppercase tracking-[0.2em] mb-8 text-center"
        style={{ color: 'rgba(245,245,240,0.4)', fontFamily: FONT.mono }}
      >
        By the numbers
      </div>
      <div className="grid grid-cols-2 gap-6">
        {items.map(({ value, label }) => (
          <div key={label} className="text-center">
            <div
              className="text-4xl mb-1"
              style={{ fontFamily: FONT.serif, color: '#f5f5f0' }}
            >
              {value}
            </div>
            <div
              className="text-[10px] uppercase tracking-wider"
              style={{ color: 'rgba(245,245,240,0.5)', fontFamily: FONT.mono }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Card 4: Rarest Signal ──
function CardRarestSignal({ signal, percent }: { signal: string; percent: number }) {
  return (
    <div className="text-center">
      <div
        className="text-[10px] uppercase tracking-[0.2em] mb-6"
        style={{ color: 'rgba(245,245,240,0.4)', fontFamily: FONT.mono }}
      >
        Your rarest signal
      </div>
      <div
        className="text-6xl mb-4"
        style={{ fontFamily: FONT.serif, color: '#f5f5f0' }}
      >
        {percent}%
      </div>
      <p
        className="text-[10px] uppercase tracking-wider mb-6"
        style={{ color: 'rgba(245,245,240,0.4)', fontFamily: FONT.mono }}
      >
        of travelers share this
      </p>
      <p
        className="text-[15px] leading-relaxed italic"
        style={{ color: 'rgba(245,245,240,0.8)', fontFamily: FONT.sans }}
      >
        &ldquo;{signal}&rdquo;
      </p>
    </div>
  );
}

// ── Card 5: Tension ──
function CardTension({ contradiction }: { contradiction: typeof TASTE_PROFILE.contradictions[0] }) {
  return (
    <div className="text-center">
      <div
        className="text-[10px] uppercase tracking-[0.2em] mb-8"
        style={{ color: 'rgba(245,245,240,0.4)', fontFamily: FONT.mono }}
      >
        Your biggest tension
      </div>
      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'rgba(245,245,240,0.35)', fontFamily: FONT.mono }}>
          You said
        </div>
        <p className="text-[16px] italic" style={{ color: '#f5f5f0', fontFamily: FONT.sans }}>
          &ldquo;{contradiction.stated}&rdquo;
        </p>
      </div>
      <div
        className="text-2xl my-4"
        style={{ color: 'rgba(245,245,240,0.2)', fontFamily: FONT.serif }}
      >
        vs
      </div>
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'rgba(245,245,240,0.35)', fontFamily: FONT.mono }}>
          But we found
        </div>
        <p className="text-[16px] italic" style={{ color: '#f5f5f0', fontFamily: FONT.sans }}>
          &ldquo;{contradiction.revealed}&rdquo;
        </p>
      </div>
      <div
        className="p-4 rounded-xl mt-4"
        style={{ background: 'rgba(245,245,240,0.06)' }}
      >
        <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'rgba(245,245,240,0.35)', fontFamily: FONT.mono }}>
          Resolution
        </div>
        <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(245,245,240,0.7)', fontFamily: FONT.sans }}>
          {contradiction.resolution}
        </p>
      </div>
    </div>
  );
}

// ── Card 6: Aura ──
function CardAura({ driver }: { driver: typeof TASTE_PROFILE.emotionalDriver }) {
  const auraColors = ['#8b6b4a', '#4a6741', '#8b4a4a', '#4a6b8b'];
  const auraLabels = ['Design', 'Character', 'Food', 'Location'];

  return (
    <div className="text-center">
      <div
        className="text-[10px] uppercase tracking-[0.2em] mb-8"
        style={{ color: 'rgba(245,245,240,0.4)', fontFamily: FONT.mono }}
      >
        Your emotional driver
      </div>
      <h2
        className="text-3xl mb-3"
        style={{ fontFamily: FONT.serif, color: '#f5f5f0' }}
      >
        {driver.primary}
      </h2>
      <p
        className="text-[13px] leading-relaxed mb-10"
        style={{ color: 'rgba(245,245,240,0.6)', fontFamily: FONT.sans }}
      >
        {driver.description}
      </p>

      {/* Aura circles */}
      <div className="relative flex items-center justify-center" style={{ height: 120 }}>
        {auraColors.map((color, i) => {
          const size = 100 - i * 16;
          return (
            <div
              key={i}
              className="absolute rounded-full flex items-center justify-center"
              style={{
                width: size,
                height: size,
                background: color,
                opacity: 0.25 + i * 0.1,
              }}
            />
          );
        })}
      </div>
      <div className="flex justify-center gap-4 mt-4">
        {auraLabels.map((label, i) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: auraColors[i] }}
            />
            <span
              className="text-[9px] uppercase tracking-wider"
              style={{ color: 'rgba(245,245,240,0.5)', fontFamily: FONT.mono }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Card 7: CTA ──
function CardCTA({ onViewProfile }: { onViewProfile: () => void }) {
  return (
    <div className="text-center">
      <h2
        className="text-3xl mb-4"
        style={{ fontFamily: FONT.serif, color: '#f5f5f0' }}
      >
        Ready to see your<br />full profile?
      </h2>
      <p
        className="text-[13px] leading-relaxed mb-10"
        style={{ color: 'rgba(245,245,240,0.5)', fontFamily: FONT.sans }}
      >
        Dimensions, contradictions, vocabulary,<br />and your top matches — all in one place.
      </p>
      <button
        onClick={(e) => { e.stopPropagation(); onViewProfile(); }}
        className="px-8 py-3.5 rounded-full text-[13px] font-semibold border-none cursor-pointer transition-opacity hover:opacity-90"
        style={{
          background: '#f5f5f0',
          color: '#2d3a2d',
          fontFamily: FONT.sans,
        }}
      >
        See Full Profile
      </button>
    </div>
  );
}
