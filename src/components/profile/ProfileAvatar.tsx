'use client';

import { useRouter } from 'next/navigation';
import { FONT } from '@/constants/theme';

interface ProfileAvatarProps {
  initials?: string;
  size?: number;
}

/**
 * Small profile avatar button — navigates to /profile on tap.
 * Drop into any page header row on the right side.
 */
export default function ProfileAvatar({ initials = 'G', size = 30 }: ProfileAvatarProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push('/profile')}
      className="flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: 'var(--t-ink)',
        color: 'var(--t-cream)',
        border: 'none',
        cursor: 'pointer',
        fontFamily: FONT.mono,
        fontSize: Math.round(size * 0.37),
        fontWeight: 700,
        letterSpacing: 0.5,
        flexShrink: 0,
      }}
      aria-label="Profile"
    >
      {initials}
    </button>
  );
}
