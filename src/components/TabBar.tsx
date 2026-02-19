'use client';

import { usePathname, useRouter } from 'next/navigation';
import { PerriandIcon, PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT } from '@/constants/theme';

const TABS = [
  { id: 'saved', label: 'Collect', icon: 'saved' as PerriandIconName, path: '/saved' },
  { id: 'trips', label: 'Plan', icon: 'trips' as PerriandIconName, path: '/trips' },
  { id: 'profile', label: 'Profile', icon: 'profile' as PerriandIconName, path: '/profile' },
];

export default function TabBar() {
  const pathname = usePathname();
  const router = useRouter();

  const activeTab = TABS.find(t => pathname.startsWith(t.path))?.id || 'trips';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center px-0 pt-2.5 border-t"
      style={{
        maxWidth: 480,
        margin: '0 auto',
        background: 'var(--t-cream)',
        borderColor: 'var(--t-linen)',
        paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
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
            <div
              style={{ color: isActive ? 'var(--t-signal-red)' : 'var(--t-ink)' }}
            >
              <PerriandIcon name={tab.icon} size={20} />
            </div>
            <span
              className="text-[9px] uppercase tracking-wider"
              style={{
                fontFamily: FONT.mono,
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
