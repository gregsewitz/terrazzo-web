'use client';

import { usePathname, useRouter } from 'next/navigation';
import { PerriandIcon, PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import { useAddBarStore } from '@/stores/addBarStore';

export default function TabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const openAddBar = useAddBarStore(s => s.open);

  // Hide on desktop — DesktopNav handles navigation
  if (isDesktop) return null;

  const isCollect = pathname.startsWith('/saved');
  const isPlan = pathname.startsWith('/trips');

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-end justify-around px-2 border-t"
      style={{
        maxWidth: 480,
        margin: '0 auto',
        background: 'var(--t-cream)',
        borderColor: 'var(--t-linen)',
        paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
        paddingTop: 8,
      }}
    >
      {/* Collect */}
      <button
        onClick={() => router.push('/saved')}
        className="flex flex-col items-center gap-0.5 bg-transparent border-none cursor-pointer transition-opacity"
        style={{ opacity: isCollect ? 1 : 0.4, flex: 1, padding: 0 }}
      >
        <div style={{ color: isCollect ? 'var(--t-signal-red)' : 'var(--t-ink)' }}>
          <PerriandIcon name={'saved' as PerriandIconName} size={20} />
        </div>
        <span
          className="text-[9px] uppercase tracking-wider"
          style={{
            fontFamily: FONT.mono,
            fontWeight: isCollect ? 700 : 400,
            color: 'var(--t-ink)',
          }}
        >
          Collect
        </span>
      </button>

      {/* Center: + Place */}
      <button
        onClick={() => openAddBar()}
        className="flex flex-col items-center gap-0.5 bg-transparent border-none cursor-pointer"
        style={{ flex: 1, padding: 0 }}
        aria-label="Add a place"
      >
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: 36,
            height: 36,
            background: 'var(--t-ink)',
            margin: '0 auto',
            marginTop: -2,
          }}
        >
          <PerriandIcon name="add" size={16} color="var(--t-cream)" />
        </div>
        <span
          className="text-[9px] uppercase tracking-wider"
          style={{
            fontFamily: FONT.mono,
            fontWeight: 400,
            color: 'var(--t-ink)',
          }}
        >
          Place
        </span>
      </button>

      {/* Plan */}
      <button
        onClick={() => router.push('/trips')}
        className="flex flex-col items-center gap-0.5 bg-transparent border-none cursor-pointer transition-opacity"
        style={{ opacity: isPlan ? 1 : 0.4, flex: 1, padding: 0 }}
      >
        <div style={{ color: isPlan ? 'var(--t-signal-red)' : 'var(--t-ink)' }}>
          <PerriandIcon name={'trips' as PerriandIconName} size={20} />
        </div>
        <span
          className="text-[9px] uppercase tracking-wider"
          style={{
            fontFamily: FONT.mono,
            fontWeight: isPlan ? 700 : 400,
            color: 'var(--t-ink)',
          }}
        >
          Plan
        </span>
      </button>
    </nav>
  );
}
