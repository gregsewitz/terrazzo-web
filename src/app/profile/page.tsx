'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TabBar from '@/components/TabBar';
import TasteAxes from '@/components/TasteAxes';
import { DEFAULT_USER_PROFILE } from '@/lib/taste';

const SETTINGS_LINKS = [
  { label: 'Connected Accounts', action: 'accounts' },
  { label: 'Import History', action: 'history' },
  { label: 'Notification Preferences', action: 'notifications' },
  { label: 'About Terrazzo', action: 'about' },
];

export default function ProfilePage() {
  const router = useRouter();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const handleSettingTap = (action: string) => {
    if (action === 'history') {
      router.push('/saved');
      return;
    }
    setExpandedSection(expandedSection === action ? null : action);
  };

  return (
    <div className="min-h-screen pb-16" style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}>
      <div className="px-4 pt-6">
        <h1
          className="text-2xl mb-1"
          style={{ fontFamily: "var(--font-dm-serif-display), serif", color: 'var(--t-ink)' }}
        >
          Profile
        </h1>
        <p className="text-xs mb-6" style={{ color: 'rgba(28,26,23,0.5)' }}>
          Your Terrazzo taste identity
        </p>

        {/* User info */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-lg"
            style={{ background: 'rgba(200,146,58,0.1)', color: 'var(--t-honey)' }}
          >
            ◯
          </div>
          <div>
            <div className="text-[14px] font-semibold" style={{ color: 'var(--t-ink)' }}>Greg</div>
            <div className="text-[11px]" style={{ color: 'rgba(28,26,23,0.5)' }}>Design-forward curious traveler</div>
          </div>
        </div>

        {/* Taste profile */}
        <div
          className="p-4 rounded-xl mb-4"
          style={{ background: 'white', border: '1px solid var(--t-linen)' }}
        >
          <h2
            className="text-[10px] uppercase tracking-wider font-bold mb-3"
            style={{ color: 'var(--t-amber)', fontFamily: "'Space Mono', monospace" }}
          >
            Your Taste Profile
          </h2>
          <TasteAxes profile={DEFAULT_USER_PROFILE} size="md" />
        </div>

        {/* Settings links */}
        <div className="flex flex-col gap-2">
          {SETTINGS_LINKS.map(({ label, action }) => (
            <div key={action}>
              <div
                onClick={() => handleSettingTap(action)}
                className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all"
                style={{ background: expandedSection === action ? 'rgba(200,146,58,0.06)' : 'rgba(28,26,23,0.03)' }}
              >
                <span className="text-[12px]" style={{ color: 'var(--t-ink)' }}>{label}</span>
                <span style={{ color: 'rgba(28,26,23,0.3)', transform: expandedSection === action ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>→</span>
              </div>
              {/* Inline expanded content */}
              {expandedSection === 'accounts' && action === 'accounts' && (
                <div className="px-3 py-3 mt-1 rounded-xl" style={{ background: 'rgba(107,139,154,0.05)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px]" style={{ color: 'var(--t-ink)' }}>✉ Gmail</span>
                    <a
                      href="/api/auth/nylas/connect"
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: 'var(--t-verde)', color: 'white', textDecoration: 'none' }}
                    >
                      Connect
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: 'var(--t-ink)' }}>📍 Google Maps</span>
                    <span className="text-[10px] px-2.5 py-1 rounded-full" style={{ background: 'rgba(42,122,86,0.08)', color: 'var(--t-verde)' }}>
                      Via import
                    </span>
                  </div>
                </div>
              )}
              {expandedSection === 'notifications' && action === 'notifications' && (
                <div className="px-3 py-3 mt-1 rounded-xl text-[11px]" style={{ background: 'rgba(107,139,154,0.05)', color: 'rgba(28,26,23,0.5)' }}>
                  Notification preferences will be available in a future update.
                </div>
              )}
              {expandedSection === 'about' && action === 'about' && (
                <div className="px-3 py-3 mt-1 rounded-xl text-[11px]" style={{ background: 'rgba(107,139,154,0.05)', color: 'rgba(28,26,23,0.5)' }}>
                  Terrazzo v0.1 — Your taste-driven travel companion. Built with Forme Libere design principles.
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <TabBar />
    </div>
  );
}
