'use client';

import { useState } from 'react';
import { PerriandIcon, type PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';

// ─── Types ───

export interface FilterOption {
  value: string;
  label: string;
  icon?: PerriandIconName;
  count?: number;
}

export interface SortOption {
  value: string;
  label: string;
}

export interface FilterSortBarProps {
  /** Filter dimensions — each group becomes a section in the filter panel */
  filterGroups?: {
    key: string;
    label: string;           // e.g. "Type", "Source", "Location"
    options: FilterOption[];
    value: string;           // current active value
    onChange: (value: string) => void;
    allValue?: string;       // value that means "no filter" (default: 'all')
  }[];
  /** Sort options */
  sortOptions?: SortOption[];
  sortValue?: string;
  onSortChange?: (value: string) => void;
  defaultSortValue?: string; // value that means "default sort" (default: first option)
  /** Optional: reset all callback */
  onResetAll?: () => void;
  /** Compact mode for tight spaces */
  compact?: boolean;
}

// ─── Active label helpers ───

function getActiveFilterLabel(
  groups: FilterSortBarProps['filterGroups'],
): string | null {
  if (!groups) return null;
  const active = groups.filter(g => g.value !== (g.allValue || 'all'));
  if (active.length === 0) return null;
  if (active.length === 1) {
    const opt = active[0].options.find(o => o.value === active[0].value);
    return opt?.label || null;
  }
  return `${active.length} active`;
}

function getActiveFilterIcon(
  groups: FilterSortBarProps['filterGroups'],
): PerriandIconName | undefined {
  if (!groups) return undefined;
  const active = groups.filter(g => g.value !== (g.allValue || 'all'));
  if (active.length === 1) {
    const opt = active[0].options.find(o => o.value === active[0].value);
    return opt?.icon;
  }
  return undefined;
}

// ─── Component ───

export default function FilterSortBar({
  filterGroups,
  sortOptions,
  sortValue,
  onSortChange,
  defaultSortValue,
  onResetAll,
  compact,
}: FilterSortBarProps) {
  const [openPanel, setOpenPanel] = useState<'filter' | 'sort' | null>(null);

  const hasFilters = filterGroups && filterGroups.length > 0;
  const hasSort = sortOptions && sortOptions.length > 1 && onSortChange;

  const isFilterActive = filterGroups?.some(g => g.value !== (g.allValue || 'all')) || false;
  const effectiveDefaultSort = defaultSortValue || sortOptions?.[0]?.value;
  const isSortActive = sortValue !== undefined && sortValue !== effectiveDefaultSort;

  const activeFilterLabel = getActiveFilterLabel(filterGroups);
  const activeFilterIcon = getActiveFilterIcon(filterGroups);

  const activeSortLabel = sortOptions?.find(o => o.value === sortValue)?.label;

  const hasAnyActive = isFilterActive || isSortActive;

  return (
    <div>
      {/* Button row */}
      <div className="flex items-center gap-1.5" style={{ padding: compact ? '0' : undefined }}>
        {hasFilters && (
          <button
            onClick={() => setOpenPanel(openPanel === 'filter' ? null : 'filter')}
            className={`flex items-center gap-1.5 rounded-full font-medium cursor-pointer transition-all ${compact ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]'}`}
            style={{
              background: isFilterActive || openPanel === 'filter' ? 'var(--t-ink)' : 'white',
              color: isFilterActive || openPanel === 'filter' ? 'white' : INK['70'],
              border: isFilterActive || openPanel === 'filter' ? '1px solid var(--t-ink)' : '1px solid var(--t-linen)',
              fontFamily: FONT.sans,
            }}
          >
            <PerriandIcon
              name={activeFilterIcon || 'discover'}
              size={12}
              color={isFilterActive || openPanel === 'filter' ? 'white' : INK['50']}
            />
            {activeFilterLabel || 'Filter'}
            <Chevron open={openPanel === 'filter'} />
          </button>
        )}

        {hasSort && (
          <button
            onClick={() => setOpenPanel(openPanel === 'sort' ? null : 'sort')}
            className={`flex items-center gap-1.5 rounded-full font-medium cursor-pointer transition-all ${compact ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]'}`}
            style={{
              background: isSortActive || openPanel === 'sort' ? 'var(--t-ink)' : 'white',
              color: isSortActive || openPanel === 'sort' ? 'white' : INK['70'],
              border: isSortActive || openPanel === 'sort' ? '1px solid var(--t-ink)' : '1px solid var(--t-linen)',
              fontFamily: FONT.sans,
            }}
          >
            <SortIcon color={isSortActive || openPanel === 'sort' ? 'white' : INK['50']} />
            {isSortActive ? activeSortLabel : 'Sort'}
            <Chevron open={openPanel === 'sort'} />
          </button>
        )}

        {/* Reset link — only when something is active and panels are closed */}
        {hasAnyActive && !openPanel && onResetAll && (
          <button
            onClick={onResetAll}
            className="text-[10px] font-medium cursor-pointer ml-1"
            style={{ background: 'none', border: 'none', color: 'var(--t-verde)', fontFamily: FONT.sans, padding: 0 }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Expanded filter panel */}
      {openPanel === 'filter' && hasFilters && (
        <div
          className="mt-2 pb-2"
          style={{ borderBottom: '1px solid var(--t-linen)' }}
        >
          {filterGroups!.map((group, idx) => (
            <div key={group.key} className={idx > 0 ? 'mt-2' : ''}>
              {filterGroups!.length > 1 && (
                <span
                  className="text-[9px] font-semibold uppercase tracking-wider block mb-1"
                  style={{ color: INK['40'], fontFamily: FONT.mono }}
                >
                  {group.label}
                </span>
              )}
              <div className="flex flex-wrap gap-1.5">
                {group.options.map(opt => {
                  const isActive = group.value === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        group.onChange(opt.value);
                        // Close panel if only one filter group
                        if (filterGroups!.length === 1) setOpenPanel(null);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap cursor-pointer transition-all"
                      style={{
                        background: isActive ? 'var(--t-ink)' : 'white',
                        color: isActive ? 'white' : INK['70'],
                        border: isActive ? '1px solid var(--t-ink)' : '1px solid var(--t-linen)',
                        fontFamily: FONT.sans,
                      }}
                    >
                      {opt.icon && (
                        <PerriandIcon name={opt.icon} size={12} color={isActive ? 'white' : INK['50']} />
                      )}
                      {opt.label}
                      {opt.count !== undefined && (
                        <span style={{ opacity: 0.7 }}>{opt.count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {/* Done button for multi-group filters */}
          {filterGroups!.length > 1 && (
            <button
              onClick={() => setOpenPanel(null)}
              className="text-[10px] font-semibold mt-2 cursor-pointer"
              style={{ background: 'none', border: 'none', color: 'var(--t-verde)', fontFamily: FONT.sans, padding: 0 }}
            >
              Done
            </button>
          )}
        </div>
      )}

      {/* Expanded sort panel */}
      {openPanel === 'sort' && hasSort && (
        <div
          className="flex flex-wrap gap-1.5 mt-2 pb-2"
          style={{ borderBottom: '1px solid var(--t-linen)' }}
        >
          {sortOptions!.map(opt => {
            const isActive = sortValue === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => {
                  onSortChange!(opt.value);
                  setOpenPanel(null);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium cursor-pointer transition-all"
                style={{
                  background: isActive ? 'var(--t-ink)' : 'white',
                  color: isActive ? 'white' : INK['70'],
                  border: isActive ? '1px solid var(--t-ink)' : '1px solid var(--t-linen)',
                  fontFamily: FONT.sans,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Small helpers ───

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function SortIcon({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M3 6h18M3 12h12M3 18h6" />
    </svg>
  );
}
