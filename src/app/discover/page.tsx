'use client';

import TabBar from '@/components/TabBar';

export default function DiscoverPage() {
  return (
    <div className="min-h-screen pb-16" style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}>
      <div className="px-4 pt-6">
        <h1
          className="text-2xl mb-1"
          style={{ fontFamily: "var(--font-dm-serif-display), serif", color: 'var(--t-ink)' }}
        >
          Discover
        </h1>
        <p className="text-xs mb-6" style={{ color: 'rgba(28,26,23,0.5)' }}>
          Curated for your taste profile
        </p>

        <div className="flex flex-col gap-3">
          {['Tokyo Hidden Gems', 'Design Hotels of Europe', 'Street Food Atlas'].map(title => (
            <div
              key={title}
              className="p-4 rounded-xl"
              style={{ background: 'rgba(200,146,58,0.06)', border: '1px solid var(--t-linen)' }}
            >
              <div className="text-[13px] font-semibold mb-1" style={{ color: 'var(--t-ink)' }}>{title}</div>
              <div className="text-[11px]" style={{ color: 'rgba(28,26,23,0.5)' }}>Coming soon — curated collections matched to your taste</div>
            </div>
          ))}
        </div>
      </div>
      <TabBar />
    </div>
  );
}
