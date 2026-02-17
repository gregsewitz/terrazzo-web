'use client';

import Link from 'next/link';
import TabBar from '@/components/TabBar';
import RadarChart from '@/components/profile/RadarChart';
import ScoreArc from '@/components/profile/ScoreArc';
import { TASTE_PROFILE, DOMAIN_COLORS } from '@/constants/profile';
import {
  BECAUSE_YOU_CARDS,
  WEEKLY_COLLECTION,
  STRETCH_PICK,
  SUMMER_RECS,
  FRIEND_SAVES,
  type BecauseYouCard,
  type CollectionPlace,
  type FriendSave,
  type ContextRec,
} from '@/constants/discover';

const profile = TASTE_PROFILE;

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DiscoverPage() {
  return (
    <div className="min-h-screen pb-16" style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}>
      <HeroSection />
      <BecauseYouSection />
      <ContradictionSection />
      <WeeklyEditSection />
      <StretchPickSection />
      <ContextModeSection />
      <VocabTeaser />
      <FriendsSavingSection />
      <TabBar />
    </div>
  );
}

// ═══════════════════════════════════════════
// 1. HERO — Personalized greeting + radar
// ═══════════════════════════════════════════
function HeroSection() {
  return (
    <div className="px-5 pt-8 pb-6">
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-[28px] mb-1 leading-tight"
            style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}
          >
            {getGreeting()}, Greg
          </h1>
          <p
            className="text-[12px] leading-relaxed"
            style={{ color: 'rgba(28,26,23,0.7)', fontFamily: "'DM Sans', sans-serif" }}
          >
            Based on 238 signals across 6 dimensions
          </p>
        </div>
        <Link href="/profile" className="flex-shrink-0 mt-1" style={{ opacity: 0.85 }}>
          <RadarChart data={profile.radarData} size={64} />
        </Link>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 2. "BECAUSE YOU..." — Insight cards
// ═══════════════════════════════════════════
function BecauseYouSection() {
  return (
    <div className="mb-6">
      <div className="px-5 mb-3">
        <SectionLabel>Because you...</SectionLabel>
      </div>
      <div
        className="flex gap-3 px-5 overflow-x-auto pb-2"
        style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}
      >
        {BECAUSE_YOU_CARDS.map((card) => (
          <BecauseYouCardComponent key={card.place} card={card} />
        ))}
      </div>
    </div>
  );
}

function BecauseYouCardComponent({ card }: { card: BecauseYouCard }) {
  const domainColor = DOMAIN_COLORS[card.signalDomain] || '#8b6b4a';

  return (
    <div
      className="flex-shrink-0 p-5 rounded-2xl flex flex-col justify-between"
      style={{
        background: card.bg,
        width: 280,
        minHeight: 220,
        scrollSnapAlign: 'start',
      }}
    >
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span
            className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: `${domainColor}30`, color: domainColor, fontFamily: "'Space Mono', monospace" }}
          >
            {card.signalDomain}
          </span>
        </div>
        <p className="text-[13px] leading-relaxed mb-1" style={{ color: 'rgba(245,245,240,0.5)', fontFamily: "'DM Sans', sans-serif" }}>
          Because you love
        </p>
        <p
          className="text-[16px] font-semibold mb-4 italic"
          style={{ color: '#f5f5f0', fontFamily: "'DM Sans', sans-serif" }}
        >
          &ldquo;{card.signal}&rdquo;
        </p>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <ScoreArc score={card.score} size={32} color="#f5f5f0" />
          <div>
            <div className="text-[14px] font-semibold" style={{ color: '#f5f5f0' }}>
              {card.place}
            </div>
            <div className="text-[11px]" style={{ color: 'rgba(245,245,240,0.5)' }}>
              {card.location}
            </div>
          </div>
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(245,245,240,0.55)' }}>
          {card.why}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 3. CONTRADICTION RESOLVED — Feature card
// ═══════════════════════════════════════════
function ContradictionSection() {
  const c = profile.contradictions[0];

  return (
    <div className="px-5 mb-6">
      <SectionLabel>Your contradiction, resolved</SectionLabel>
      <div
        className="p-5 rounded-2xl mt-3"
        style={{ background: '#2e4a5c' }}
      >
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <div
              className="text-[9px] uppercase tracking-wider mb-1.5"
              style={{ color: 'rgba(245,245,240,0.35)', fontFamily: "'Space Mono', monospace" }}
            >
              You said
            </div>
            <p className="text-[13px] italic leading-snug" style={{ color: 'rgba(245,245,240,0.8)' }}>
              &ldquo;{c.stated}&rdquo;
            </p>
          </div>
          <div className="flex items-center" style={{ color: 'rgba(245,245,240,0.2)', fontFamily: "'DM Serif Display', serif", fontSize: 16 }}>
            vs
          </div>
          <div className="flex-1">
            <div
              className="text-[9px] uppercase tracking-wider mb-1.5"
              style={{ color: 'rgba(245,245,240,0.35)', fontFamily: "'Space Mono', monospace" }}
            >
              We found
            </div>
            <p className="text-[13px] italic leading-snug" style={{ color: 'rgba(245,245,240,0.8)' }}>
              &ldquo;{c.revealed}&rdquo;
            </p>
          </div>
        </div>

        <div
          className="p-3.5 rounded-xl"
          style={{ background: 'rgba(245,245,240,0.06)' }}
        >
          <div
            className="text-[9px] uppercase tracking-wider mb-1.5"
            style={{ color: 'rgba(245,245,240,0.4)', fontFamily: "'Space Mono', monospace" }}
          >
            We found a place that resolves this
          </div>
          <div className="flex items-center gap-2 mb-2">
            <ScoreArc score={97} size={30} color="#f5f5f0" />
            <div>
              <span className="text-[13px] font-semibold" style={{ color: '#f5f5f0' }}>Masseria Moroseta</span>
              <span className="text-[11px] ml-2" style={{ color: 'rgba(245,245,240,0.5)' }}>Puglia</span>
            </div>
          </div>
          <p className="text-[11px] italic leading-relaxed" style={{ color: 'rgba(245,245,240,0.55)' }}>
            &ldquo;{c.resolution}&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 4. THIS WEEK'S EDIT — Curated collection
// ═══════════════════════════════════════════
function WeeklyEditSection() {
  const collection = WEEKLY_COLLECTION;

  return (
    <div className="mb-6">
      <div className="px-5 mb-1">
        <SectionLabel>This week&apos;s edit</SectionLabel>
      </div>
      <div className="px-5 mb-3">
        <h3
          className="text-[18px] leading-snug mb-1"
          style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}
        >
          {collection.title}
        </h3>
        <p className="text-[11px]" style={{ color: 'rgba(28,26,23,0.7)', fontFamily: "'Space Mono', monospace" }}>
          {collection.subtitle}
        </p>
      </div>
      <div
        className="flex gap-3 px-5 overflow-x-auto pb-2"
        style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}
      >
        {collection.places.map((place) => (
          <CollectionCard key={place.name} place={place} />
        ))}
      </div>
    </div>
  );
}

function CollectionCard({ place }: { place: CollectionPlace }) {
  const domainColor = DOMAIN_COLORS[place.signalDomain] || '#8b6b4a';

  return (
    <div
      className="flex-shrink-0 p-4 rounded-xl flex flex-col"
      style={{
        background: 'white',
        border: '1px solid var(--t-linen)',
        width: 240,
        scrollSnapAlign: 'start',
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-[14px] font-semibold" style={{ color: 'var(--t-ink)' }}>{place.name}</div>
          <div className="text-[11px]" style={{ color: 'rgba(28,26,23,0.7)' }}>{place.location}</div>
        </div>
        <ScoreArc score={place.score} size={38} color="#4a6741" />
      </div>
      <div className="flex flex-wrap gap-1 mb-2.5">
        {place.signals.map(s => (
          <span
            key={s}
            className="text-[9px] px-2 py-0.5 rounded-full"
            style={{ background: `${domainColor}12`, color: domainColor, fontFamily: "'DM Sans', sans-serif" }}
          >
            {s}
          </span>
        ))}
      </div>
      <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(28,26,23,0.7)' }}>
        {place.note}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════
// 5. STRETCH PICK — Outside your comfort zone
// ═══════════════════════════════════════════
function StretchPickSection() {
  const s = STRETCH_PICK;

  return (
    <div className="px-5 mb-6">
      <SectionLabel color="var(--t-panton-orange)">Stretch pick</SectionLabel>
      <div
        className="p-4 rounded-xl mt-3"
        style={{
          background: 'white',
          border: '2px dashed var(--t-panton-orange)',
        }}
      >
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-[10px]" style={{ color: 'var(--t-panton-orange)', fontFamily: "'Space Mono', monospace" }}>◇</span>
          <span
            className="text-[10px] uppercase tracking-wider font-bold"
            style={{ color: 'var(--t-panton-orange)', fontFamily: "'Space Mono', monospace" }}
          >
            This isn&apos;t your usual pick
          </span>
        </div>

        <div className="flex items-start gap-3 mb-3">
          <ScoreArc score={s.score} size={44} color="var(--t-panton-orange)" />
          <div>
            <div className="text-[15px] font-semibold" style={{ color: 'var(--t-ink)' }}>{s.name}</div>
            <div className="text-[11px]" style={{ color: 'rgba(28,26,23,0.7)' }}>{s.location}</div>
            <div className="flex gap-2 mt-1.5">
              <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,107,139,0.1)', color: '#4a6b8b', fontFamily: "'Space Mono', monospace" }}>
                {s.strongAxis} {s.strongScore}%
              </span>
              <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(107,107,74,0.1)', color: '#6b6b4a', fontFamily: "'Space Mono', monospace" }}>
                {s.weakAxis} {s.weakScore}%
              </span>
            </div>
          </div>
        </div>

        <div
          className="p-3 rounded-lg"
          style={{ background: 'rgba(232,104,48,0.04)' }}
        >
          <div
            className="text-[9px] uppercase tracking-wider mb-1"
            style={{ color: 'var(--t-panton-orange)', fontFamily: "'Space Mono', monospace" }}
          >
            Why we&apos;re suggesting it
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(28,26,23,0.7)' }}>
            {s.why}
          </p>
        </div>

        <p className="text-[10px] italic leading-relaxed mt-2.5" style={{ color: 'rgba(28,26,23,0.65)' }}>
          {s.tension}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 6. CONTEXT MODE — Seasonal recommendations
// ═══════════════════════════════════════════
function ContextModeSection() {
  return (
    <div className="px-5 mb-6">
      <SectionLabel>Context mode</SectionLabel>
      <div
        className="p-4 rounded-xl mt-3"
        style={{ background: 'white', border: '1px solid var(--t-linen)', borderTop: '3px solid #6b8b4a' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span style={{ fontSize: 16 }}>☀</span>
          <span
            className="text-[14px] font-semibold"
            style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}
          >
            If you&apos;re traveling this summer...
          </span>
        </div>
        <p className="text-[11px] mb-4" style={{ color: 'rgba(28,26,23,0.7)', fontFamily: "'Space Mono', monospace" }}>
          Indoor-outdoor flow · terrace dining · natural pool
        </p>

        <div className="flex flex-col gap-2.5">
          {SUMMER_RECS.map((rec) => (
            <ContextRecCard key={rec.name} rec={rec} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ContextRecCard({ rec }: { rec: ContextRec }) {
  return (
    <div className="flex items-center gap-3">
      <ScoreArc score={rec.score} size={36} color="#6b8b4a" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[12px] font-semibold" style={{ color: 'var(--t-ink)' }}>{rec.name}</span>
          <span className="text-[10px]" style={{ color: 'rgba(28,26,23,0.65)' }}>{rec.location}</span>
        </div>
        <p className="text-[10px] leading-snug" style={{ color: 'rgba(28,26,23,0.7)' }}>
          {rec.whyFits}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 7. VOCAB TEASER — Taste vocabulary preview
// ═══════════════════════════════════════════
function VocabTeaser() {
  // Pick 2-3 signals from each of the first 4 domains
  const domains = Object.entries(profile.microTasteSignals).slice(0, 4);
  const allTerms: Array<{ term: string; domain: string }> = [];
  domains.forEach(([domain, terms]) => {
    terms.slice(0, 2).forEach(term => allTerms.push({ term, domain }));
  });
  // Add a couple rejection signals
  const rejections = profile.microTasteSignals['Rejection']?.slice(0, 2) || [];
  rejections.forEach(term => allTerms.push({ term, domain: 'Rejection' }));

  return (
    <div className="px-5 mb-6">
      <SectionLabel>Your taste vocabulary</SectionLabel>
      <div
        className="p-4 rounded-xl mt-3"
        style={{ background: 'white', border: '1px solid var(--t-linen)' }}
      >
        <div className="flex flex-wrap gap-1.5 mb-3">
          {allTerms.map(({ term, domain }) => {
            const color = DOMAIN_COLORS[domain] || '#8b6b4a';
            const isRejection = domain === 'Rejection';
            return (
              <span
                key={term}
                className="text-[10px] px-2.5 py-1 rounded-full"
                style={{
                  background: isRejection ? 'rgba(139,74,74,0.08)' : `${color}12`,
                  color: isRejection ? '#8b4a4a' : color,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {term}
              </span>
            );
          })}
          <span
            className="text-[10px] px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(28,26,23,0.04)', color: 'rgba(28,26,23,0.6)' }}
          >
            +{Object.values(profile.microTasteSignals).flat().length - allTerms.length} more
          </span>
        </div>
        <Link
          href="/profile"
          className="text-[11px] font-semibold"
          style={{ color: 'var(--t-honey)', textDecoration: 'none', fontFamily: "'Space Mono', monospace" }}
        >
          See full profile →
        </Link>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 8. FRIENDS SAVING — Social signal
// ═══════════════════════════════════════════
function FriendsSavingSection() {
  return (
    <div className="px-5 mb-8">
      <SectionLabel>Friends are saving</SectionLabel>
      <div className="flex flex-col gap-3 mt-3">
        {FRIEND_SAVES.map((save) => (
          <FriendSaveCard key={save.place} save={save} />
        ))}
      </div>
    </div>
  );
}

function FriendSaveCard({ save }: { save: FriendSave }) {
  return (
    <div
      className="p-3.5 rounded-xl flex items-start gap-3"
      style={{ background: 'white', border: '1px solid var(--t-linen)' }}
    >
      {/* Friend avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
        style={{ background: `${save.color}15`, color: save.color, fontFamily: "'Space Mono', monospace" }}
      >
        {save.friendInitial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[11px] font-semibold" style={{ color: 'var(--t-ink)' }}>
            {save.friendName}
          </span>
          <span className="text-[11px]" style={{ color: 'rgba(28,26,23,0.65)' }}>saved</span>
          <span className="text-[11px] font-semibold" style={{ color: 'var(--t-ink)' }}>
            {save.place}
          </span>
        </div>
        <div className="text-[10px] mb-1" style={{ color: 'rgba(28,26,23,0.65)' }}>
          {save.location} · {save.type}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-bold"
            style={{ color: save.color, fontFamily: "'Space Mono', monospace" }}
          >
            {save.score}% match
          </span>
          <span className="text-[10px]" style={{ color: 'rgba(28,26,23,0.7)' }}>
            {save.whyMatches}
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Shared — Section label component
// ═══════════════════════════════════════════
function SectionLabel({ children, color = 'var(--t-honey)' }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      className="text-[10px] uppercase tracking-[0.2em] font-bold"
      style={{ color, fontFamily: "'Space Mono', monospace" }}
    >
      {children}
    </div>
  );
}
