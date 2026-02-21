'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PerriandIcon, PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';

const NAV_ITEMS = [
  { id: 'saved', label: 'Collect', icon: 'saved' as PerriandIconName, path: '/saved' },
  { id: 'trips', label: 'Plan', icon: 'trips' as PerriandIconName, path: '/trips' },
  { id: 'profile', label: 'Profile', icon: 'profile' as PerriandIconName, path: '/profile' },
];

interface DesktopNavProps {
  /** Current user initials for the avatar */
  userInitials?: string;
}

export default function DesktopNav({ userInitials = 'G' }: DesktopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const activeId = NAV_ITEMS.find(t => pathname.startsWith(t.path))?.id || 'trips';
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [avatarHovered, setAvatarHovered] = useState(false);

  return (
    <nav
      className="flex items-center justify-between px-6"
      style={{
        height: 56,
        background: 'var(--t-cream)',
        boxShadow: '0 1px 0 var(--t-linen)',
      }}
    >
      {/* Left: Terrazzo wordmark + icon */}
      <button
        onClick={() => router.push('/trips')}
        className="flex items-center gap-2 bg-transparent border-none cursor-pointer"
        style={{ padding: 0 }}
      >
        <PerriandIcon name="terrazzo" size={24} color="var(--t-ink)" accent="var(--t-signal-red)" />
        <span
          style={{
            fontFamily: "'Instrument Serif', 'DM Serif Display', serif",
            fontSize: 20,
            fontWeight: 400,
            color: 'var(--t-ink)',
            letterSpacing: -0.5,
          }}
        >
          Terrazzo
        </span>
      </button>

      {/* Center: nav links */}
      <div className="flex items-center gap-1">
        {NAV_ITEMS.map(item => {
          const isActive = item.id === activeId;
          const isHovered = hoveredNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.path)}
              onMouseEnter={() => setHoveredNav(item.id)}
              onMouseLeave={() => setHoveredNav(null)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full"
              style={{
                background: isActive ? INK['06'] : isHovered ? INK['04'] : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 150ms ease, color 150ms ease',
              }}
            >
              <PerriandIcon
                name={item.icon}
                size={16}
                color={isActive ? 'var(--t-signal-red)' : 'var(--t-ink)'}
                opacity={isActive ? 1 : isHovered ? 0.7 : 0.5}
              />
              <span
                style={{
                  fontFamily: FONT.sans,
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--t-ink)' : isHovered ? INK['85'] : INK['60'],
                  letterSpacing: 0.2,
                  transition: 'color 150ms ease',
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right: user avatar */}
      <div
        className="flex items-center justify-center rounded-full cursor-pointer"
        onMouseEnter={() => setAvatarHovered(true)}
        onMouseLeave={() => setAvatarHovered(false)}
        style={{
          width: 32,
          height: 32,
          background: 'var(--t-ink)',
          color: 'var(--t-cream)',
          fontFamily: FONT.mono,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 1,
          transition: 'box-shadow 150ms ease',
          boxShadow: avatarHovered ? '0 0 0 2px var(--t-honey)' : '0 0 0 0px transparent',
        }}
        onClick={() => router.push('/profile')}
      >
        {userInitials}
      </div>
    </nav>
  );
}
