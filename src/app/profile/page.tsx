'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';

import PageTransition from '@/components/ui/PageTransition';
import { SafeMotionButton } from '@/components/animations/AnimatedElements';
import TabBar from '@/components/ui/TabBar';
import DesktopNav from '@/components/ui/DesktopNav';
import ProfileDeepDive from '@/components/profile/ProfileDeepDive';
import ExpandMosaicView from '@/components/profile/ExpandMosaicView';
import WrappedExperience from '@/components/wrapped/WrappedExperience';
import { TerrazzoMosaic } from '@/components/profile/TerrazzoMosaic';
import TasteEvolutionCard from '@/components/profile/TasteEvolutionCard';
import { TASTE_PROFILE } from '@/constants/profile';
import type { TasteProfile as NumericProfile } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import { useTasteEvolution } from '@/hooks/useTasteEvolution';
import BrandLoader from '@/components/ui/BrandLoader';
import { COLOR, FONT, INK, TEXT } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { useSavedStore } from '@/stores/savedStore';
import { useEmailScanStore } from '@/stores/emailScanStore';
import { SettingsPanel } from '@/components/profile/SettingsPanel';

const SETTINGS_LINKS = [
  { label: 'Connected Accounts', action: 'accounts' },
  { label: 'Notification Preferences', action: 'notifications' },
  { label: 'About Terrazzo', action: 'about' },
];

export default function ProfilePage() {
  return <ProfilePageContent />;
}

function ProfilePageContent() {

  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [showWrapped, setShowWrapped] = useState(false);
  const [showMosaic, setShowMosaic] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [isResynthesizing, setIsResynthesizing] = useState(false);
  const [resynthesisResult, setResynthesisResult] = useState<'success' | 'error' | null>(null);

  // Taste evolution notifications
  const { showEvolutionNotice, showExpandPrompt, dismissEvolution, dismissExpand, newSignalCount } = useTasteEvolution();

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


  const { isAuthenticated, user, signOut } = useAuth();
  const resetForRedo = useOnboardingStore(s => s.resetForRedo);
  const triggerResynthesis = useOnboardingStore(s => s.triggerResynthesis);
  const generatedProfile = useOnboardingStore(s => s.generatedProfile);
  const lifeContext = useOnboardingStore(s => s.lifeContext);
  const allSignals = useOnboardingStore(s => s.allSignals);
  const dbHydrated = useOnboardingStore(s => s.dbHydrated);


  // DB is the source of truth — show loading until hydration completes,
  // then use the real profile (no hardcoded demo fallback for auth users)
  const profile = generatedProfile || TASTE_PROFILE;
  const userName = lifeContext?.firstName || user?.email?.split('@')[0] || '';
  const signalCount = allSignals?.length || 0;

  // Build numeric profile for mosaic visualization from radar data
  const numericProfile: NumericProfile = useMemo(() => {
    const result: NumericProfile = { Design: 0.5, Atmosphere: 0.5, Character: 0.5, Service: 0.5, FoodDrink: 0.5, Setting: 0.5, Wellness: 0.5, Sustainability: 0.5 };
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

  const handleSettingTap = (action: string) => {
    // Special navigation actions
    if (action === 'replay-bridge') {
      router.push('/onboarding/bridge');
      return;
    }
    const next = expandedSection === action ? null : action;
    setExpandedSection(next);
    // Fetch email status when accounts panel opens
    if (next === 'accounts' && !emailStatus) fetchEmailStatus();
    // Fetch import history when accounts panel opens (history is shown inline)
    if (next === 'accounts' && importHistory.length === 0) fetchImportHistory();
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

  /* ─── Profile header ─── */
  const headerBlock = (
    <div className="flex items-start justify-between mb-5">
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(238,113,109,0.1)' }}
        >
          <PerriandIcon name="profile" size={24} color="var(--t-honey)" />
        </div>
        <div>
          <div className="text-[17px] font-semibold" style={{ color: TEXT.primary }}>{userName}</div>
          <div className="text-[13px]" style={{ color: TEXT.secondary }}>{profile.overallArchetype}</div>
        </div>
      </div>
      <TerrazzoMosaic profile={numericProfile} size="xs" />
    </div>
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
                    <div className="text-[17px] font-semibold" style={{ color: '#ffffff', fontFamily: FONT.sans }}>{userName}</div>
                    <div className="text-[13px]" style={{ color: 'rgba(255,255,255,0.72)', fontFamily: FONT.mono }}>{profile.overallArchetype}</div>
                  </div>
                </div>
                <TerrazzoMosaic profile={numericProfile} size="xs" />
              </div>
            </div>

            {/* Bottom bar: stats + CTAs — plain pattern with coral gradient */}
            <div className="flex items-center gap-6 px-8 py-4" style={{ background: 'linear-gradient(145deg, rgba(238,113,109,0.06) 0%, rgba(238,113,109,0.12) 100%)', borderTop: '1px solid var(--t-coral)' }}>
              {/* Quick stats */}
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div style={{ fontFamily: FONT.mono, fontSize: 20, fontWeight: 700, color: COLOR.darkTeal }}>{signalCount}</div>
                  <div style={{ fontFamily: FONT.mono, fontSize: 11, color: COLOR.coral, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Signals</div>
                </div>
                <div className="text-center">
                  <div style={{ fontFamily: FONT.mono, fontSize: 20, fontWeight: 700, color: COLOR.darkTeal }}>{profile.contradictions?.length || 0}</div>
                  <div style={{ fontFamily: FONT.mono, fontSize: 11, color: COLOR.coral, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Tensions</div>
                </div>
                <div className="text-center">
                  <div style={{ fontFamily: FONT.mono, fontSize: 20, fontWeight: 700, color: COLOR.darkTeal }}>{Object.values(profile.microTasteSignals || {}).flat().length || 0}</div>
                  <div style={{ fontFamily: FONT.mono, fontSize: 11, color: COLOR.coral, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Terms</div>
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
                  <span className="text-[13px] font-semibold" style={{ color: '#ffffff', fontFamily: FONT.sans }}>
                    Taste Dossier
                  </span>
                  <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: FONT.mono }}>→</span>
                </SafeMotionButton>

                <SafeMotionButton
                  onClick={() => setShowMosaic(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer border-none transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, rgba(238,113,109,0.15) 0%, rgba(238,113,109,0.06) 100%)', border: '1px solid var(--t-coral)' }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="text-[13px] font-semibold" style={{ color: COLOR.darkTeal, fontFamily: FONT.sans }}>
                    Expand Mosaic
                  </span>
                  <span className="text-[12px]" style={{ color: COLOR.navy, fontFamily: FONT.mono }}>→</span>
                </SafeMotionButton>

                <SafeMotionButton
                  onClick={() => router.push('/onboarding/bridge')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer border-none transition-all hover:opacity-90"
                  style={{ background: 'transparent', border: '1px solid rgba(0,42,85,0.15)' }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="text-[13px] font-semibold" style={{ color: COLOR.darkTeal, fontFamily: FONT.sans }}>
                    Replay Intro
                  </span>
                  <span className="text-[12px]" style={{ color: COLOR.navy, fontFamily: FONT.mono }}>→</span>
                </SafeMotionButton>
              </div>
            </div>

            {/* Settings row */}
            <div className="flex items-center gap-3 px-8 py-3 overflow-x-auto" style={{ borderTop: '1px solid rgba(0,42,85,0.06)', scrollbarWidth: 'none' }}>
              {SETTINGS_LINKS.map(({ label, action }) => (
                <div key={action} className="relative flex-shrink-0">
                  <button
                    onClick={() => handleSettingTap(action)}
                    className="text-[13px] px-3 py-1.5 rounded-lg cursor-pointer transition-all whitespace-nowrap"
                    style={{
                      fontSize: 13,
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

          {/* Settings Panel - Desktop variant */}
          {expandedSection && (
            <SettingsPanel
              expandedSection={expandedSection}
              variant="desktop"
              emailStatus={emailStatus}
              emailLoading={emailLoading}
              scanState={scanState}
              scanResult={scanResult}

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

          {/* Taste Evolution Notifications */}
          <AnimatePresence>
            {showEvolutionNotice && (
              <TasteEvolutionCard type="evolution" newSignalCount={newSignalCount} onDismiss={dismissEvolution} />
            )}
            {showExpandPrompt && !showEvolutionNotice && (
              <TasteEvolutionCard type="expand" onDismiss={dismissExpand} onExpand={() => setShowMosaic(true)} />
            )}
          </AnimatePresence>

          {/* Content: ProfileDeepDive + SettingsPanel */}
          <ProfileDeepDive />
        </div>
      </PageTransition>
    );
  }

  /* ─── Mobile Profile layout ─── */
  return (
    <PageTransition className="min-h-screen" style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto', paddingBottom: 80 }}>
      <div className="px-5 pt-6 pb-2">
        {headerBlock}
      </div>

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
              className="text-[14px] font-semibold"
              style={{ color: 'var(--t-cream)', fontFamily: FONT.sans }}
            >
              Your Taste Dossier
            </span>
            <span
              className="text-[11px]"
              style={{ color: 'rgba(251,245,236,0.45)', fontFamily: FONT.mono }}
            >
              {signalCount > 0 ? `${signalCount} signals` : 'Your signals'} · {profile.contradictions?.length || 0} tensions
            </span>
          </div>
          <span
            className="text-[12px] px-2.5 py-1 rounded-full font-semibold"
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
              className="text-[14px] font-semibold"
              style={{ color: TEXT.primary, fontFamily: FONT.sans }}
            >
              Expand Your Mosaic
            </span>
            <span
              className="text-[11px]"
              style={{ color: TEXT.secondary, fontFamily: FONT.mono }}
            >
              Quick questions that sharpen your matches
            </span>
          </div>
          <span
            className="text-[12px] px-2.5 py-1 rounded-full font-semibold"
            style={{
              background: 'rgba(0,42,85,0.06)',
              color: TEXT.primary,
              fontFamily: FONT.mono,
            }}
          >
            Play →
          </span>
        </SafeMotionButton>

        <SafeMotionButton
          onClick={() => router.push('/onboarding/bridge')}
          className="w-full flex items-center justify-between p-3.5 rounded-xl cursor-pointer border-none transition-all hover:opacity-90"
          style={{
            background: 'transparent',
            border: '1px solid rgba(0,42,85,0.12)',
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex flex-col items-start gap-0.5">
            <span
              className="text-[14px] font-semibold"
              style={{ color: TEXT.primary, fontFamily: FONT.sans }}
            >
              Replay Intro
            </span>
            <span
              className="text-[11px]"
              style={{ color: TEXT.secondary, fontFamily: FONT.mono }}
            >
              Rewatch your personalized flythrough
            </span>
          </div>
          <span
            className="text-[12px] px-2.5 py-1 rounded-full font-semibold"
            style={{
              background: 'rgba(0,42,85,0.06)',
              color: TEXT.primary,
              fontFamily: FONT.mono,
            }}
          >
            Watch →
          </span>
        </SafeMotionButton>
      </div>

      {/* Taste Evolution Notifications */}
      <div className="px-5 pt-2 pb-4">
        <AnimatePresence>
          {showEvolutionNotice && (
            <TasteEvolutionCard type="evolution" newSignalCount={newSignalCount} onDismiss={dismissEvolution} />
          )}
          {showExpandPrompt && !showEvolutionNotice && (
            <TasteEvolutionCard type="expand" onDismiss={dismissExpand} onExpand={() => setShowMosaic(true)} />
          )}
        </AnimatePresence>
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

      <TabBar />
    </PageTransition>
  );
}

