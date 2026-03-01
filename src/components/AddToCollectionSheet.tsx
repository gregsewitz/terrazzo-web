'use client';

import { useState, useMemo } from 'react';
import { useSavedStore } from '@/stores/savedStore';
import { ImportedPlace } from '@/types';
import { PerriandIcon, isPerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';

type CollectionSortKey = 'recent' | 'az' | 'most' | 'fewest';

const SORT_OPTIONS: { id: CollectionSortKey; label: string }[] = [
  { id: 'recent', label: 'Recent' },
  { id: 'az', label: 'A–Z' },
  { id: 'most', label: 'Most' },
  { id: 'fewest', label: 'Fewest' },
];

export default function AddToCollectionSheet({
  place,
  onClose,
}: {
  place: ImportedPlace;
  onClose: () => void;
}) {
  const collections = useSavedStore(s => s.collections);
  const addPlaceToCollection = useSavedStore(s => s.addPlaceToCollection);
  const removePlaceFromCollection = useSavedStore(s => s.removePlaceFromCollection);
  const createCollectionAsync = useSavedStore(s => s.createCollectionAsync);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [sortBy, setSortBy] = useState<CollectionSortKey>('recent');

  const sortedCollections = useMemo(() => {
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
        // newest first — already default store order, but reverse to be safe
        return items.sort((a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime()
        );
    }
  }, [collections, sortBy]);

  const toggleMembership = (collectionId: string, isIn: boolean) => {
    if (isIn) {
      removePlaceFromCollection(collectionId, place.id);
    } else {
      addPlaceToCollection(collectionId, place.id);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const realId = await createCollectionAsync(newName.trim(), 'pin');
      addPlaceToCollection(realId, place.id);
      setNewName('');
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ height: '100dvh' }}
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.3)' }} />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full rounded-t-2xl px-4 pt-4 flex flex-col"
        style={{ maxWidth: 480, maxHeight: '80dvh', background: 'var(--t-cream)', paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <span
            style={{ fontFamily: FONT.serif, fontSize: 16, fontStyle: 'italic', color: 'var(--t-ink)' }}
          >
            Add to Collection
          </span>
          <button
            onClick={onClose}
            style={{ color: INK['70'], background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <PerriandIcon name="close" size={16} color={INK['50']} />
          </button>
        </div>
        <div className="text-[11px] mb-3" style={{ color: INK['70'], fontFamily: FONT.sans }}>
          {place.name}
        </div>

        {/* Sort pills */}
        {collections.length > 2 && (
          <div className="flex items-center gap-1.5 mb-3 pb-3" style={{ borderBottom: `1px solid var(--t-linen)` }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 8, letterSpacing: 1.5, color: INK['40'], textTransform: 'uppercase', marginRight: 4 }}>
              Sort
            </span>
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setSortBy(opt.id)}
                className="px-2.5 py-1 rounded-full text-[10px] cursor-pointer transition-all"
                style={{
                  background: sortBy === opt.id ? 'var(--t-ink)' : 'transparent',
                  color: sortBy === opt.id ? 'white' : INK['70'],
                  border: sortBy === opt.id ? '1px solid var(--t-ink)' : `1px solid ${INK['12']}`,
                  fontFamily: FONT.sans,
                  fontWeight: sortBy === opt.id ? 600 : 400,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Collection list */}
        <div className="flex flex-col gap-1.5 mb-4 flex-1 min-h-0 overflow-y-auto">
          {sortedCollections.map(sl => {
            const isIn = sl.placeIds.includes(place.id);
            const isIcon = sl.emoji ? isPerriandIconName(sl.emoji) : false;

            return (
              <button
                key={sl.id}
                onClick={() => toggleMembership(sl.id, isIn)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all cursor-pointer w-full text-left"
                style={{
                  background: isIn ? 'rgba(42,122,86,0.04)' : 'white',
                  border: isIn ? '1.5px solid var(--t-verde)' : '1px solid var(--t-linen)',
                }}
              >
                {/* Emoji */}
                <span style={{ fontSize: isIcon ? 14 : 16, width: 20, textAlign: 'center' }}>
                  {isIcon ? (
                    <PerriandIcon name={sl.emoji as any} size={14} color="var(--t-ink)" />
                  ) : (
                    sl.emoji
                  )}
                </span>

                {/* Name + count */}
                <div className="flex-1 text-left">
                  <span className="text-[13px]" style={{ color: 'var(--t-ink)', fontFamily: FONT.sans }}>
                    {sl.name}
                  </span>
                  <span className="ml-2 text-[10px]" style={{ color: INK['70'], fontFamily: FONT.mono }}>
                    {sl.placeIds.length}
                  </span>
                </div>

                {/* Checkmark */}
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{
                    background: isIn ? 'var(--t-verde)' : INK['06'],
                  }}
                >
                  {isIn && (
                    <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>✓</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Create new collection inline */}
        <div className="flex-shrink-0">
        {showCreate ? (
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="New collection name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="flex-1 min-w-0 rounded-lg py-2.5 px-3 text-[12px]"
              style={{
                background: 'white',
                border: '1px solid var(--t-linen)',
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
                background: newName.trim() ? 'var(--t-ink)' : INK['10'],
                color: newName.trim() ? 'white' : INK['30'],
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
              border: `1.5px dashed ${INK['12']}`,
              color: INK['70'],
              fontFamily: FONT.sans,
              fontSize: 12,
            }}
          >
            <span style={{ fontSize: 13 }}>+</span>
            New Collection
          </button>
        )}
        </div>
      </div>
    </div>
  );
}
