'use client';

import { motion } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import { PerriandIcon, PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, COLORS } from '@/constants/theme';
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
      className="fixed bottom-0 left-0 right-0 z-50 flex items-end justify-around px-2"
      style={{
        maxWidth: 480,
        margin: '0 auto',
        background: 'var(--t-cream)',
        borderTop: `2px solid ${COLORS.navy}`,
        paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
        paddingTop: 10,
      }}
    >
      {/* Collect */}
      <motion.button
        onClick={() => router.push('/saved')}
        className="relative flex flex-col items-center gap-1 bg-transparent border-none cursor-pointer transition-opacity"
        style={{ opacity: isCollect ? 1 : 0.5, flex: 1, padding: 0 }}
        whileTap={{ scale: 0.92 }}
      >
        <div style={{ color: isCollect ? COLORS.coral : COLORS.navy }}>
          <PerriandIcon name={'saved' as PerriandIconName} size={22} />
        </div>
        <span
          className="text-[10px] uppercase"
          style={{
            fontFamily: FONT.display,
            letterSpacing: '0.1em',
            color: COLORS.navy,
          }}
        >
          Collect
        </span>
        {isCollect && (
          <motion.div
            layoutId="tabIndicator"
            className="absolute -bottom-1.5 left-1/2 h-0.5"
            style={{ background: COLORS.coral, transform: 'translateX(-50%)', width: 24, borderRadius: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
      </motion.button>

      {/* Center: + Place */}
      <motion.button
        onClick={() => openAddBar()}
        className="flex flex-col items-center gap-1 bg-transparent border-none cursor-pointer"
        style={{ flex: 1, padding: 0 }}
        aria-label="Add a place"
        whileTap={{ scale: 0.92 }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            width: 40,
            height: 40,
            background: COLORS.coral,
            margin: '0 auto',
            marginTop: -4,
            borderRadius: 0,
          }}
        >
          <PerriandIcon name="add" size={18} color="white" />
        </div>
        <span
          className="text-[10px] uppercase"
          style={{
            fontFamily: FONT.display,
            letterSpacing: '0.1em',
            color: COLORS.navy,
          }}
        >
          Place
        </span>
      </motion.button>

      {/* Plan */}
      <motion.button
        onClick={() => router.push('/trips')}
        className="relative flex flex-col items-center gap-1 bg-transparent border-none cursor-pointer transition-opacity"
        style={{ opacity: isPlan ? 1 : 0.5, flex: 1, padding: 0 }}
        whileTap={{ scale: 0.92 }}
      >
        <div style={{ color: isPlan ? COLORS.coral : COLORS.navy }}>
          <PerriandIcon name={'trips' as PerriandIconName} size={22} />
        </div>
        <span
          className="text-[10px] uppercase"
          style={{
            fontFamily: FONT.display,
            letterSpacing: '0.1em',
            color: COLORS.navy,
          }}
        >
          Plan
        </span>
        {isPlan && (
          <motion.div
            layoutId="tabIndicator"
            className="absolute -bottom-1.5 left-1/2 h-0.5"
            style={{ background: COLORS.coral, transform: 'translateX(-50%)', width: 24, borderRadius: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
      </motion.button>
    </nav>
  );
}
