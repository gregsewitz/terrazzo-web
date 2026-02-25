'use client';

import { useRef } from 'react';
import { useSavedStore } from '@/stores/savedStore';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';

interface PlaceSearchBarProps {
  /** Placeholder text override */
  placeholder?: string;
}

export default function PlaceSearchBar({ placeholder }: PlaceSearchBarProps = {}) {
  const searchQuery = useSavedStore(s => s.searchQuery);
  const setSearchQuery = useSavedStore(s => s.setSearchQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <PerriandIcon
        name="discover"
        size={14}
        color={INK['35']}
        style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
      />
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder || "Find in your library..."}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setSearchQuery('');
            inputRef.current?.blur();
          }
        }}
        style={{
          width: '100%',
          borderRadius: 10,
          padding: '10px 36px 10px 36px',
          fontSize: 16,
          background: 'white',
          border: '1px solid var(--t-linen)',
          color: 'var(--t-ink)',
          fontFamily: FONT.sans,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      {searchQuery && (
        <button
          onClick={() => {
            setSearchQuery('');
            inputRef.current?.focus();
          }}
          style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            width: 20, height: 20, borderRadius: 10,
            background: INK['08'], border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <PerriandIcon name="close" size={8} color={INK['50']} />
        </button>
      )}
    </div>
  );
}
