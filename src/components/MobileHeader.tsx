'use client';

import { useRouter } from 'next/navigation';
import { FONT, INK } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useBreakpoint';

interface MobileHeaderProps {
  userInitials?: string;
}

/**
 * MobileHeader — persistent profile avatar in the upper-right on every mobile screen.
 * Hidden on desktop (DesktopNav handles it).
 */
export default function MobileHeader({ userInitials = 'G' }: MobileHeaderProps) {
  const isDesktop = useIsDesktop();
  const router = useRouter();

  if (isDesktop) return null;

  return (
    <div
      className="flex items-center justify-end"
      style={{ paddingTop: 12, paddingBottom: 4, paddingRight: 16, paddingLeft: 16 }}
    >
      <button
        onClick={() => router.push('/profile')}
        className="flex items-center justify-center rounded-full"
        style={{
          width: 30,
          height: 30,
          background: 'var(--t-ink)',
          color: 'var(--t-cream)',
          border: 'none',
          cursor: 'pointer',
          fontFamily: FONT.mono,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.5,
          flexShrink: 0,
        }}
        aria-label="Profile"
      >
        {userInitials}
      </button>
    </div>
  );
}
