'use client';

import { useState, useRef, useCallback } from 'react';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT } from '@/constants/theme';
import { DreamBoardEntryType } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';

const FILTER_OPTIONS: { type: DreamBoardEntryType | 'all'; label: string }[] = [
  { type: 'all', label: 'All' },
  { type: 'text', label: 'Notes' },
  { type: 'link', label: 'Links' },
  { type: 'checklist', label: 'Lists' },
];

interface SearchFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeFilter: DreamBoardEntryType | 'all';
  onFilterChange: (filter: DreamBoardEntryType | 'all') => void;
  entryCounts: Record<DreamBoardEntryType | 'all', number>;
}

export function SearchFilter({
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  entryCounts,
}: SearchFilterProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleToggleSearch = useCallback(() => {
    if (searchOpen) {
      onSearchChange('');
      setSearchOpen(false);
    } else {
      setSearchOpen(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [searchOpen, onSearchChange]);

  return (
    <div className="flex flex-col gap-2">
      {/* Search bar */}
      <div className="flex items-center gap-2">
        <AnimatePresence mode="wait">
          {searchOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '100%', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex items-center gap-2 rounded-lg px-2.5 py-1.5"
              style={{ background: INK['04'], border: `1px solid ${INK['08']}` }}
            >
              <PerriandIcon name="discover" size={12} color={INK['30']} />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="Search entries..."
                className="flex-1 text-[12px] bg-transparent border-none outline-none"
                style={{ fontFamily: FONT.sans, color: TEXT.primary }}
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="w-4 h-4 flex items-center justify-center border-none cursor-pointer"
                  style={{ background: 'transparent' }}
                >
                  <PerriandIcon name="close" size={8} color={INK['30']} />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={handleToggleSearch}
          className="flex items-center justify-center w-7 h-7 rounded-lg border-none cursor-pointer flex-shrink-0 transition-colors"
          style={{
            background: searchOpen ? INK['08'] : 'transparent',
          }}
          title={searchOpen ? 'Close search' : 'Search'}
        >
          <PerriandIcon
            name={searchOpen ? 'close' : 'discover'}
            size={13}
            color={searchOpen ? TEXT.primary : INK['35']}
          />
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1" style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
        {FILTER_OPTIONS.map(f => {
          const isActive = activeFilter === f.type;
          const count = entryCounts[f.type] || 0;
          return (
            <button
              key={f.type}
              onClick={() => onFilterChange(f.type)}
              className="flex items-center gap-1 px-2 py-1 rounded-full border cursor-pointer transition-all flex-shrink-0"
              style={{
                background: isActive ? 'var(--t-ink)' : 'transparent',
                color: isActive ? 'white' : TEXT.secondary,
                borderColor: isActive ? 'var(--t-ink)' : INK['10'],
                fontFamily: FONT.sans,
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              {f.label}
              {count > 0 && (
                <span
                  className="text-[9px] px-1 rounded-full"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.2)' : INK['06'],
                    color: isActive ? 'rgba(255,255,255,0.8)' : TEXT.secondary,
                    fontFamily: FONT.mono,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
