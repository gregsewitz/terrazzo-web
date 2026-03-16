'use client';

import { useState, useMemo } from 'react';
import { PerriandIcon, isPerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT } from '@/constants/theme';
import SortPills from '@/components/ui/SortPills';
import type { Collection } from '@/types';

// ─── Sort logic ───

type CollectionSortKey = 'recent' | 'az' | 'most' | 'fewest';

const COLLECTION_SORT_OPTIONS: { id: CollectionSortKey; label: string }[] = [
  { id: 'recent', label: 'Recent' },
  { id: 'az', label: 'A–Z' },
  { id: 'most', label: 'Most' },
  { id: 'fewest', label: 'Fewest' },
];

function sortCollections(collections: Collection[], sortBy: CollectionSortKey): Collection[] {
  const items = [...collections];
  switch (sortBy) {
    case 'az':
      return items.sort((a, b) => a.name.localeCompare(b.name));
    case 'most':
      return items.sort((a, b) => b.placeIds.length - a.placeIds.length);
    case 'fewest':
      return items.sort((a, b) => a.placeIds.length - b.placeIds.length);
    case 'recent':
    default:
      return items.sort((a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime()
      );
  }
}

// ─── Component ───

interface CollectionPickerListProps {
  collections: Collection[];
  /** Return true if this collection is currently selected/active */
  isSelected: (collectionId: string) => boolean;
  onToggle: (collectionId: string) => void;
  onCreate: (name: string, iconName: string) => Promise<string>;
  /** If provided, auto-toggle the newly created collection */
  autoToggleNew?: boolean;
  /** Outer wrapper classes for the list container */
  listClassName?: string;
}

export default function CollectionPickerList({
  collections,
  isSelected,
  onToggle,
  onCreate,
  autoToggleNew = true,
  listClassName = 'flex flex-col gap-1.5 mb-4',
}: CollectionPickerListProps) {
  const [sortBy, setSortBy] = useState<CollectionSortKey>('recent');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  const sorted = useMemo(
    () => sortCollections(collections, sortBy),
    [collections, sortBy],
  );

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const newId = await onCreate(newName.trim(), 'pin');
    if (autoToggleNew) onToggle(newId);
    setNewName('');
    setShowCreate(false);
  };

  return (
    <>
      {/* Sort pills */}
      <SortPills
        options={COLLECTION_SORT_OPTIONS}
        value={sortBy}
        onChange={setSortBy}
        itemCount={collections.length}
      />

      {/* Collection rows */}
      <div className={listClassName}>
        {sorted.map(sl => {
          const active = isSelected(sl.id);
          const isIcon = sl.emoji ? isPerriandIconName(sl.emoji) : false;

          return (
            <button
              key={sl.id}
              onClick={() => onToggle(sl.id)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all cursor-pointer w-full text-left"
              style={{
                background: active ? 'rgba(58,128,136,0.04)' : 'white',
                border: active ? '1.5px solid var(--t-dark-teal)' : '1px solid var(--t-navy)',
              }}
            >
              {/* Icon */}
              <span style={{ fontSize: isIcon ? 14 : 16, width: 20, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isIcon ? (
                  <PerriandIcon name={sl.emoji as any} size={14} color={active ? 'var(--t-dark-teal)' : TEXT.secondary} />
                ) : (
                  <PerriandIcon name="pin" size={14} color={active ? 'var(--t-dark-teal)' : TEXT.secondary} />
                )}
              </span>

              {/* Name + count */}
              <div className="flex-1 text-left">
                <span style={{ fontFamily: FONT.sans, fontSize: 13, color: TEXT.primary }}>
                  {sl.name}
                </span>
                <span className="ml-2" style={{ fontFamily: FONT.mono, fontSize: 10, color: TEXT.secondary }}>
                  {sl.placeIds.length}
                </span>
              </div>

              {/* Checkmark */}
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: active ? 'var(--t-dark-teal)' : INK['06'] }}
              >
                {active && (
                  <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>&#10003;</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Inline create */}
      <div className="flex-shrink-0">
        {showCreate ? (
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="New collection name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              className="flex-1 min-w-0 rounded-lg py-2.5 px-3 text-[12px]"
              style={{
                background: 'white',
                border: '1px solid var(--t-navy)',
                color: 'var(--t-ink)',
                fontFamily: FONT.sans,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="px-3 py-2.5 rounded-lg text-[11px] font-semibold cursor-pointer"
              style={{
                background: newName.trim() ? TEXT.primary : INK['10'],
                color: newName.trim() ? 'white' : TEXT.secondary,
                border: 'none',
                fontFamily: FONT.sans,
              }}
            >
              Add
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl cursor-pointer transition-all hover:opacity-80"
            style={{
              background: 'none',
              border: '1.5px dashed var(--t-navy)',
              color: TEXT.secondary,
              fontFamily: FONT.sans,
              fontSize: 12,
            }}
          >
            <PerriandIcon name="add" size={12} color={TEXT.secondary} />
            New Collection
          </button>
        )}
      </div>
    </>
  );
}
