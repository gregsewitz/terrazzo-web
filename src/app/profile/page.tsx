'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TabBar from '@/components/TabBar';
import ProfileDeepDive from '@/components/profile/ProfileDeepDive';
import WrappedExperience from '@/components/wrapped/WrappedExperience';

const SETTINGS_LINKS = [
  { label: 'Connected Accounts', action: 'accounts' },
  { label: 'Import History', action: 'history' },
  { label: 'Notification Preferences', action: 'notifications' },
  { label: 'About Terrazzo', action: 'about' },
];

export default function ProfilePage() {
  const router = useRouter();
  const [showWrapped, setShowWrapped] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

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
      <div className="px-4 pt-6">
        <h1
          className="text-2xl mb-1"
          style={{ fontFamily: "var(--font-dm-serif-display), serif", color: 'var(--t-ink)' }}
        >
          Profile
        </h1>
        <p className="text-xs mb-6" style={{ color: 'rgba(28,26,23,0.7)' }}>
          Your Terrazzo taste identity
        </p>

        {/* User info */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-lg"
            style={{ background: 'rgba(200,146,58,0.1)', color: 'var(--t-honey)' }}
          >
            ◯
          </div>
          <div>
            <div className="text-[14px] font-semibold" style={{ color: 'var(--t-ink)' }}>Greg</div>
            <div className="text-[11px]" style={{ color: 'rgba(28,26,23,0.7)' }}>The Aesthetic Pilgrim</div>
          </div>
        </div>

        {/* Replay Wrapped button */}
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
                <span style={{ color: 'rgba(28,26,23,0.7)', transform: expandedSection === action ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>→</span>
              </div>
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
                <div className="px-3 py-3 mt-1 rounded-xl text-[11px]" style={{ background: 'rgba(107,139,154,0.05)', color: 'rgba(28,26,23,0.7)' }}>
                  Notification preferences will be available in a future update.
                </div>
              )}
              {expandedSection === 'about' && action === 'about' && (
                <div className="px-3 py-3 mt-1 rounded-xl text-[11px]" style={{ background: 'rgba(107,139,154,0.05)', color: 'rgba(28,26,23,0.7)' }}>
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
