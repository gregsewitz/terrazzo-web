'use client';

import { usePathname, useRouter } from 'next/navigation';

const TABS = [
  { id: 'discover', label: 'Discover', icon: '◇', path: '/discover' },
  { id: 'trips', label: 'Trips', icon: '△', path: '/trips' },
  { id: 'saved', label: 'Saved', icon: '♡', path: '/saved' },
  { id: 'profile', label: 'Profile', icon: '◯', path: '/profile' },
];

export default function TabBar() {
  const pathname = usePathname();
  const router = useRouter();

  const activeTab = TABS.find(t => pathname.startsWith(t.path))?.id || 'trips';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center px-0 py-2.5 border-t"
      style={{
        maxWidth: 480,
        margin: '0 auto',
        background: 'var(--t-cream)',
        borderColor: 'var(--t-linen)',
      }}
    >
      {TABS.map(tab => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => router.push(tab.path)}
            className="flex flex-col items-center gap-0.5 bg-transparent border-none cursor-pointer transition-opacity"
            style={{ opacity: isActive ? 1 : 0.4 }}
          >
            <span
              className="text-base"
              style={{ color: isActive ? 'var(--t-signal-red)' : 'var(--t-ink)' }}
            >
              {tab.icon}
            </span>
            <span
              className="text-[9px] uppercase tracking-wider"
              style={{
                fontFamily: "'Space Mono', monospace",
                fontWeight: isActive ? 700 : 400,
                color: 'var(--t-ink)',
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
