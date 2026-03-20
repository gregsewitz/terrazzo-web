'use client';

import { FONT, INK, TEXT } from '@/constants/theme';
import type { SortDirection } from './FilterSortBar';

interface SortPillsProps<T extends string> {
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Sort direction — ascending or descending */
  sortDirection?: SortDirection;
  onSortDirectionChange?: (dir: SortDirection) => void;
  /** Minimum item count before pills render (default: 3) */
  minItems?: number;
  itemCount?: number;
}

export default function SortPills<T extends string>({
  options,
  value,
  onChange,
  sortDirection = 'desc',
  onSortDirectionChange,
  minItems = 3,
  itemCount,
}: SortPillsProps<T>) {
  if (itemCount !== undefined && itemCount < minItems) return null;

  return (
    <div className="flex items-center gap-1.5 mb-3 pb-3" style={{ borderBottom: '1px solid var(--t-linen)' }}>
      <span style={{ fontFamily: FONT.mono, fontSize: 8, letterSpacing: 1.5, color: TEXT.secondary, textTransform: 'uppercase', marginRight: 4 }}>
        Sort
      </span>
      {options.map(opt => (
        <button
          key={opt.id}
          onClick={() => {
            if (value === opt.id && onSortDirectionChange) {
              onSortDirectionChange(sortDirection === 'desc' ? 'asc' : 'desc');
            } else {
              onChange(opt.id);
            }
          }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] cursor-pointer transition-all"
          style={{
            background: value === opt.id ? TEXT.primary : 'transparent',
            color: value === opt.id ? 'white' : TEXT.secondary,
            border: value === opt.id ? `1px solid ${TEXT.primary}` : `1px solid ${INK['12']}`,
            fontFamily: FONT.sans,
            fontWeight: value === opt.id ? 600 : 400,
          }}
        >
          {opt.label}
          {value === opt.id && (
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: sortDirection === 'asc' ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
            >
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}
