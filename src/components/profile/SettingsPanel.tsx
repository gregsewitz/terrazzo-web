'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT, COLOR } from '@/constants/theme';

export interface SettingsPanelProps {
  expandedSection: string | null;
  variant: 'mobile' | 'desktop';
  // Email/accounts state
  emailStatus: { connected: boolean; email?: string; provider?: string; connectedAt?: string } | null;
  emailLoading: boolean;
  scanState: string;
  scanResult: { scanId?: string; emailsFound?: number; emailsParsed?: number; reservationsFound?: number };
  hasGoogleMapsImport: boolean;
  // History state
  importHistory: Array<{ id: string; type: string; date: string; title: string; subtitle: string; count: number; status?: string; scanId?: string }>;
  historyLoading: boolean;
  // Auth
  isAuthenticated: boolean;
  userEmail?: string;
  // Resynthesis state
  isResynthesizing: boolean;
  resynthesisResult: 'success' | 'error' | null;
  // Handlers
  onScanNow: () => void;
  onDebugEmail: () => void;
  onDisconnect: () => void;
  onRedoOnboarding: () => void;
  onResynthesis: () => void;
  onSignOut: () => void;
  onNavigate: (path: string) => void;
}

export function SettingsPanel({
  expandedSection,
  variant,
  emailStatus,
  emailLoading,
  scanState,
  scanResult,
  hasGoogleMapsImport,
  importHistory,
  historyLoading,
  isAuthenticated,
  userEmail,
  isResynthesizing,
  resynthesisResult,
  onScanNow,
  onDebugEmail,
  onDisconnect,
  onRedoOnboarding,
  onResynthesis,
  onSignOut,
  onNavigate,
}: SettingsPanelProps) {
  const router = useRouter();

  if (variant === 'desktop') {
    return (
      <div className="mb-6 rounded-2xl px-6 py-4" style={{ background: 'white', border: '1px solid var(--t-linen)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        {expandedSection === 'accounts' && (
          <div style={{ fontSize: 12 }}>
            <h4 className="text-[10px] uppercase tracking-[0.15em] mb-3" style={{ color: INK['50'], fontFamily: FONT.mono, fontWeight: 700 }}>Connected Accounts</h4>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <PerriandIcon name="email" size={12} color="var(--t-ink)" />
                <span style={{ color: TEXT.primary }}>Gmail</span>
              </div>
              {emailLoading ? (
                <span className="text-[10px]" style={{ color: TEXT.secondary }}>Checking…</span>
              ) : emailStatus?.connected ? (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(146,206,214,0.08)', color: 'var(--t-teal)' }}>Connected</span>
              ) : (
                <a href="/api/auth/nylas/connect" className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: 'var(--t-teal)', color: 'white', textDecoration: 'none' }}>Connect</a>
              )}
            </div>
            {emailStatus?.connected && (
              <div className="ml-5 mb-3">
                <span className="text-[10px] block mb-2" style={{ color: TEXT.secondary }}>{emailStatus.email}</span>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <button onClick={onScanNow} disabled={scanState === 'scanning' || scanState === 'parsing'} className="text-[10px] font-semibold px-3 py-1.5 rounded-full border-none cursor-pointer" style={{ background: 'var(--t-teal)', color: 'white', opacity: scanState === 'scanning' || scanState === 'parsing' ? 0.7 : 1 }}>
                    {scanState === 'scanning' ? 'Scanning…' : scanState === 'parsing' ? `Parsing${scanResult?.emailsParsed ? ` ${scanResult.emailsParsed}/${scanResult.emailsFound}` : '…'}` : scanState === 'done' ? '✓ Done' : scanState === 'failed' ? 'Retry Scan' : 'Scan Inbox'}
                  </button>
                  <button onClick={onDebugEmail} className="text-[10px] px-2 py-1 rounded-full border-none cursor-pointer" style={{ background: 'rgba(0,0,0,0.06)', color: TEXT.secondary }}>
                    Debug
                  </button>
                  {scanState === 'parsing' && scanResult && (scanResult.reservationsFound ?? 0) > 0 && (
                    <button onClick={() => router.push('/email/inbox')} className="text-[10px] font-semibold px-3 py-1.5 rounded-full border-none cursor-pointer" style={{ background: 'var(--t-coral)', color: 'white' }}>
                      Review {scanResult.reservationsFound} so far →
                    </button>
                  )}
                  {scanState === 'done' && scanResult && (scanResult.reservationsFound ?? 0) > 0 && (
                    <button onClick={() => router.push('/email/inbox')} className="text-[10px] font-semibold px-3 py-1.5 rounded-full border-none cursor-pointer" style={{ background: 'var(--t-coral)', color: 'white' }}>
                      Review {scanResult.reservationsFound} reservations →
                    </button>
                  )}
                  {scanState === 'done' && scanResult && (scanResult.reservationsFound ?? 0) === 0 && (
                    <span className="text-[10px]" style={{ color: TEXT.secondary }}>
                      {scanResult.emailsFound} emails scanned · no reservations found
                    </span>
                  )}
                </div>
                <button onClick={onDisconnect} className="text-[9px] px-2 py-0.5 rounded-full border-none cursor-pointer" style={{ background: 'rgba(238,113,109,0.08)', color: 'var(--t-coral)' }}>Disconnect</button>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PerriandIcon name="pin" size={12} color="var(--t-ink)" />
                <span style={{ color: TEXT.primary }}>Google Maps</span>
              </div>
              {hasGoogleMapsImport ? (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(146,206,214,0.08)', color: 'var(--t-teal)' }}>Imported</span>
              ) : (
                <Link href="/onboarding" className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: 'var(--t-peach)', color: 'var(--t-navy)', textDecoration: 'none' }}>Import</Link>
              )}
            </div>
          </div>
        )}
        {expandedSection === 'history' && (
          <div style={{ fontSize: 12 }}>
            <h4 className="text-[10px] uppercase tracking-[0.15em] mb-3" style={{ color: INK['50'], fontFamily: FONT.mono, fontWeight: 700 }}>Import History</h4>
            {historyLoading ? (
              <span className="text-[10px]" style={{ color: TEXT.secondary }}>Loading history…</span>
            ) : importHistory.length === 0 ? (
              <span className="text-[10px]" style={{ color: TEXT.secondary }}>No import history yet. Connect Gmail or import from a URL to get started.</span>
            ) : (
              <div className="flex flex-col gap-1.5">
                {importHistory.slice(0, 10).map((item) => (
                  <button key={item.id} type="button" className="flex items-center justify-between py-1 cursor-pointer w-full text-left" style={{ background: 'none', border: 'none', padding: 0 }} onClick={() => item.scanId ? router.push('/email/inbox') : undefined}>
                    <div className="flex items-center gap-2 min-w-0">
                      <PerriandIcon name={item.type === 'email-scan' ? 'email' : item.type === 'url-import' ? 'article' : 'manual'} size={10} color={INK['50']} />
                      <span className="text-[11px] truncate" style={{ color: TEXT.primary }}>{item.title}</span>
                    </div>
                    <span className="text-[10px] flex-shrink-0 ml-2" style={{ color: TEXT.secondary }}>{new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </button>
                ))}
                <button onClick={() => router.push('/email/inbox')} className="text-[10px] font-medium mt-1 bg-transparent border-none cursor-pointer text-left" style={{ color: TEXT.accent }}>View email reservations →</button>
              </div>
            )}
          </div>
        )}
        {expandedSection === 'notifications' && (
          <div>
            <h4 className="text-[10px] uppercase tracking-[0.15em] mb-3" style={{ color: INK['50'], fontFamily: FONT.mono, fontWeight: 700 }}>Notifications</h4>
            <span className="text-[11px]" style={{ color: TEXT.secondary }}>Notification preferences coming soon.</span>
          </div>
        )}
        {expandedSection === 'about' && (
          <div>
            <h4 className="text-[10px] uppercase tracking-[0.15em] mb-3" style={{ color: INK['50'], fontFamily: FONT.mono, fontWeight: 700 }}>About</h4>
            <span className="text-[11px]" style={{ color: TEXT.secondary }}>Terrazzo v0.1 — Your taste-driven travel companion.</span>
          </div>
        )}
        <div className="flex items-center gap-4 mt-4 pt-3" style={{ borderTop: '1px solid var(--t-linen)' }}>
          <button
            onClick={onRedoOnboarding}
            className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer"
            style={{ fontSize: 11, color: 'var(--t-coral)', fontFamily: FONT.sans }}
          >
            <PerriandIcon name="discover" size={10} color="var(--t-coral)" />
            Redo Onboarding
          </button>
          <button
            onClick={onResynthesis}
            disabled={isResynthesizing}
            className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer"
            style={{ fontSize: 11, color: isResynthesizing ? INK['30'] : 'var(--t-teal)', fontFamily: FONT.sans, opacity: isResynthesizing ? 0.6 : 1 }}
          >
            <PerriandIcon name="sparkle" size={10} color={isResynthesizing ? INK['30'] : 'var(--t-teal)'} />
            {isResynthesizing ? 'Re-synthesizing…' : 'Refresh Taste Profile'}
            {resynthesisResult === 'success' && <span style={{ color: 'var(--t-teal)', marginLeft: 4 }}>✓</span>}
            {resynthesisResult === 'error' && <span style={{ color: '#c44', marginLeft: 4 }}>Failed</span>}
          </button>
          {isAuthenticated ? (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px]" style={{ color: TEXT.secondary }}>{userEmail}</span>
              <button onClick={onSignOut} className="text-[10px] font-medium px-2 py-1 rounded-full cursor-pointer" style={{ background: 'rgba(238,113,109,0.08)', color: 'var(--t-coral)', border: 'none', fontFamily: FONT.sans }}>Sign out</button>
            </div>
          ) : (
            <Link href="/login" className="ml-auto text-[11px] font-semibold" style={{ color: 'var(--t-teal)', textDecoration: 'none' }}>Sign in →</Link>
          )}
        </div>
      </div>
    );
  }

  // Mobile variant
  return (
    <div className="px-4 py-6 mx-4 mt-2 rounded-2xl" style={{ background: 'white', border: '1px solid var(--t-linen)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <h3
        className="text-[10px] uppercase tracking-[0.2em] mb-4"
        style={{ color: '#8a6a2a', fontFamily: FONT.mono, fontWeight: 700 }}
      >
        Settings
      </h3>
      <div className="flex flex-col gap-2">
        <div>
          <div
            onClick={() => onNavigate('accounts')}
            className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all"
            style={{ background: expandedSection === 'accounts' ? 'rgba(238,113,109,0.06)' : INK['03'] }}
          >
            <span className="text-[12px]" style={{ color: TEXT.primary }}>Connected Accounts</span>
            <span style={{ color: TEXT.secondary, transform: expandedSection === 'accounts' ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>→</span>
          </div>
          {expandedSection === 'accounts' && (
            <div className="px-3 py-3 mt-1 rounded-xl" style={{ background: 'rgba(107,139,154,0.05)' }}>
              {/* Gmail row — dynamic */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <PerriandIcon name="email" size={12} color="var(--t-ink)" />
                  <span className="text-[11px]" style={{ color: TEXT.primary }}>Gmail</span>
                </div>
                {emailLoading ? (
                  <span className="text-[10px]" style={{ color: TEXT.secondary }}>Checking…</span>
                ) : emailStatus?.connected ? (
                  <span className="text-[10px] px-2.5 py-1 rounded-full" style={{ background: 'rgba(58,128,136,0.08)', color: 'var(--t-dark-teal)' }}>
                    Connected
                  </span>
                ) : (
                  <a
                    href="/api/auth/nylas/connect"
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'var(--t-dark-teal)', color: 'white', textDecoration: 'none' }}
                  >
                    Connect
                  </a>
                )}
              </div>
              {/* Connected: show email, scan, disconnect */}
              {emailStatus?.connected && (
                <div className="ml-5 mb-3">
                  <span className="text-[10px] block mb-2" style={{ color: TEXT.secondary }}>
                    {emailStatus.email}
                  </span>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <button
                      onClick={onScanNow}
                      disabled={scanState === 'scanning' || scanState === 'parsing'}
                      className="text-[10px] font-semibold px-3 py-1.5 rounded-full border-none cursor-pointer"
                      style={{ background: COLOR.darkTeal, color: 'white', opacity: scanState === 'scanning' || scanState === 'parsing' ? 0.7 : 1 }}
                    >
                      {scanState === 'scanning' ? 'Scanning…' : scanState === 'parsing' ? `Parsing${scanResult?.emailsParsed ? ` ${scanResult.emailsParsed}/${scanResult.emailsFound}` : '…'}` : scanState === 'done' ? '✓ Done' : scanState === 'failed' ? 'Retry Scan' : 'Scan Inbox'}
                    </button>
                    <button onClick={onDebugEmail} className="text-[10px] px-2 py-1 rounded-full border-none cursor-pointer" style={{ background: 'rgba(0,0,0,0.06)', color: TEXT.secondary }}>
                      Debug
                    </button>
                    {scanState === 'parsing' && scanResult && (scanResult.reservationsFound ?? 0) > 0 && (
                      <button
                        onClick={() => router.push('/email/inbox')}
                        className="text-[10px] font-semibold px-3 py-1.5 rounded-full border-none cursor-pointer"
                        style={{ background: 'var(--t-honey)', color: 'white' }}
                      >
                        Review {scanResult.reservationsFound} so far →
                      </button>
                    )}
                    {scanState === 'done' && scanResult && (scanResult.reservationsFound ?? 0) > 0 && (
                      <button
                        onClick={() => router.push('/email/inbox')}
                        className="text-[10px] font-semibold px-3 py-1.5 rounded-full border-none cursor-pointer"
                        style={{ background: 'var(--t-honey)', color: 'white' }}
                      >
                        Review {scanResult.reservationsFound} reservations →
                      </button>
                    )}
                    {scanState === 'done' && scanResult && (scanResult.reservationsFound ?? 0) === 0 && (
                      <span className="text-[10px]" style={{ color: TEXT.secondary }}>
                        {scanResult.emailsFound} emails scanned · no reservations found
                      </span>
                    )}
                  </div>
                  <button
                    onClick={onDisconnect}
                    className="text-[9px] px-2 py-0.5 rounded-full border-none cursor-pointer"
                    style={{ background: 'rgba(196,80,32,0.08)', color: '#c45020' }}
                  >
                    Disconnect
                  </button>
                </div>
              )}
              {/* Google Maps row — static */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PerriandIcon name="pin" size={12} color="var(--t-ink)" />
                  <span className="text-[11px]" style={{ color: TEXT.primary }}>Google Maps</span>
                </div>
                <span className="text-[10px] px-2.5 py-1 rounded-full" style={{ background: 'rgba(58,128,136,0.08)', color: 'var(--t-dark-teal)' }}>
                  Via import
                </span>
              </div>
            </div>
          )}
        </div>

        <div>
          <div
            onClick={() => onNavigate('history')}
            className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all"
            style={{ background: expandedSection === 'history' ? 'rgba(238,113,109,0.06)' : INK['03'] }}
          >
            <span className="text-[12px]" style={{ color: TEXT.primary }}>Import History</span>
            <span style={{ color: TEXT.secondary, transform: expandedSection === 'history' ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>→</span>
          </div>
          {expandedSection === 'history' && (
            <div className="px-3 py-3 mt-1 rounded-xl" style={{ background: 'rgba(107,139,154,0.05)' }}>
              {historyLoading ? (
                <span className="text-[10px]" style={{ color: TEXT.secondary }}>Loading history…</span>
              ) : importHistory.length === 0 ? (
                <span className="text-[10px]" style={{ color: TEXT.secondary }}>
                  No import history yet. Connect Gmail or import from a URL to get started.
                </span>
              ) : (
                <div className="flex flex-col gap-2">
                  {importHistory.slice(0, 15).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-1.5 cursor-pointer"
                      onClick={() => item.scanId ? router.push('/email/inbox') : undefined}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <PerriandIcon
                          name={item.type === 'email-scan' ? 'email' : item.type === 'url-import' ? 'article' : 'manual'}
                          size={10}
                          color={INK['50']}
                        />
                        <div className="min-w-0">
                          <span className="text-[10px] font-medium block truncate" style={{ color: TEXT.primary }}>
                            {item.title}
                          </span>
                          <span className="text-[9px] block" style={{ color: TEXT.secondary }}>
                            {item.subtitle}
                          </span>
                        </div>
                      </div>
                      <span className="text-[9px] flex-shrink-0 ml-2" style={{ color: TEXT.secondary }}>
                        {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  ))}
                  {/* Link to staging inbox */}
                  <button
                    onClick={() => router.push('/email/inbox')}
                    className="text-[10px] font-medium mt-1 bg-transparent border-none cursor-pointer text-left"
                    style={{ color: TEXT.accent }}
                  >
                    View email reservations →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <div
            onClick={() => onNavigate('notifications')}
            className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all"
            style={{ background: expandedSection === 'notifications' ? 'rgba(238,113,109,0.06)' : INK['03'] }}
          >
            <span className="text-[12px]" style={{ color: TEXT.primary }}>Notification Preferences</span>
            <span style={{ color: TEXT.secondary, transform: expandedSection === 'notifications' ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>→</span>
          </div>
          {expandedSection === 'notifications' && (
            <div className="px-3 py-3 mt-1 rounded-xl text-[11px]" style={{ background: 'rgba(107,139,154,0.05)', color: TEXT.secondary }}>
              Notification preferences will be available in a future update.
            </div>
          )}
        </div>

        <div>
          <div
            onClick={() => onNavigate('about')}
            className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all"
            style={{ background: expandedSection === 'about' ? 'rgba(238,113,109,0.06)' : INK['03'] }}
          >
            <span className="text-[12px]" style={{ color: TEXT.primary }}>About Terrazzo</span>
            <span style={{ color: TEXT.secondary, transform: expandedSection === 'about' ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>→</span>
          </div>
          {expandedSection === 'about' && (
            <div className="px-3 py-3 mt-1 rounded-xl text-[11px]" style={{ background: 'rgba(107,139,154,0.05)', color: TEXT.secondary }}>
              Terrazzo v0.1 — Your taste-driven travel companion. Built with Forme Libere design principles.
            </div>
          )}
        </div>
      </div>

      {/* Redo Onboarding */}
      <button
        onClick={onRedoOnboarding}
        className="w-full flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all mt-2"
        style={{
          background: 'rgba(232,115,58,0.06)',
          border: '1px dashed rgba(232,115,58,0.2)',
        }}
      >
        <div className="flex items-center gap-2">
          <PerriandIcon name="discover" size={12} color="var(--t-coral)" />
          <span className="text-[12px] font-medium" style={{ color: 'var(--t-coral)' }}>
            Redo Onboarding
          </span>
        </div>
        <span style={{ color: '#c45020', fontSize: 12 }}>→</span>
      </button>

      {/* Refresh Taste Profile */}
      <button
        onClick={onResynthesis}
        disabled={isResynthesizing}
        className="w-full flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all mt-2"
        style={{
          background: isResynthesizing ? 'rgba(58,128,136,0.03)' : 'rgba(58,128,136,0.06)',
          border: '1px dashed rgba(58,128,136,0.2)',
          opacity: isResynthesizing ? 0.7 : 1,
        }}
      >
        <div className="flex items-center gap-2">
          <PerriandIcon name="sparkle" size={12} color="var(--t-teal)" />
          <span className="text-[12px] font-medium" style={{ color: 'var(--t-teal)' }}>
            {isResynthesizing ? 'Re-synthesizing…' : 'Refresh Taste Profile'}
          </span>
          {resynthesisResult === 'success' && <span style={{ color: 'var(--t-teal)', fontSize: 12 }}>✓ Updated</span>}
          {resynthesisResult === 'error' && <span style={{ color: '#c44', fontSize: 12 }}>Failed</span>}
        </div>
        {!isResynthesizing && !resynthesisResult && (
          <span style={{ color: 'var(--t-dark-teal)', fontSize: 12 }}>→</span>
        )}
      </button>

      {/* Account / Sign In-Out */}
      <div className="mt-4 p-3 rounded-xl" style={{ background: INK['03'] }}>
        {isAuthenticated ? (
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px]" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>
                Signed in as
              </span>
              <span className="text-[12px] ml-1 font-medium" style={{ color: TEXT.primary, fontFamily: FONT.sans }}>
                {userEmail}
              </span>
            </div>
            <button
              onClick={onSignOut}
              className="text-[11px] font-medium px-3 py-1.5 rounded-full cursor-pointer"
              style={{
                background: 'rgba(238,113,109,0.08)',
                color: 'var(--t-coral)',
                border: 'none',
                fontFamily: FONT.sans,
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-[11px]" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>
              Sign in to save your places and trips
            </span>
            <Link
              href="/login"
              className="text-[11px] font-semibold px-3 py-1.5 rounded-full"
              style={{
                background: 'var(--t-teal)',
                color: 'white',
                textDecoration: 'none',
                fontFamily: FONT.sans,
              }}
            >
              Sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
