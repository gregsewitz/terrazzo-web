'use client';

import TabBar from '@/components/TabBar';
import TasteAxes from '@/components/TasteAxes';
import { DEFAULT_USER_PROFILE } from '@/lib/taste';

export default function ProfilePage() {
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
          {['Connected Accounts', 'Import History', 'Notification Preferences', 'About Terrazzo'].map(label => (
            <div
              key={label}
              className="flex items-center justify-between p-3 rounded-xl cursor-pointer"
              style={{ background: 'rgba(28,26,23,0.03)' }}
            >
              <span className="text-[12px]" style={{ color: 'var(--t-ink)' }}>{label}</span>
              <span style={{ color: 'rgba(28,26,23,0.3)' }}>→</span>
            </div>
          ))}
        </div>
      </div>
      <TabBar />
    </div>
  );
}
