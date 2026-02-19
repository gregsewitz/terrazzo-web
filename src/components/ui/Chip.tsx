'use client';

import type { ReactNode } from 'react';
import { PerriandIcon, type PerriandIconName } from '@/components/icons/PerriandIcons';
import { INK, FONT } from '@/constants/theme';

interface ChipProps {
  label: string;
  icon?: PerriandIconName;
  onClick?: () => void;
  variant?: 'filter' | 'tinted' | 'solid' | 'tag';
  size?: 'sm' | 'md';
  isActive?: boolean;
  color?: string;
  trailing?: ReactNode;
  className?: string;
}

const SIZE_MAP = {
  sm: { px: '6px 8px', fontSize: 9, iconSize: 10, gap: 3, fontFamily: FONT.mono },
  md: { px: '6px 10px', fontSize: 11, iconSize: 14, gap: 4, fontFamily: FONT.sans },
};

export default function Chip({
  label,
  icon,
  onClick,
  variant = 'filter',
  size = 'md',
  isActive = false,
  color,
  trailing,
  className,
}: ChipProps) {
  const s = SIZE_MAP[size];

  // Determine colors based on variant + active state
  let bg: string;
  let fg: string;
  let border: string | undefined;

  switch (variant) {
    case 'filter':
      if (isActive) {
        bg = 'var(--t-ink)';
        fg = 'white';
        border = '1px solid var(--t-ink)';
      } else {
        bg = 'white';
        fg = INK['90'];
        border = '1px solid var(--t-linen)';
      }
      break;

    case 'tinted':
      bg = color ? `${color}15` : INK['06'];
      fg = color || 'var(--t-ink)';
      border = color ? `1.5px solid ${color}25` : undefined;
      break;

    case 'solid':
      bg = color || 'var(--t-verde)';
      fg = 'white';
      break;

    case 'tag':
      bg = 'var(--t-linen)';
      fg = 'var(--t-ink)';
      break;

    default:
      bg = INK['06'];
      fg = 'var(--t-ink)';
  }

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center rounded-full whitespace-nowrap cursor-pointer transition-all flex-shrink-0 ${className || ''}`}
      style={{
        padding: s.px,
        gap: s.gap,
        fontSize: s.fontSize,
        fontFamily: s.fontFamily,
        fontWeight: isActive ? 600 : 500,
        background: bg,
        color: fg,
        border: border || 'none',
      }}
    >
      {icon && <PerriandIcon name={icon} size={s.iconSize} color={fg} />}
      <span>{label}</span>
      {trailing}
    </button>
  );
}
