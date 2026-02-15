'use client';

import TabBar from '@/components/TabBar';

export default function SavedPage() {
  return (
    <div className="min-h-screen pb-16" style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}>
      <div className="px-4 pt-6">
        <h1
          className="text-2xl mb-1"
          style={{ fontFamily: "var(--font-dm-serif-display), serif", color: 'var(--t-ink)' }}
        >
          Saved
        </h1>
        <p className="text-xs mb-6" style={{ color: 'rgba(28,26,23,0.5)' }}>
          Your bookmarked places and collections
        </p>

        <div className="text-center py-12">
          <span className="text-3xl mb-3 block">♡</span>
          <p className="text-[12px]" style={{ color: 'rgba(28,26,23,0.4)' }}>
            Places you save will appear here
          </p>
        </div>
      </div>
      <TabBar />
    </div>
  );
}
