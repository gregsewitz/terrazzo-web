'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PerriandIcon, PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK, COLORS } from '@/constants/theme';
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

  const isCollect = pathname.startsWith('/saved');
  const isPlan = pathname.startsWith('/trips');

  return (
    <nav
      className="flex items-center justify-between px-8"
      style={{
        height: 64,
        background: 'var(--t-cream)',
        borderBottom: `2px solid ${COLORS.navy}`,
      }}
    >
      {/* Left: Terrazzo wordmark - Kinetic Dreamer bold condensed */}
      <button
        onClick={() => router.push('/trips')}
        className="flex items-center gap-3 bg-transparent border-none cursor-pointer"
        style={{ padding: 0 }}
      >
        <PerriandIcon name="terrazzo" size={28} color={COLORS.navy} accent={COLORS.coral} />
        <span
          style={{
            fontFamily: FONT.display,
            fontSize: 26,
            fontWeight: 400,
            color: COLORS.navy,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          Terrazzo
        </span>
      </button>

      {/* Center: Collect · + Place · Plan */}
      <div className="flex items-center gap-1">
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
          className="flex items-center gap-2 px-5 py-2.5"
          style={{
            background: hoveredNav === 'add' ? COLORS.coral : COLORS.peach,
            border: 'none',
            cursor: 'pointer',
            transition: 'all 200ms ease',
            borderRadius: 0,
          }}
          aria-label="Add a place"
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: 20,
              height: 20,
              background: hoveredNav === 'add' ? 'white' : COLORS.coral,
              flexShrink: 0,
              borderRadius: 0,
              transition: 'all 200ms ease',
            }}
          >
            <PerriandIcon name="add" size={12} color={hoveredNav === 'add' ? COLORS.coral : 'white'} />
          </div>
          <span
            style={{
              fontFamily: FONT.display,
              fontSize: 14,
              color: hoveredNav === 'add' ? 'white' : COLORS.navy,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              transition: 'color 200ms ease',
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
      </div>

      {/* Right: user avatar → profile */}
      <div
        className="flex items-center justify-center cursor-pointer"
        onMouseEnter={() => setAvatarHovered(true)}
        onMouseLeave={() => setAvatarHovered(false)}
        style={{
          width: 36,
          height: 36,
          background: COLORS.navy,
          color: 'white',
          fontFamily: FONT.display,
          fontSize: 14,
          letterSpacing: '0.05em',
          transition: 'all 200ms ease',
          borderRadius: 0,
          border: avatarHovered ? `2px solid ${COLORS.coral}` : `2px solid ${COLORS.navy}`,
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
      className="flex items-center gap-2 px-5 py-2.5"
      style={{
        background: isActive ? COLORS.mint : isHovered ? INK['06'] : 'transparent',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 200ms ease',
        borderRadius: 0,
      }}
    >
      <PerriandIcon
        name={icon}
        size={18}
        color={isActive ? COLORS.navy : COLORS.navy}
        opacity={isActive ? 1 : isHovered ? 0.8 : 0.6}
      />
      <span
        style={{
          fontFamily: FONT.display,
          fontSize: 14,
          color: isActive ? COLORS.navy : isHovered ? COLORS.navy : INK['60'],
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          transition: 'color 200ms ease',
        }}
      >
        {label}
      </span>
    </button>
  );
}
