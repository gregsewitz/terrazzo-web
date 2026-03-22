'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PerriandIcon, PerriandIconName } from '@/components/icons/PerriandIcons';
import { Logo } from '@/components/brand';
import { FONT, TEXT, INK, COLOR } from '@/constants/theme';
import { useAddBarStore } from '@/stores/addBarStore';

interface DesktopNavProps {
  userInitials?: string;
}

export default function DesktopNav({ userInitials = 'G' }: DesktopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const openAddBar = useAddBarStore(s => s.open);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [avatarHovered, setAvatarHovered] = useState(false);

  const isDiscover = pathname.startsWith('/discover');
  const isCollect = pathname.startsWith('/saved');
  const isPlan = pathname.startsWith('/trips');
  const isProfile = pathname === '/profile';

  return (
    <nav
      className="flex items-center justify-between px-6"
      style={{
        height: 56,
        background: COLOR.coral,
        boxShadow: 'none',
      }}
    >
      {/* Left: Terrazzo wordmark */}
      <button
        aria-label="Go to discover"
        onClick={() => router.push('/discover')}
        className="flex items-center bg-transparent border-none cursor-pointer"
        style={{ padding: 0 }}
      >
        <Logo variant="wordmark" font="pixellance" theme="light" style={{ height: 22, width: 'auto' }} />
      </button>

      {/* Center: Discover · Collect · + Place · Plan */}
      <div className="flex items-center gap-1">
        {/* Discover */}
        <NavLink
          label="Discover"
          icon="discover"
          isActive={isDiscover}
          isHovered={hoveredNav === 'discover'}
          onMouseEnter={() => setHoveredNav('discover')}
          onMouseLeave={() => setHoveredNav(null)}
          onClick={() => router.push('/discover')}
        />

        {/* Collect */}
        <NavLink
          label="Collect"
          icon="saved"
          isActive={isCollect}
          isHovered={hoveredNav === 'collect'}
          onMouseEnter={() => setHoveredNav('collect')}
          onMouseLeave={() => setHoveredNav(null)}
          onClick={() => router.push('/saved')}
        />

        {/* + Place */}
        <button
          onClick={() => openAddBar()}
          onMouseEnter={() => setHoveredNav('add')}
          onMouseLeave={() => setHoveredNav(null)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full"
          style={{
            background: hoveredNav === 'add' ? 'rgba(255,255,255,0.25)' : 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'background 150ms ease',
          }}
          aria-label="Add a place"
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 22,
              height: 22,
              background: 'var(--t-ink)',
              flexShrink: 0,
            }}
          >
            <PerriandIcon name="add" size={12} color="var(--t-cream)" />
          </div>
          <span
            style={{
              fontFamily: FONT.sans,
              fontSize: 14,
              fontWeight: 400,
              color: hoveredNav === 'add' ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.85)',
              letterSpacing: 0.2,
              transition: 'color 150ms ease',
            }}
          >
            Place
          </span>
        </button>

        {/* Plan */}
        <NavLink
          label="Plan"
          icon="trips"
          isActive={isPlan}
          isHovered={hoveredNav === 'plan'}
          onMouseEnter={() => setHoveredNav('plan')}
          onMouseLeave={() => setHoveredNav(null)}
          onClick={() => router.push('/trips')}
        />

        {/* Profile */}
        <NavLink
          label="Profile"
          icon="profile"
          isActive={isProfile}
          isHovered={hoveredNav === 'profile'}
          onMouseEnter={() => setHoveredNav('profile')}
          onMouseLeave={() => setHoveredNav(null)}
          onClick={() => router.push('/profile')}
        />
      </div>

      {/* Right: user avatar → profile */}
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
          boxShadow: avatarHovered ? '0 0 0 2px var(--t-coral)' : '0 0 0 0px transparent',
        }}
        onClick={() => router.push('/profile')}
      >
        {userInitials}
      </div>
    </nav>
  );
}

function NavLink({
  label, icon, isActive, isHovered, onMouseEnter, onMouseLeave, onClick,
}: {
  label: string;
  icon: PerriandIconName;
  isActive: boolean;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="flex items-center gap-1.5 px-4 py-2 rounded-full"
      style={{
        background: isActive ? 'rgba(255,255,255,0.92)' : isHovered ? 'rgba(255,255,255,0.25)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 150ms ease, color 150ms ease',
        boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
      }}
    >
      <PerriandIcon
        name={icon}
        size={16}
        color={isActive ? COLOR.coral : 'rgba(255,255,255,0.85)'}
        opacity={1}
      />
      <span
        style={{
          fontFamily: FONT.sans,
          fontSize: 14,
          fontWeight: isActive ? 600 : 400,
          color: isActive ? 'var(--t-navy)' : isHovered ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.85)',
          letterSpacing: 0.2,
          transition: 'color 150ms ease',
        }}
      >
        {label}
      </span>
    </button>
  );
}
