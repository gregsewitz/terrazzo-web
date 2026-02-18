'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TabBar from '@/components/TabBar';
import ProfileDeepDive from '@/components/profile/ProfileDeepDive';
import WrappedExperience from '@/components/wrapped/WrappedExperience';
import { TerrazzoMosaic } from '@/components/TerrazzoMosaic';
import TasteStone from '@/components/profile/TasteStone';
import ScoreArc from '@/components/profile/ScoreArc';
import { TASTE_PROFILE, DOMAIN_COLORS } from '@/constants/profile';
import { DEFAULT_USER_PROFILE } from '@/lib/taste';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
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
import { getPlaceImage } from '@/constants/placeImages';

const profile = TASTE_PROFILE;

const SETTINGS_LINKS = [
  { label: 'Connected Accounts', action: 'accounts' },
  { label: 'Import History', action: 'history' },
  { label: 'Notification Preferences', action: 'notifications' },
  { label: 'About Terrazzo', action: 'about' },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

type ProfileTab = 'discover' | 'profile';

export default function ProfilePage() {
  const router = useRouter();
  const [showWrapped, setShowWrapped] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('discover');

  const handleSettingTap = (action: string) => {
    if (action === 'history') {
      router.push('/saved');
      return;
    }
    setExpandedSection(expandedSection === action ? null : action);
  };

  // Full-screen wrapped overlay
  if (showWrapped) {
    return <WrappedExperience onClose={() => setShowWrapped(false)} />;
  }

  return (
    <div className="min-h-screen pb-16" style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}>
      {/* User Header */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(200,146,58,0.1)' }}
            >
              <PerriandIcon name="profile" size={24} color="var(--t-honey)" />
            </div>
            <div>
              <div className="text-[15px] font-semibold" style={{ color: 'var(--t-ink)' }}>Greg</div>
              <div className="text-[11px]" style={{ color: 'rgba(28,26,23,0.9)' }}>The Aesthetic Pilgrim</div>
            </div>
          </div>
          <TerrazzoMosaic profile={DEFAULT_USER_PROFILE} size="xs" />
        </div>

        {/* Inner tab toggle: Discover / My Profile */}
        <div
          className="flex gap-1 p-0.5 rounded-lg mb-1"
          style={{ background: 'var(--t-linen)' }}
        >
          {(['discover', 'profile'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-1.5 px-2 rounded-md text-[11px] font-medium transition-all"
              style={{
                background: activeTab === tab ? 'white' : 'transparent',
                color: activeTab === tab ? 'var(--t-ink)' : 'rgba(28,26,23,0.85)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              {tab === 'discover' ? 'Discover' : 'My Profile'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'discover' ? (
        /* ═══════════ DISCOVER FEED ═══════════ */
        <>
          <HeroSection />
          <BecauseYouSection />
          <ContradictionSection />
          <WeeklyEditSection />
          <StretchPickSection />
          <ContextModeSection />
          <VocabTeaser />
          <FriendsSavingSection />
        </>
      ) : (
        /* ═══════════ MY PROFILE ═══════════ */
        <>
          {/* Replay Wrapped button */}
          <div className="px-5 pt-3">
            <button
              onClick={() => setShowWrapped(true)}
              className="w-full flex items-center justify-between p-4 rounded-xl mb-5 cursor-pointer border-none transition-all hover:opacity-90"
              style={{ background: '#2d3a2d' }}
            >
              <div className="flex flex-col items-start gap-1">
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: '#f5f5f0', fontFamily: "'DM Sans', sans-serif" }}
                >
                  Your Taste Wrapped
                </span>
                <span
                  className="text-[10px]"
                  style={{ color: 'rgba(245,245,240,0.5)', fontFamily: "'Space Mono', monospace" }}
                >
                  238 signals · 3 tensions · 35 taste terms
                </span>
              </div>
              <span
                className="text-[11px] px-3 py-1.5 rounded-full font-semibold"
                style={{
                  background: 'rgba(245,245,240,0.12)',
                  color: '#f5f5f0',
                  fontFamily: "'Space Mono', monospace",
                }}
              >
                Replay →
              </span>
            </button>
          </div>

          {/* Deep Dive */}
          <ProfileDeepDive />

          {/* Settings */}
          <div className="px-4 py-6">
            <h3
              className="text-[10px] uppercase tracking-[0.2em] mb-4"
              style={{ color: 'var(--t-honey)', fontFamily: "'Space Mono', monospace", fontWeight: 700 }}
            >
              Settings
            </h3>
            <div className="flex flex-col gap-2">
              {SETTINGS_LINKS.map(({ label, action }) => (
                <div key={action}>
                  <div
                    onClick={() => handleSettingTap(action)}
                    className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all"
                    style={{ background: expandedSection === action ? 'rgba(200,146,58,0.06)' : 'rgba(28,26,23,0.03)' }}
                  >
                    <span className="text-[12px]" style={{ color: 'var(--t-ink)' }}>{label}</span>
                    <span style={{ color: 'rgba(28,26,23,0.95)', transform: expandedSection === action ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>→</span>
                  </div>
                  {expandedSection === 'accounts' && action === 'accounts' && (
                    <div className="px-3 py-3 mt-1 rounded-xl" style={{ background: 'rgba(107,139,154,0.05)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <PerriandIcon name="email" size={12} color="var(--t-ink)" />
                          <span className="text-[11px]" style={{ color: 'var(--t-ink)' }}>Gmail</span>
                        </div>
                        <a
                          href="/api/auth/nylas/connect"
                          className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: 'var(--t-verde)', color: 'white', textDecoration: 'none' }}
                        >
                          Connect
                        </a>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <PerriandIcon name="location" size={12} color="var(--t-ink)" />
                          <span className="text-[11px]" style={{ color: 'var(--t-ink)' }}>Google Maps</span>
                        </div>
                        <span className="text-[10px] px-2.5 py-1 rounded-full" style={{ background: 'rgba(42,122,86,0.08)', color: 'var(--t-verde)' }}>
                          Via import
                        </span>
                      </div>
                    </div>
                  )}
                  {expandedSection === 'notifications' && action === 'notifications' && (
                    <div className="px-3 py-3 mt-1 rounded-xl text-[11px]" style={{ background: 'rgba(107,139,154,0.05)', color: 'rgba(28,26,23,0.95)' }}>
                      Notification preferences will be available in a future update.
                    </div>
                  )}
                  {expandedSection === 'about' && action === 'about' && (
                    <div className="px-3 py-3 mt-1 rounded-xl text-[11px]" style={{ background: 'rgba(107,139,154,0.05)', color: 'rgba(28,26,23,0.95)' }}>
                      Terrazzo v0.1 — Your taste-driven travel companion. Built with Forme Libere design principles.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <TabBar />
    </div>
  );
}


// ═══════════════════════════════════════════
// DISCOVER FEED SECTIONS (moved from /discover)
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

// 1. HERO — Greeting + signal count
function HeroSection() {
  return (
    <div className="px-5 pt-4 pb-5">
      <h2
        className="text-[22px] mb-1 leading-tight"
        style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}
      >
        {getGreeting()}, Greg
      </h2>
      <p
        className="text-[11px]"
        style={{ color: 'rgba(28,26,23,0.9)', fontFamily: "'Space Mono', monospace" }}
      >
        Based on 238 signals across 6 dimensions
      </p>
    </div>
  );
}

// 2. "BECAUSE YOU..." — Insight cards
function BecauseYouSection() {
  return (
    <div className="mb-6 px-5">
      <div className="mb-3">
        <SectionLabel>Because you...</SectionLabel>
      </div>
      <div
        className="flex gap-3 overflow-x-auto pb-2 -mr-5 pr-5"
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
          <PerriandIcon name="sparkle" size={12} color={domainColor} />
          <span
            className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: `${domainColor}40`, color: domainColor, fontFamily: "'Space Mono', monospace" }}
          >
            {card.signalDomain}
          </span>
        </div>
        <p className="text-[13px] leading-relaxed mb-1" style={{ color: 'rgba(245,245,240,0.7)', fontFamily: "'DM Sans', sans-serif" }}>
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
            <div className="text-[11px]" style={{ color: 'rgba(245,245,240,0.7)' }}>
              {card.location}
            </div>
          </div>
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(245,245,240,0.75)' }}>
          {card.why}
        </p>
      </div>
    </div>
  );
}

// 3. CONTRADICTION RESOLVED
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
              style={{ color: 'rgba(245,245,240,0.55)', fontFamily: "'Space Mono', monospace" }}
            >
              You said
            </div>
            <p className="text-[13px] italic leading-snug" style={{ color: 'rgba(245,245,240,0.9)' }}>
              &ldquo;{c.stated}&rdquo;
            </p>
          </div>
          <div className="flex items-center" style={{ color: 'rgba(245,245,240,0.35)', fontFamily: "'DM Serif Display', serif", fontSize: 16 }}>
            vs
          </div>
          <div className="flex-1">
            <div
              className="text-[9px] uppercase tracking-wider mb-1.5"
              style={{ color: 'rgba(245,245,240,0.55)', fontFamily: "'Space Mono', monospace" }}
            >
              We found
            </div>
            <p className="text-[13px] italic leading-snug" style={{ color: 'rgba(245,245,240,0.9)' }}>
              &ldquo;{c.revealed}&rdquo;
            </p>
          </div>
        </div>

        <div
          className="p-3.5 rounded-xl"
          style={{ background: 'rgba(245,245,240,0.08)' }}
        >
          <div
            className="text-[9px] uppercase tracking-wider mb-1.5"
            style={{ color: 'rgba(245,245,240,0.6)', fontFamily: "'Space Mono', monospace" }}
          >
            We found a place that resolves this
          </div>
          <div className="flex items-center gap-2 mb-2">
            <ScoreArc score={97} size={30} color="#f5f5f0" />
            <div>
              <span className="text-[13px] font-semibold" style={{ color: '#f5f5f0' }}>Masseria Moroseta</span>
              <span className="text-[11px] ml-2" style={{ color: 'rgba(245,245,240,0.7)' }}>Puglia</span>
            </div>
          </div>
          <p className="text-[11px] italic leading-relaxed" style={{ color: 'rgba(245,245,240,0.75)' }}>
            &ldquo;{c.resolution}&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}

// 4. THIS WEEK'S EDIT
function WeeklyEditSection() {
  const collection = WEEKLY_COLLECTION;

  return (
    <div className="mb-6 px-5">
      <div className="mb-1">
        <SectionLabel>This week&apos;s edit</SectionLabel>
      </div>
      <div className="mb-3">
        <h3
          className="text-[18px] leading-snug mb-1"
          style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}
        >
          {collection.title}
        </h3>
        <p className="text-[11px]" style={{ color: 'rgba(28,26,23,0.95)', fontFamily: "'Space Mono', monospace" }}>
          {collection.subtitle}
        </p>
      </div>
      <div
        className="flex gap-3 overflow-x-auto pb-2 -mr-5 pr-5"
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
  const imageUrl = getPlaceImage(place.name);

  return (
    <div
      className="flex-shrink-0 rounded-xl flex flex-col overflow-hidden"
      style={{
        background: 'white',
        border: '1px solid var(--t-linen)',
        width: 240,
        scrollSnapAlign: 'start',
      }}
    >
      {imageUrl && (
        <div style={{ height: 100, overflow: 'hidden' }}>
          <img src={imageUrl} alt={place.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}
      <div className="p-4 flex flex-col">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-[14px] font-semibold" style={{ color: 'var(--t-ink)' }}>{place.name}</div>
            <div className="text-[11px]" style={{ color: 'rgba(28,26,23,0.95)' }}>{place.location}</div>
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
        <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(28,26,23,0.95)' }}>
          {place.note}
        </p>
      </div>
    </div>
  );
}

// 5. STRETCH PICK
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
          <PerriandIcon name="discover" size={10} color="var(--t-panton-orange)" />
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
            <div className="text-[11px]" style={{ color: 'rgba(28,26,23,0.95)' }}>{s.location}</div>
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
          <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(28,26,23,0.95)' }}>
            {s.why}
          </p>
        </div>

        <p className="text-[10px] italic leading-relaxed mt-2.5" style={{ color: 'rgba(28,26,23,0.9)' }}>
          {s.tension}
        </p>
      </div>
    </div>
  );
}

// 6. CONTEXT MODE
function ContextModeSection() {
  return (
    <div className="px-5 mb-6">
      <SectionLabel>Context mode</SectionLabel>
      <div
        className="p-4 rounded-xl mt-3"
        style={{ background: 'white', border: '1px solid var(--t-linen)', borderTop: '3px solid #6b8b4a' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <PerriandIcon name="summer" size={16} color="var(--t-ink)" />
          <span
            className="text-[14px] font-semibold"
            style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}
          >
            If you&apos;re traveling this summer...
          </span>
        </div>
        <p className="text-[11px] mb-4" style={{ color: 'rgba(28,26,23,0.95)', fontFamily: "'Space Mono', monospace" }}>
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
  const imageUrl = getPlaceImage(rec.name);
  return (
    <div className="flex items-center gap-3">
      {imageUrl ? (
        <div style={{ width: 36, height: 36, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
          <img src={imageUrl} alt={rec.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      ) : (
        <ScoreArc score={rec.score} size={36} color="#6b8b4a" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[12px] font-semibold" style={{ color: 'var(--t-ink)' }}>{rec.name}</span>
          <span className="text-[10px]" style={{ color: 'rgba(28,26,23,0.9)' }}>{rec.location}</span>
        </div>
        <p className="text-[10px] leading-snug" style={{ color: 'rgba(28,26,23,0.95)' }}>
          {rec.whyFits}
        </p>
      </div>
    </div>
  );
}

// 7. VOCAB TEASER
function VocabTeaser() {
  const domains = Object.entries(profile.microTasteSignals).slice(0, 4);
  const allTerms: Array<{ term: string; domain: string }> = [];
  domains.forEach(([domain, terms]) => {
    terms.slice(0, 2).forEach(term => allTerms.push({ term, domain }));
  });
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
            style={{ background: 'rgba(28,26,23,0.04)', color: 'rgba(28,26,23,0.9)' }}
          >
            +{Object.values(profile.microTasteSignals).flat().length - allTerms.length} more
          </span>
        </div>
        <button
          onClick={() => {/* already on profile page, could scroll to deep dive */}}
          className="text-[11px] font-semibold bg-transparent border-none cursor-pointer"
          style={{ color: 'var(--t-honey)', fontFamily: "'Space Mono', monospace" }}
        >
          See full profile →
        </button>
      </div>
    </div>
  );
}

// 8. FRIENDS SAVING
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
          <span className="text-[11px]" style={{ color: 'rgba(28,26,23,0.9)' }}>saved</span>
          <span className="text-[11px] font-semibold" style={{ color: 'var(--t-ink)' }}>
            {save.place}
          </span>
        </div>
        <div className="text-[10px] mb-1" style={{ color: 'rgba(28,26,23,0.9)' }}>
          {save.location} · {save.type}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-bold"
            style={{ color: save.color, fontFamily: "'Space Mono', monospace" }}
          >
            {save.score}% match
          </span>
          <span className="text-[10px]" style={{ color: 'rgba(28,26,23,0.95)' }}>
            {save.whyMatches}
          </span>
        </div>
      </div>
    </div>
  );
}
