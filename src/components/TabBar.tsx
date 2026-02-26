'use client';

import { motion } from 'framer-motion';
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
      <motion.button
        onClick={() => router.push('/saved')}
        className="relative flex flex-col items-center gap-0.5 bg-transparent border-none cursor-pointer transition-opacity"
        style={{ opacity: isCollect ? 1 : 0.4, flex: 1, padding: 0 }}
        whileTap={{ scale: 0.92 }}
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
        {isCollect && (
          <motion.div
            layoutId="tabIndicator"
            className="absolute -bottom-1 left-1/2 w-1 h-1 rounded-full"
            style={{ background: 'var(--t-signal-red)', transform: 'translateX(-50%)' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
      </motion.button>

      {/* Center: + Place */}
      <motion.button
        onClick={() => openAddBar()}
        className="flex flex-col items-center gap-0.5 bg-transparent border-none cursor-pointer"
        style={{ flex: 1, padding: 0 }}
        aria-label="Add a place"
        whileTap={{ scale: 0.92 }}
      >
        <motion.div
          className="flex items-center justify-center rounded-full"
          style={{
            width: 36,
            height: 36,
            background: 'var(--t-ink)',
            margin: '0 auto',
            marginTop: -2,
          }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <PerriandIcon name="add" size={16} color="var(--t-cream)" />
        </motion.div>
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
      </motion.button>

      {/* Plan */}
      <motion.button
        onClick={() => router.push('/trips')}
        className="relative flex flex-col items-center gap-0.5 bg-transparent border-none cursor-pointer transition-opacity"
        style={{ opacity: isPlan ? 1 : 0.4, flex: 1, padding: 0 }}
        whileTap={{ scale: 0.92 }}
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
        {isPlan && (
          <motion.div
            layoutId="tabIndicator"
            className="absolute -bottom-1 left-1/2 w-1 h-1 rounded-full"
            style={{ background: 'var(--t-signal-red)', transform: 'translateX(-50%)' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
      </motion.button>
    </nav>
  );
}
