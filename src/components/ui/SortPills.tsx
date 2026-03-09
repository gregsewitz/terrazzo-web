'use client';

import { FONT, INK } from '@/constants/theme';

interface SortPillsProps<T extends string> {
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Minimum item count before pills render (default: 3) */
  minItems?: number;
  itemCount?: number;
}

export default function SortPills<T extends string>({
  options,
  value,
  onChange,
  minItems = 3,
  itemCount,
}: SortPillsProps<T>) {
  if (itemCount !== undefined && itemCount < minItems) return null;

  return (
    <div className="flex items-center gap-1.5 mb-3 pb-3" style={{ borderBottom: '1px solid var(--t-linen)' }}>
      <span style={{ fontFamily: FONT.mono, fontSize: 8, letterSpacing: 1.5, color: INK['40'], textTransform: 'uppercase', marginRight: 4 }}>
        Sort
      </span>
      {options.map(opt => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className="px-2.5 py-1 rounded-full text-[10px] cursor-pointer transition-all"
          style={{
            background: value === opt.id ? 'var(--t-ink)' : 'transparent',
            color: value === opt.id ? 'white' : INK['70'],
            border: value === opt.id ? '1px solid var(--t-ink)' : `1px solid ${INK['12']}`,
            fontFamily: FONT.sans,
            fontWeight: value === opt.id ? 600 : 400,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
