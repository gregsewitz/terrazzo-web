'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLibraryStore } from '@/stores/useLibraryStore';
import { useTripStore } from '@/stores/tripStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { FONT, TEXT, COLOR, INK } from '@/constants/theme';
import { getMatchTierByLabel } from '@/lib/match-tier';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import type { BecauseYouCard } from '@/constants/discover';
import type { DiscoverContent } from '@/hooks/useDiscoverFeed';

interface EvolvingWelcomeProps {
  discoverContent: DiscoverContent | null;
  isLoadingDiscover: boolean;
}

type WelcomeState = 'first-light' | 'building' | 'planning' | 'curating' | 'returning';

// ─── State determination logic ─────────────────────────────────────────────

function getWelcomeState(args: {
  userSavedCount: number;
  tripCount: number;
  hasActivePlan: boolean;
  totalPlacedCount: number;
  isReturnVisit: boolean;
  sessionCount: number;
}): WelcomeState {
  const { userSavedCount, tripCount, hasActivePlan, totalPlacedCount, isReturnVisit, sessionCount } = args;

  // Power users (lots of saves + multiple sessions) → always returning
  if (sessionCount >= 3 && userSavedCount >= 20) return 'returning';
  // Return visit with meaningful activity → returning
  if (isReturnVisit && (hasActivePlan || userSavedCount >= 10)) return 'returning';
  // Established library → curating
  if (userSavedCount >= 10 || (tripCount >= 2 && totalPlacedCount >= 5)) return 'curating';
  // Active trip planning → planning
  if (hasActivePlan && userSavedCount < 10) return 'planning';
  // Some saves → building
  if (userSavedCount >= 1) return 'building';
  return 'first-light';
}

// ─── Card component for displaying individual places ─────────────────────

function WelcomeCard({ card, index }: { card: BecauseYouCard; index: number }) {
  const tier = getMatchTierByLabel(card.matchTier);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="flex-shrink-0 rounded-xl p-3 flex flex-col justify-between"
      style={{
        background: 'white',
        border: `1px solid ${INK['06']}`,
        width: 200,
        minHeight: 140,
      }}
    >
      <div>
        <div className="text-[15px] font-semibold line-clamp-2" style={{ color: TEXT.primary, fontFamily: FONT.sans }}>
          {card.place}
        </div>
        <div className="text-[12px] mt-1" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
          {card.location}
        </div>
      </div>

      <div>
        <div className="text-[13px] leading-relaxed mb-2" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>
          {card.why}
        </div>
        {card.matchTier !== undefined && (
          <div
            className="text-[11px] font-semibold px-2 py-1 rounded w-fit"
            style={{ background: tier.bg, color: tier.color, fontFamily: FONT.mono }}
          >
            {tier.shortLabel}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

export default function EvolvingWelcome({ discoverContent, isLoadingDiscover }: EvolvingWelcomeProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('terrazzo_welcome_collapsed');
      return stored === 'true';
    }
    return false;
  });

  // Get data from stores
  const myPlaces = useLibraryStore(s => s.myPlaces);
  const trips = useTripStore(s => s.trips);
  const generatedProfile = useOnboardingStore(s => s.generatedProfile);
  const lifeContext = useOnboardingStore(s => s.lifeContext);

  // Track session count for return visits
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentCount = parseInt(sessionStorage.getItem('terrazzo_session_count') || '0', 10);
    sessionStorage.setItem('terrazzo_session_count', String(currentCount + 1));
  }, []);

  // Persist collapsed state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('terrazzo_welcome_collapsed', String(collapsed));
    }
  }, [collapsed]);

  // ── Compute welcome state ──

  // Count user-saved places (exclude Terrazzo-seeded places)
  const userSavedCount = useMemo(() => {
    return myPlaces.filter(p => !(p.source?.type === 'terrazzo' && p.source?.name === 'Terrazzo Picks')).length;
  }, [myPlaces]);

  const tripCount = trips.length;

  // Check for active plan: any trip with placed slots
  const hasActivePlan = useMemo(() => {
    return trips.some(t =>
      t.days?.some(d =>
        d.slots?.some(s => s.places && s.places.length > 0)
      )
    );
  }, [trips]);

  // Count total placed items
  const totalPlacedCount = useMemo(() => {
    return trips.reduce((sum, t) => {
      return sum + (t.days?.reduce((ds, d) => {
        return ds + (d.slots?.reduce((ss, s) => ss + (s.places?.length || 0), 0) || 0);
      }, 0) || 0);
    }, 0);
  }, [trips]);

  // Check for return visit using persistent session count (from useAlphaFeedback)
  const sessionCount = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(localStorage.getItem('terrazzo_total_sessions') || '0', 10);
  }, []);
  const isReturnVisit = sessionCount > 1;

  const welcomeState = getWelcomeState({
    userSavedCount,
    tripCount,
    hasActivePlan,
    totalPlacedCount,
    isReturnVisit,
    sessionCount,
  });

  const firstName = lifeContext?.firstName || 'there';
  const archetype = generatedProfile?.overallArchetype || 'you';

  // ── Render state-specific content ──

  const renderContent = () => {
    const cards = discoverContent?.becauseYouCards || [];

    switch (welcomeState) {
      case 'first-light':
        return (
          <>
            <p className="text-[18px] mb-4" style={{ fontFamily: FONT.serif, color: TEXT.primary }}>
              Welcome to your Terrazzo, {firstName}. We've been getting to know your taste — here's what {archetype.toLowerCase()} looks like in the wild.
            </p>

            {isLoadingDiscover ? (
              <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="flex-shrink-0 rounded-xl animate-pulse"
                    style={{ width: 200, height: 140, background: `${INK['06']}` }}
                  />
                ))}
              </div>
            ) : cards.length > 0 ? (
              <>
                <div className="flex gap-3 overflow-x-auto pb-2 -mr-5 pr-5 mb-3" style={{ scrollbarWidth: 'none' }}>
                  {cards.slice(0, 3).map((card, idx) => (
                    <WelcomeCard key={card.place} card={card} index={idx} />
                  ))}
                </div>
                <p className="text-[12px] italic" style={{ fontFamily: FONT.mono, color: TEXT.secondary }}>
                  Save the ones that resonate. Skip the ones that don't — we'll learn from both.
                </p>
              </>
            ) : null}
          </>
        );

      case 'building':
        return (
          <>
            <p className="text-[18px] mb-4" style={{ fontFamily: FONT.serif, color: TEXT.primary }}>
              {userSavedCount} place{userSavedCount !== 1 ? 's' : ''} in your library. Your taste is starting to take shape on the map.
            </p>
            <div className="space-y-2 mb-3">
              {myPlaces.filter(p => !(p.source?.type === 'terrazzo' && p.source?.name === 'Terrazzo Picks')).slice(0, 3).map(place => (
                <div
                  key={place.id}
                  className="py-2 px-3 rounded-lg"
                  style={{ background: INK['04'], border: `1px solid ${INK['06']}` }}
                >
                  <div className="text-[15px] font-semibold" style={{ color: TEXT.primary, fontFamily: FONT.sans }}>
                    {place.name}
                  </div>
                  <div className="text-[12px]" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
                    {place.location}
                  </div>
                </div>
              ))}
            </div>
            <a
              href="/trips/new"
              className="block py-3 px-4 rounded-lg text-center font-semibold transition-opacity hover:opacity-80"
              style={{ background: 'var(--t-navy)', color: 'white', fontFamily: FONT.sans, fontSize: 15 }}
            >
              Ready to plan? Pick a destination
            </a>
          </>
        );

      case 'planning': {
        const activeTrip = trips.reduce((best, t) => {
          const count = t.days?.reduce((ds, d) => ds + (d.slots?.reduce((ss, s) => ss + (s.places?.length || 0), 0) || 0), 0) || 0;
          const bestCount = best.days?.reduce((ds, d) => ds + (d.slots?.reduce((ss, s) => ss + (s.places?.length || 0), 0) || 0), 0) || 0;
          return count > bestCount ? t : best;
        }, trips[0]);

        return (
          <>
            <p className="text-[18px] mb-4" style={{ fontFamily: FONT.serif, color: TEXT.primary }}>
              {activeTrip?.name} is coming together. A few more places we think belong on this trip:
            </p>

            {isLoadingDiscover ? (
              <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                {[0, 1].map(i => (
                  <div
                    key={i}
                    className="flex-shrink-0 rounded-xl animate-pulse"
                    style={{ width: 200, height: 140, background: `${INK['06']}` }}
                  />
                ))}
              </div>
            ) : cards.length > 0 ? (
              <>
                <div className="flex gap-3 overflow-x-auto pb-2 -mr-5 pr-5 mb-3" style={{ scrollbarWidth: 'none' }}>
                  {cards.slice(0, 2).map((card, idx) => (
                    <div key={card.place} className="relative">
                      <WelcomeCard card={card} index={idx} />
                      <div
                        className="absolute top-3 right-3 text-[10px] font-semibold px-2 py-1 rounded"
                        style={{ background: 'var(--t-coral)', color: 'white', fontFamily: FONT.mono }}
                      >
                        Add
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[12px] italic" style={{ fontFamily: FONT.mono, color: TEXT.secondary }}>
                  You can also paste any link or article into the + bar to import places you've already found.
                </p>
              </>
            ) : null}
          </>
        );
      }

      case 'curating':
        return (
          <>
            <p className="text-[18px] mb-4" style={{ fontFamily: FONT.serif, color: TEXT.primary }}>
              {userSavedCount} place{userSavedCount !== 1 ? 's' : ''}, {tripCount} trip{tripCount !== 1 ? 's' : ''}. Terrazzo is learning — here's what's new for your taste this week.
            </p>

            {isLoadingDiscover ? (
              <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                {[0, 1].map(i => (
                  <div
                    key={i}
                    className="flex-shrink-0 rounded-xl animate-pulse"
                    style={{ width: 200, height: 140, background: `${INK['06']}` }}
                  />
                ))}
              </div>
            ) : cards.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2 -mr-5 pr-5" style={{ scrollbarWidth: 'none' }}>
                {cards.slice(0, 2).map((card, idx) => (
                  <div key={card.place} className="relative">
                    <WelcomeCard card={card} index={idx} />
                    <div
                      className="absolute top-3 left-3 text-[9px] font-semibold px-2 py-1 rounded"
                      style={{ background: 'var(--t-coral)', color: 'white', fontFamily: FONT.mono }}
                    >
                      New
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        );

      case 'returning': {
        const upcomingTrip = trips.find(t => {
          if (!t.startDate) return false;
          const diff = new Date(t.startDate).getTime() - Date.now();
          return diff > 0 && diff < 6 * 7 * 24 * 60 * 60 * 1000;
        });

        const weeksUntil = upcomingTrip
          ? Math.round((new Date(upcomingTrip.startDate!).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))
          : null;

        return (
          <>
            {upcomingTrip && weeksUntil ? (
              <p className="text-[18px] mb-4" style={{ fontFamily: FONT.serif, color: TEXT.primary }}>
                Welcome back. {upcomingTrip.name} is {weeksUntil} week{weeksUntil !== 1 ? 's' : ''} out. Here's one more for {upcomingTrip.location}.
              </p>
            ) : (
              <p className="text-[18px] mb-4" style={{ fontFamily: FONT.serif, color: TEXT.primary }}>
                Welcome back. Since you were last here, we found new matches for your taste.
              </p>
            )}

            {isLoadingDiscover ? (
              <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                {[0].map(i => (
                  <div
                    key={i}
                    className="flex-shrink-0 rounded-xl animate-pulse"
                    style={{ width: 200, height: 140, background: `${INK['06']}` }}
                  />
                ))}
              </div>
            ) : cards.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2 -mr-5 pr-5" style={{ scrollbarWidth: 'none' }}>
                {cards.slice(0, 1).map((card, idx) => (
                  <WelcomeCard key={card.place} card={card} index={idx} />
                ))}
              </div>
            ) : null}
          </>
        );
      }

      default:
        return null;
    }
  };

  // ── Main render ──

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mx-5 mb-6 rounded-2xl overflow-hidden"
      style={{
        padding: 20,
        background: 'linear-gradient(135deg, rgba(58,128,136,0.04) 0%, rgba(238,113,109,0.04) 100%)',
        border: `1px solid ${INK['10']}`,
      }}
    >
      {collapsed ? (
        /* Collapsed: single row with text + toggle */
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0" style={{ fontFamily: FONT.serif, color: TEXT.primary, fontSize: 16, fontStyle: 'italic', lineHeight: 1.4 }}>
            {welcomeState === 'first-light' && `Welcome to your Terrazzo, ${firstName}.`}
            {welcomeState === 'building' && `${userSavedCount} place${userSavedCount !== 1 ? 's' : ''} saved — your taste is taking shape.`}
            {welcomeState === 'planning' && `Planning ${trips[0]?.name || 'your trip'} — keep adding places.`}
            {welcomeState === 'curating' && `${userSavedCount} places, ${tripCount} trips — here's what's new.`}
            {welcomeState === 'returning' && `Welcome back — new matches since your last visit.`}
          </div>
          <button
            onClick={() => setCollapsed(false)}
            className="flex-shrink-0 p-1 transition-opacity hover:opacity-60"
            aria-label="Expand welcome"
          >
            <PerriandIcon
              name="arrow-right"
              size={16}
              color={TEXT.secondary}
              style={{ transform: 'rotate(-90deg)', transition: 'transform 0.3s ease' }}
            />
          </button>
        </div>
      ) : (
        /* Expanded: content with toggle in top-right */
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {renderContent()}
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className="flex-shrink-0 p-1 transition-opacity hover:opacity-60"
            style={{ marginTop: -4 }}
            aria-label="Collapse welcome"
          >
            <PerriandIcon
              name="arrow-right"
              size={16}
              color={TEXT.secondary}
              style={{ transform: 'rotate(90deg)', transition: 'transform 0.3s ease' }}
            />
          </button>
        </div>
      )}
    </motion.div>
  );
}
