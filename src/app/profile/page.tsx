'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import PageTransition from '@/components/ui/PageTransition';
import { SafeMotionButton } from '@/components/animations/AnimatedElements';
import TabBar from '@/components/ui/TabBar';
import DesktopNav from '@/components/ui/DesktopNav';
import ProfileDeepDive from '@/components/profile/ProfileDeepDive';
import ExpandMosaicView from '@/components/profile/ExpandMosaicView';
import WrappedExperience from '@/components/wrapped/WrappedExperience';
import { TerrazzoMosaic } from '@/components/TerrazzoMosaic';
import { TASTE_PROFILE, DIMENSION_COLORS } from '@/constants/profile';
import type { TasteProfile as NumericProfile, ImportedPlace } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import BrandLoader from '@/components/ui/BrandLoader';
import { COLOR, FONT, INK, TEXT } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { PlaceDetailProvider } from '@/context/PlaceDetailContext';
import { useSavedStore } from '@/stores/savedStore';
import { useEmailScanStore } from '@/stores/emailScanStore';
import { useDiscoverFeed, type DiscoverContent } from '@/hooks/useDiscoverFeed';
import { SettingsPanel } from '@/components/profile/SettingsPanel';
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
      <ProfilePageContent />
    </PlaceDetailProvider>
  );
}

function ProfilePageContent() {

  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [showWrapped, setShowWrapped] = useState(false);
  const [showMosaic, setShowMosaic] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [activeTab, setActiveTabRaw] = useState<ProfileTab>(() => {
    if (typeof window !== 'undefined') {
      return (sessionStorage.getItem('profile_active_tab') as ProfileTab) || 'discover';
    }
    return 'discover';
  });
  const setActiveTab = useCallback((tab: ProfileTab) => {
    setActiveTabRaw(tab);
    sessionStorage.setItem('profile_active_tab', tab);
  }, []);
  const [isResynthesizing, setIsResynthesizing] = useState(false);
  const [resynthesisResult, setResynthesisResult] = useState<'success' | 'error' | null>(null);

  // ── Email / Connected Accounts state ─────────────────────────────────────
  const [emailStatus, setEmailStatus] = useState<{
    connected: boolean;
    email?: string;
    provider?: string;
    connectedAt?: string;
  } | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  // Email scan — driven by global Zustand store (survives navigation)
  const scanProgress = useEmailScanStore(s => s.progress);
  const startScan = useEmailScanStore(s => s.startScan);
  const resumeScan = useEmailScanStore(s => s.resumeIfNeeded);
  const scanState = scanProgress.status;
  const scanResult = {
    scanId: scanProgress.scanId,
    emailsFound: scanProgress.emailsFound,
    emailsParsed: scanProgress.emailsParsed,
    reservationsFound: scanProgress.reservationsFound,
  };

  const [importHistory, setImportHistory] = useState<Array<{
    id: string;
    type: 'email-scan' | 'url-import' | 'manual';
    date: string;
    title: string;
    subtitle: string;
    count: number;
    status?: string;
    scanId?: string;
  }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const hasGoogleMapsImport = importHistory.some(h => h.title.toLowerCase().includes('google maps') || h.title.toLowerCase().includes('google-maps'));

  const { isAuthenticated, user, signOut } = useAuth();
  const resetForRedo = useOnboardingStore(s => s.resetForRedo);
  const triggerResynthesis = useOnboardingStore(s => s.triggerResynthesis);
  const generatedProfile = useOnboardingStore(s => s.generatedProfile);
  const lifeContext = useOnboardingStore(s => s.lifeContext);
  const allSignals = useOnboardingStore(s => s.allSignals);
  const dbHydrated = useOnboardingStore(s => s.dbHydrated);


  // Restore scroll position after back-navigation from a place detail page
  useEffect(() => {
    const savedY = sessionStorage.getItem('profile_scroll_y');
    if (savedY) {
      sessionStorage.removeItem('profile_scroll_y');
      // Delay to let content render before scrolling
      requestAnimationFrame(() => {
        window.scrollTo(0, parseInt(savedY, 10));
      });
    }
  }, []);

  // DB is the source of truth — show loading until hydration completes,
  // then use the real profile (no hardcoded demo fallback for auth users)
  const profile = generatedProfile || TASTE_PROFILE;
  const userName = lifeContext?.firstName || user?.email?.split('@')[0] || '';
  const signalCount = allSignals?.length || 0;

  // Build numeric profile for mosaic visualization from radar data
  const numericProfile: NumericProfile = useMemo(() => {
    const result: NumericProfile = { Design: 0.5, Atmosphere: 0.5, Character: 0.5, Service: 0.5, FoodDrink: 0.5, Geography: 0.5, Wellness: 0.5, Sustainability: 0.5 };
    const radarData = (profile as { radarData?: { axis: string; value: number }[] }).radarData;
    if (radarData) {
      for (const r of radarData) {
        if (r.axis in result) {
          result[r.axis as keyof NumericProfile] = Math.max(result[r.axis as keyof NumericProfile], r.value);
        }
      }
    }
    return result;
  }, [profile]);

  // Use the discover feed hook for all discover content and infinite scroll logic
  const {
    discoverContent,
    isLoadingDiscover,
    extraPages,
    isLoadingMore,
    hasMoreContent,
    sentinelRef,
    fetchDiscoverContent,
  } = useDiscoverFeed(generatedProfile, lifeContext, profile);

  const handleSettingTap = (action: string) => {
    const next = expandedSection === action ? null : action;
    setExpandedSection(next);
    // Fetch email status when accounts panel opens
    if (next === 'accounts' && !emailStatus) fetchEmailStatus();
    // Fetch import history when accounts or history panel opens (needed for Google Maps status)
    if ((next === 'accounts' || next === 'history') && importHistory.length === 0) fetchImportHistory();
  };

  const fetchEmailStatus = async () => {
    setEmailLoading(true);
    try {
      const data = await apiFetch<{ connected: boolean; email?: string; provider?: string; connectedAt?: string }>('/api/email/status');
      setEmailStatus(data);
      // If connected and we don't already have scan state, check for latest scan
      if (data.connected && scanState === 'idle') {
        resumeScan();
      }
    } catch { setEmailStatus({ connected: false }); }
    finally { setEmailLoading(false); }
  };

  const handleDisconnect = async () => {
    try {
      await apiFetch('/api/auth/nylas/disconnect', { method: 'POST' });
      setEmailStatus({ connected: false });
      useEmailScanStore.getState().reset();
    } catch (err) { console.error('Disconnect failed:', err); }
  };

  const handleScanNow = () => {
    startScan();
  };

  const handleDebugEmail = async () => {
    try {
      const data = await apiFetch<Record<string, unknown>>('/api/email/debug');
      console.log('[terrazzo] EMAIL DEBUG:', JSON.stringify(data, null, 2));
      alert(`Debug result — check console.\nRecent emails: ${JSON.stringify((data.tests as Record<string, unknown> & { recentMessages: { count: number } })?.recentMessages?.count ?? 'error')}`);
    } catch (err) {
      console.error('[terrazzo] Debug failed:', err);
      alert('Debug failed — check console');
    }
  };

  const fetchImportHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await apiFetch<{ timeline: Array<{ id: string; type: 'email-scan' | 'url-import' | 'manual'; date: string; title: string; subtitle: string; count: number; status?: string; scanId?: string }> }>('/api/import-history');
      setImportHistory(data.timeline || []);
    } catch { /* ignore */ }
    finally { setHistoryLoading(false); }
  };

  const handleResynthesis = async () => {
    setIsResynthesizing(true);
    setResynthesisResult(null);
    const ok = await triggerResynthesis();
    setIsResynthesizing(false);
    setResynthesisResult(ok ? 'success' : 'error');
    // Clear the discover cache so it regenerates with new profile
    if (ok) {
      try {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('terrazzo_discover_'));
        keys.forEach(k => localStorage.removeItem(k));
      } catch { /* ignore */ }
      // Re-fetch discover content
      fetchDiscoverContent();
    }
    // Auto-clear the result badge after 4s
    setTimeout(() => setResynthesisResult(null), 4000);
  };

  const handleRedoOnboarding = () => {
    resetForRedo();
    router.push('/onboarding');
  };

  // Wait for DB hydration before rendering profile data
  if (!dbHydrated) {
    return <BrandLoader message="Loading your profile…" />;
  }

  // Full-screen overlays
  if (showWrapped) {
    return <WrappedExperience onClose={() => setShowWrapped(false)} />;
  }
  if (showMosaic) {
    return <ExpandMosaicView onClose={() => setShowMosaic(false)} />;
  }

  /* ─── Shared header + tab component ─── */
  const headerBlock = (
    <>
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(238,113,109,0.1)' }}
          >
            <PerriandIcon name="profile" size={24} color="var(--t-honey)" />
          </div>
          <div>
            <div className="text-[15px] font-semibold" style={{ color: TEXT.primary }}>{userName}</div>
            <div className="text-[11px]" style={{ color: TEXT.secondary }}>{profile.overallArchetype}</div>
          </div>
        </div>
        <TerrazzoMosaic profile={numericProfile} size="xs" />
      </div>

      {/* Inner tab toggle */}
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
              color: activeTab === tab ? 'var(--t-ink)' : INK['85'],
              border: 'none',
              cursor: 'pointer',
              fontFamily: FONT.sans,
              boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            {tab === 'discover' ? 'Discover' : 'My Profile'}
          </button>
        ))}
      </div>
    </>
  );

  const discoverFeed = (
    <>
      {/* Initial feed — all sections visible */}
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

      {/* Extra pages loaded via infinite scroll */}
      {extraPages.map((page, i) => (
        <div key={`extra-page-${i}`}>
          {/* Subtle divider between pages */}
          <div className="flex items-center gap-4 my-10 px-4">
            <div className="flex-1 h-px" style={{ background: 'var(--t-linen)' }} />
            <span style={{ fontFamily: FONT.mono, fontSize: 9, color: TEXT.secondary, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              More for you
            </span>
            <div className="flex-1 h-px" style={{ background: 'var(--t-linen)' }} />
          </div>

          {/* Render whichever sections this page contains */}
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

      {/* Sentinel + loading indicator for infinite scroll */}
      {hasMoreContent && (
        <div
          ref={sentinelRef}
          className="flex flex-col items-center justify-center py-10 gap-2"
          style={{ minHeight: 80 }}
        >
          {isLoadingMore ? (
            <>
              <div className="animate-spin w-5 h-5 rounded-full border-2" style={{ borderColor: 'var(--t-linen)', borderTopColor: 'var(--t-honey)' }} />
              <span style={{ fontFamily: FONT.mono, fontSize: 10, color: TEXT.secondary, letterSpacing: '0.05em' }}>
                Curating more…
              </span>
            </>
          ) : (
            <span
              className="animate-pulse"
              style={{ fontFamily: FONT.mono, fontSize: 10, color: TEXT.secondary, letterSpacing: '0.05em' }}
            >
              Scroll for more
            </span>
          )}
        </div>
      )}
    </>
  );

  /* ─── Desktop Profile layout ─── */
  if (isDesktop) {
    return (
      <PageTransition className="min-h-screen" style={{ background: 'var(--t-cream)' }}>
        <DesktopNav />
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '36px 48px 48px' }}>
          {/* Profile header card — full width, scrolls with page */}
          <div
            className="rounded-2xl overflow-hidden mb-8"
            style={{
              background: '#ffffff',
              border: '1px solid var(--t-coral)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            }}
          >
            {/* Dark teal header section — editorial pattern */}
            <div style={{ background: 'var(--t-dark-teal)', padding: '24px 32px 20px' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(224,165,1,0.15)' }}
                  >
                    <PerriandIcon name="profile" size={28} color={COLOR.ochre} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold" style={{ color: '#ffffff', fontFamily: FONT.sans }}>{userName}</div>
                    <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.72)', fontFamily: FONT.mono }}>{profile.overallArchetype}</div>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <TerrazzoMosaic profile={numericProfile} size="xs" />
                  {/* Tabs */}
                  <div
                    className="flex gap-1 p-0.5 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.08)' }}
                  >
                    {(['discover', 'profile'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className="py-1.5 px-4 rounded-md text-[11px] font-medium transition-all"
                        style={{
                          background: activeTab === tab ? COLOR.ochre : 'transparent',
                          color: activeTab === tab ? 'white' : 'rgba(255,255,255,0.8)',
                          border: 'none',
                          cursor: 'pointer',
                          fontFamily: FONT.sans,
                          boxShadow: activeTab === tab ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
                        }}
                      >
                        {tab === 'discover' ? 'Discover' : 'My Profile'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom bar: stats + CTAs — plain pattern with coral gradient */}
            <div className="flex items-center gap-6 px-8 py-4" style={{ background: 'linear-gradient(145deg, rgba(238,113,109,0.06) 0%, rgba(238,113,109,0.12) 100%)', borderTop: '1px solid var(--t-coral)' }}>
              {/* Quick stats */}
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div style={{ fontFamily: FONT.mono, fontSize: 18, fontWeight: 700, color: COLOR.darkTeal }}>{signalCount}</div>
                  <div style={{ fontFamily: FONT.mono, fontSize: 9, color: COLOR.coral, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Signals</div>
                </div>
                <div className="text-center">
                  <div style={{ fontFamily: FONT.mono, fontSize: 18, fontWeight: 700, color: COLOR.darkTeal }}>{profile.contradictions?.length || 0}</div>
                  <div style={{ fontFamily: FONT.mono, fontSize: 9, color: COLOR.coral, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Tensions</div>
                </div>
                <div className="text-center">
                  <div style={{ fontFamily: FONT.mono, fontSize: 18, fontWeight: 700, color: COLOR.darkTeal }}>{Object.values(profile.microTasteSignals || {}).flat().length || 0}</div>
                  <div style={{ fontFamily: FONT.mono, fontSize: 9, color: COLOR.coral, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Terms</div>
                </div>
              </div>

              <div className="h-8 w-px" style={{ background: 'var(--t-linen)' }} />

              {/* CTAs */}
              <div className="flex items-center gap-3 flex-1">
                <SafeMotionButton
                  onClick={() => setShowWrapped(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer border-none transition-all hover:opacity-90"
                  style={{ background: COLOR.darkTeal }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="text-[11px] font-semibold" style={{ color: '#ffffff', fontFamily: FONT.sans }}>
                    Taste Dossier
                  </span>
                  <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: FONT.mono }}>→</span>
                </SafeMotionButton>

                <SafeMotionButton
                  onClick={() => setShowMosaic(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer border-none transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, rgba(238,113,109,0.15) 0%, rgba(238,113,109,0.06) 100%)', border: '1px solid var(--t-coral)' }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="text-[11px] font-semibold" style={{ color: COLOR.darkTeal, fontFamily: FONT.sans }}>
                    Expand Mosaic
                  </span>
                  <span className="text-[10px]" style={{ color: COLOR.navy, fontFamily: FONT.mono }}>→</span>
                </SafeMotionButton>
              </div>

              {/* Settings gear */}
              <div className="flex items-center gap-3">
                {SETTINGS_LINKS.map(({ label, action }) => (
                  <div key={action} className="relative">
                    <button
                      onClick={() => handleSettingTap(action)}
                      className="text-[11px] px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                      style={{
                        fontSize: 11,
                        color: expandedSection === action ? COLOR.darkTeal : COLOR.navy,
                        fontFamily: FONT.sans,
                        background: expandedSection === action ? 'rgba(238,113,109,0.06)' : 'transparent',
                        border: 'none',
                      }}
                    >
                      {label}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Settings Panel - Desktop variant */}
          {expandedSection && (
            <SettingsPanel
              expandedSection={expandedSection}
              variant="desktop"
              emailStatus={emailStatus}
              emailLoading={emailLoading}
              scanState={scanState}
              scanResult={scanResult}
              hasGoogleMapsImport={hasGoogleMapsImport}
              importHistory={importHistory}
              historyLoading={historyLoading}
              isAuthenticated={isAuthenticated}
              userEmail={user?.email}
              isResynthesizing={isResynthesizing}
              resynthesisResult={resynthesisResult}
              onScanNow={handleScanNow}
              onDebugEmail={handleDebugEmail}
              onDisconnect={handleDisconnect}
              onRedoOnboarding={handleRedoOnboarding}
              onResynthesis={handleResynthesis}
              onSignOut={signOut}
              onNavigate={handleSettingTap}
            />
          )}

          {/* Content feed — full width */}
          <div>
            {activeTab === 'discover' ? discoverFeed : (
              <>
                <ProfileDeepDive />
              </>
            )}
          </div>
        </div>
      </PageTransition>
    );
  }

  /* ─── Mobile Profile layout (unchanged) ─── */
  return (
    <PageTransition className="min-h-screen" style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto', paddingBottom: 64 }}>
      <div className="px-5 pt-6 pb-2">
        {headerBlock}
      </div>

      {activeTab === 'discover' ? (
        discoverFeed
      ) : (
        /* ═══════════ MY PROFILE ═══════════ */
        <>
          {/* Action buttons */}
          <div className="px-5 pt-2 pb-4 flex flex-col gap-2.5">
            <SafeMotionButton
              onClick={() => setShowWrapped(true)}
              className="w-full flex items-center justify-between p-3.5 rounded-xl cursor-pointer border-none transition-all hover:opacity-90"
              style={{ background: 'var(--t-navy)' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex flex-col items-start gap-0.5">
                <span
                  className="text-[12px] font-semibold"
                  style={{ color: 'var(--t-cream)', fontFamily: FONT.sans }}
                >
                  Your Taste Dossier
                </span>
                <span
                  className="text-[9px]"
                  style={{ color: 'rgba(251,245,236,0.45)', fontFamily: FONT.mono }}
                >
                  {signalCount > 0 ? `${signalCount} signals` : 'Your signals'} · {profile.contradictions?.length || 0} tensions
                </span>
              </div>
              <span
                className="text-[10px] px-2.5 py-1 rounded-full font-semibold"
                style={{
                  background: 'rgba(251,245,236,0.15)',
                  color: 'var(--t-cream)',
                  fontFamily: FONT.mono,
                }}
              >
                Replay →
              </span>
            </SafeMotionButton>

            <SafeMotionButton
              onClick={() => setShowMosaic(true)}
              className="w-full flex items-center justify-between p-3.5 rounded-xl cursor-pointer border-none transition-all hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, #e8dcc8 0%, #f5f0e6 100%)',
                border: '1px solid var(--t-coral)',
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex flex-col items-start gap-0.5">
                <span
                  className="text-[12px] font-semibold"
                  style={{ color: TEXT.primary, fontFamily: FONT.sans }}
                >
                  Expand Your Mosaic
                </span>
                <span
                  className="text-[9px]"
                  style={{ color: TEXT.secondary, fontFamily: FONT.mono }}
                >
                  Quick questions that sharpen your matches
                </span>
              </div>
              <span
                className="text-[10px] px-2.5 py-1 rounded-full font-semibold"
                style={{
                  background: 'rgba(0,42,85,0.06)',
                  color: TEXT.primary,
                  fontFamily: FONT.mono,
                }}
              >
                Play →
              </span>
            </SafeMotionButton>
          </div>

          {/* Deep Dive */}
          <ProfileDeepDive />

          {/* Settings Panel - Mobile variant */}
          <SettingsPanel
            expandedSection={expandedSection}
            variant="mobile"
            emailStatus={emailStatus}
            emailLoading={emailLoading}
            scanState={scanState}
            scanResult={scanResult}
            hasGoogleMapsImport={hasGoogleMapsImport}
            importHistory={importHistory}
            historyLoading={historyLoading}
            isAuthenticated={isAuthenticated}
            userEmail={user?.email}
            isResynthesizing={isResynthesizing}
            resynthesisResult={resynthesisResult}
            onScanNow={handleScanNow}
            onDebugEmail={handleDebugEmail}
            onDisconnect={handleDisconnect}
            onRedoOnboarding={handleRedoOnboarding}
            onResynthesis={handleResynthesis}
            onSignOut={signOut}
            onNavigate={handleSettingTap}
          />
        </>
      )}

      <TabBar />
    </PageTransition>
  );
}

