'use client';

import { TASTE_PROFILE, WRAPPED, DOMAIN_COLORS, AXIS_COLORS, CONTEXT_ICONS, CONTEXT_COLORS } from '@/constants/profile';
import RadarChart from './RadarChart';
import ScoreArc from './ScoreArc';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { TerrazzoMosaic, MosaicLegend } from '@/components/TerrazzoMosaic';
import { DEFAULT_USER_PROFILE } from '@/lib/taste';
import { FONT, INK } from '@/constants/theme';

const profile = TASTE_PROFILE;

export default function ProfileDeepDive() {
  return (
    <div>
      <HeroSection />
      <RadarSection />
      <DimensionsSection />
      <ContradictionsSection />
      <ContextSection />
      <VocabularySection />
      <MatchesSection />
    </div>
  );
}

// ═══════════════════════════════════════════
// HERO — Dark bg, archetype name + drivers
// ═══════════════════════════════════════════
function HeroSection() {
  return (
    <div
      className="px-5 pt-8 pb-2"
      style={{ background: '#2d3a2d' }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.2em] mb-3"
        style={{ color: 'rgba(245,245,240,0.4)', fontFamily: FONT.mono }}
      >
        Your archetype
      </div>
      <h2
        className="text-3xl mb-3 leading-tight"
        style={{ fontFamily: FONT.serif, color: '#f5f5f0' }}
      >
        {profile.overallArchetype}
      </h2>
      <p
        className="text-[13px] leading-relaxed mb-5"
        style={{ color: 'rgba(245,245,240,0.65)', fontFamily: FONT.sans }}
      >
        {profile.archetypeDescription}
      </p>
      <div className="flex gap-2 mb-4">
        <span
          className="text-[10px] px-3 py-1.5 rounded-full"
          style={{
            background: 'rgba(245,245,240,0.08)',
            color: 'rgba(245,245,240,0.6)',
            fontFamily: FONT.mono,
          }}
        >
          {profile.emotionalDriver.primary}
        </span>
        <span
          className="text-[10px] px-3 py-1.5 rounded-full"
          style={{
            background: 'rgba(245,245,240,0.05)',
            color: 'rgba(245,245,240,0.4)',
            fontFamily: FONT.mono,
          }}
        >
          {profile.emotionalDriver.secondary}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// MOSAIC — Terrazzo Mosaic replaces radar chart
// ═══════════════════════════════════════════
function RadarSection() {
  return (
    <div
      className="flex flex-col items-center px-5 pt-6 pb-8 gap-4"
      style={{ background: '#2d3a2d' }}
    >
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 9,
          letterSpacing: '0.15em',
          textTransform: 'uppercase' as const,
          color: 'rgba(245,240,230,0.5)',
        }}
      >
        Your Terrazzo Mosaic
      </div>
      <div className="flex items-center gap-6">
        <TerrazzoMosaic profile={DEFAULT_USER_PROFILE} size="lg" />
        <MosaicLegend profile={DEFAULT_USER_PROFILE} dark style={{ gridTemplateColumns: 'repeat(2, auto)', gap: '6px 14px' }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// DIMENSIONS — 6 cards with certainty bars
// ═══════════════════════════════════════════

const DIMENSION_CERTAINTIES: Record<string, number> = {
  "Design Language": 92,
  "Character & Identity": 85,
  "Service Philosophy": 88,
  "Food & Drink": 90,
  "Location & Context": 82,
  "Wellness & Body": 72,
};

function DimensionsSection() {
  const domains = Object.keys(profile.microTasteSignals).filter(k => k !== 'Rejection');

  return (
    <div className="px-4 py-6" style={{ background: 'var(--t-cream)' }}>
      <h3
        className="text-[10px] uppercase tracking-[0.2em] mb-4"
        style={{ color: '#8a6a2a', fontFamily: FONT.mono, fontWeight: 700 }}
      >
        Taste Dimensions
      </h3>
      <div className="flex flex-col gap-3">
        {domains.map(domain => {
          const color = DOMAIN_COLORS[domain] || '#8b6b4a';
          const certainty = DIMENSION_CERTAINTIES[domain] || 80;
          const signals = profile.microTasteSignals[domain] || [];

          return (
            <div
              key={domain}
              className="p-4 rounded-xl"
              style={{
                background: 'white',
                borderLeft: `3px solid ${color}`,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold" style={{ color: 'var(--t-ink)' }}>
                  {domain}
                </span>
                <span
                  className="text-[10px] font-bold"
                  style={{ color, fontFamily: FONT.mono }}
                >
                  {certainty}%
                </span>
              </div>

              {/* Certainty bar */}
              <div
                className="h-1 rounded-full mb-3"
                style={{ background: INK['06'] }}
              >
                <div
                  className="h-1 rounded-full transition-all"
                  style={{ width: `${certainty}%`, background: color }}
                />
              </div>

              {/* Signal tags */}
              <div className="flex flex-wrap gap-1.5">
                {signals.slice(0, 5).map(signal => (
                  <span
                    key={signal}
                    className="text-[10px] px-2 py-1 rounded-full"
                    style={{
                      background: `${color}10`,
                      color,
                      fontFamily: FONT.sans,
                    }}
                  >
                    {signal}
                  </span>
                ))}
                {signals.length > 5 && (
                  <span
                    className="text-[10px] px-2 py-1 rounded-full"
                    style={{ background: INK['04'], color: INK['90'] }}
                  >
                    +{signals.length - 5}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// CONTRADICTIONS — Stated vs Revealed
// ═══════════════════════════════════════════
function ContradictionsSection() {
  return (
    <div className="px-4 pb-6" style={{ background: 'var(--t-cream)' }}>
      <h3
        className="text-[10px] uppercase tracking-[0.2em] mb-4"
        style={{ color: '#8a6a2a', fontFamily: FONT.mono, fontWeight: 700 }}
      >
        Contradictions
      </h3>
      <div className="flex flex-col gap-3">
        {profile.contradictions.map((c, i) => (
          <div
            key={i}
            className="p-4 rounded-xl"
            style={{ background: 'white', border: '1px solid var(--t-linen)' }}
          >
            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <div
                  className="text-[9px] uppercase tracking-wider mb-1"
                  style={{ color: INK['90'], fontFamily: FONT.mono }}
                >
                  You said
                </div>
                <p className="text-[12px] italic leading-snug" style={{ color: 'var(--t-ink)' }}>
                  &ldquo;{c.stated}&rdquo;
                </p>
              </div>
              <div
                className="flex items-center text-[13px]"
                style={{ color: INK['15'], fontFamily: FONT.serif }}
              >
                vs
              </div>
              <div className="flex-1">
                <div
                  className="text-[9px] uppercase tracking-wider mb-1"
                  style={{ color: INK['90'], fontFamily: FONT.mono }}
                >
                  We found
                </div>
                <p className="text-[12px] italic leading-snug" style={{ color: 'var(--t-ink)' }}>
                  &ldquo;{c.revealed}&rdquo;
                </p>
              </div>
            </div>
            <div
              className="p-3 rounded-lg"
              style={{ background: 'rgba(42,122,86,0.04)' }}
            >
              <div
                className="text-[9px] uppercase tracking-wider mb-1"
                style={{ color: 'var(--t-verde)', fontFamily: FONT.mono }}
              >
                Resolution
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: INK['95'] }}>
                {c.resolution}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// CONTEXT MODIFIERS — How taste shifts
// ═══════════════════════════════════════════
function ContextSection() {
  return (
    <div className="px-4 pb-6" style={{ background: 'var(--t-cream)' }}>
      <h3
        className="text-[10px] uppercase tracking-[0.2em] mb-4"
        style={{ color: '#8a6a2a', fontFamily: FONT.mono, fontWeight: 700 }}
      >
        Context Modes
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {profile.contextModifiers.map((mod, i) => {
          const color = CONTEXT_COLORS[i % CONTEXT_COLORS.length];
          const icon = CONTEXT_ICONS[mod.context] || 'discover';

          return (
            <div
              key={mod.context}
              className="p-3 rounded-xl"
              style={{
                background: 'white',
                borderTop: `2px solid ${color}`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <PerriandIcon name={icon} size={16} color={color} />
                <span className="text-[11px] font-semibold" style={{ color: 'var(--t-ink)' }}>
                  {mod.context}
                </span>
              </div>
              <p className="text-[10px] leading-relaxed" style={{ color: INK['95'] }}>
                {mod.shifts}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// VOCABULARY — Micro-taste signals by category
// ═══════════════════════════════════════════
function VocabularySection() {
  const categories = Object.entries(profile.microTasteSignals);

  return (
    <div className="px-4 pb-6" style={{ background: 'var(--t-cream)' }}>
      <h3
        className="text-[10px] uppercase tracking-[0.2em] mb-4"
        style={{ color: '#8a6a2a', fontFamily: FONT.mono, fontWeight: 700 }}
      >
        Taste Vocabulary · {WRAPPED.vocabTerms} terms
      </h3>
      <div className="flex flex-col gap-3">
        {categories.map(([category, terms]) => {
          const color = DOMAIN_COLORS[category] || '#8b6b4a';
          const isRejection = category === 'Rejection';

          return (
            <div
              key={category}
              className="p-3 rounded-xl"
              style={{
                background: 'white',
                borderLeft: `3px solid ${isRejection ? '#8b4a4a' : color}`,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold" style={{ color: isRejection ? '#8b4a4a' : 'var(--t-ink)' }}>
                  {category}
                </span>
                <span
                  className="text-[9px]"
                  style={{ color: INK['90'], fontFamily: FONT.mono }}
                >
                  {terms.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {terms.map(term => (
                  <span
                    key={term}
                    className="text-[9px] px-2 py-0.5 rounded-full"
                    style={{
                      background: isRejection ? 'rgba(139,74,74,0.08)' : `${color}10`,
                      color: isRejection ? '#8b4a4a' : color,
                      fontFamily: FONT.sans,
                    }}
                  >
                    {term}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// MATCHED PROPERTIES — Top matches with scores
// ═══════════════════════════════════════════
function MatchesSection() {
  return (
    <div className="px-4 pb-8" style={{ background: 'var(--t-cream)' }}>
      <h3
        className="text-[10px] uppercase tracking-[0.2em] mb-4"
        style={{ color: '#8a6a2a', fontFamily: FONT.mono, fontWeight: 700 }}
      >
        Top Matches
      </h3>
      <div className="flex flex-col gap-3">
        {profile.matchedProperties.map((prop) => (
          <div
            key={prop.name}
            className="p-4 rounded-xl"
            style={{ background: 'white', border: '1px solid var(--t-linen)' }}
          >
            <div className="flex items-start gap-3">
              <ScoreArc score={prop.score} color="#4a6741" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold" style={{ color: 'var(--t-ink)' }}>
                  {prop.name}
                </div>
                <div className="text-[11px] mb-2" style={{ color: INK['95'] }}>
                  {prop.location}
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {prop.matchReasons.map(reason => (
                    <span
                      key={reason}
                      className="text-[9px] px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(74,103,65,0.08)', color: '#4a6741' }}
                    >
                      {reason}
                    </span>
                  ))}
                </div>
                <p
                  className="text-[10px] italic leading-snug"
                  style={{ color: INK['95'] }}
                >
                  {prop.tensionResolved}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
