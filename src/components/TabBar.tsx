'use client';

import { usePathname, useRouter } from 'next/navigation';
import { PerriandIcon, PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import { useAddBarStore } from '@/stores/addBarStore';

const TABS = [
  { id: 'saved', label: 'Library', icon: 'saved' as PerriandIconName, path: '/saved' },
  { id: 'trips', label: 'Plan', icon: 'trips' as PerriandIconName, path: '/trips' },
  { id: 'profile', label: 'Profile', icon: 'profile' as PerriandIconName, path: '/profile' },
];

export default function TabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const openAddBar = useAddBarStore(s => s.open);

  // Hide on desktop — DesktopNav handles navigation
  if (isDesktop) return null;

  const activeTab = TABS.find(t => pathname.startsWith(t.path))?.id || 'trips';

  return (
    <>
      {/* FAB — floating + button above TabBar */}
      <button
        onClick={() => openAddBar()}
        className="fixed flex items-center justify-center rounded-full"
        style={{
          bottom: 72,
          right: 'max(16px, calc((100vw - 480px) / 2 + 16px))',
          zIndex: 49,
          width: 52,
          height: 52,
          background: 'var(--t-ink)',
          color: 'var(--t-cream)',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 6px 24px rgba(28,26,23,0.25)',
          transition: 'transform 150ms ease, box-shadow 150ms ease',
        }}
        aria-label="Save a place"
      >
        <PerriandIcon name="add" size={22} color="var(--t-cream)" />
      </button>

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
    </>
  );
}
