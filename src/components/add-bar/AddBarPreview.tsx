'use client';

import { useState, useMemo } from 'react';
import { FONT, INK, TEXT } from '@/constants/theme';
import { PerriandIcon, isPerriandIconName } from '@/components/icons/PerriandIcons';
import { TYPE_COLORS } from './AddBarShared';
import SortPills from '@/components/ui/SortPills';
import type { ImportedPlace, Collection, PerriandIconName } from '@/types';
import type { AddBarState } from '@/stores/addBarStore';

// ─── Sort logic for imported places ─────────────────────────────────────────────

type PreviewSortKey = 'default' | 'az' | 'type';

const PREVIEW_SORT_OPTIONS: { id: PreviewSortKey; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'az', label: 'A–Z' },
  { id: 'type', label: 'Type' },
];

type TripContext = NonNullable<AddBarState['tripContext']>;

// ─── Category config for grouping ──────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { icon: PerriandIconName; label: string }> = {
  hotel:        { icon: 'hotel',        label: 'Hotels' },
  restaurant:   { icon: 'restaurant',   label: 'Restaurants' },
  bar:          { icon: 'bar',          label: 'Bars' },
  cafe:         { icon: 'cafe',         label: 'Cafés' },
  museum:       { icon: 'museum',       label: 'Sights & museums' },
  activity:     { icon: 'activity',     label: 'Activities' },
  neighborhood: { icon: 'neighborhood', label: 'Neighborhoods' },
  shop:         { icon: 'shop',         label: 'Shops' },
};

// ─── Props ──────────────────────────────────────────────────────────────────────

interface AddBarPreviewProps {
  importResults: ImportedPlace[];
  selectedIds: Set<string>;
  collections: Collection[];
  tripContext: TripContext | null;
  isEnriching?: boolean;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSaveSelected: (collectionIds: string[]) => void;
  onCreateCollection?: (name: string, emoji?: string) => Promise<string>;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function AddBarPreview({
  importResults,
  selectedIds,
  collections,
  tripContext,
  isEnriching = false,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onSaveSelected,
  onCreateCollection,
}: AddBarPreviewProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [showCollections, setShowCollections] = useState(false);
  const [sortBy, setSortBy] = useState<PreviewSortKey>('default');
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  // Group results by type, sorted by count (largest group first)
  const groupedResults = useMemo(() => {
    // When sort is 'az', show flat list instead of groups
    if (sortBy === 'az') {
      const sorted = [...importResults].sort((a, b) => a.name.localeCompare(b.name));
      return [['all', sorted] as [string, ImportedPlace[]]];
    }
    const groups: Record<string, ImportedPlace[]> = {};
    importResults.forEach(item => {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
    });
    // Sort items within each group A-Z when type sort is active
    if (sortBy === 'type') {
      for (const key of Object.keys(groups)) {
        groups[key].sort((a, b) => a.name.localeCompare(b.name));
      }
      return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    }
    return Object.entries(groups).sort(([, a], [, b]) => b.length - a.length);
  }, [importResults, sortBy]);

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim() || !onCreateCollection) return;
    const newId = await onCreateCollection(newCollectionName.trim(), 'pin');
    setCollectionIds(prev => [...prev, newId]);
    setNewCollectionName('');
    setShowCreateCollection(false);
  };

  if (importResults.length === 0) return null;

  const MAX_VISIBLE = 4;
  const selectedCount = selectedIds.size;
  const allSelected = selectedCount === importResults.length;

  return (
    <>
      {/* ── Header ── */}
      <div className="mt-1 mb-1">
        <h2
          className="text-xl"
          style={{ fontFamily: FONT.serif, fontStyle: 'italic', color: TEXT.primary, margin: 0 }}
        >
          Found {importResults.length} place{importResults.length === 1 ? '' : 's'}
        </h2>
        <p className="mt-0.5" style={{ fontFamily: FONT.sans, fontSize: 11, color: TEXT.secondary, margin: '2px 0 0' }}>
          Tap to deselect any you don&rsquo;t want
        </p>
      </div>

      {/* ── Bulk select controls ── */}
      <div className="flex items-center justify-between mt-3 mb-3">
        <span style={{ fontFamily: FONT.mono, fontSize: 10, color: TEXT.secondary }}>
          {selectedCount} of {importResults.length} selected
        </span>
        <div className="flex gap-2">
          <button
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="bg-transparent border-none cursor-pointer"
            style={{ fontFamily: FONT.sans, fontSize: 11, fontWeight: 600, color: 'var(--t-verde)' }}
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>
      </div>

      {/* ── Sort pills ── */}
      <SortPills
        options={PREVIEW_SORT_OPTIONS}
        value={sortBy}
        onChange={setSortBy}
        itemCount={importResults.length}
      />

      {/* ── Category groups ── */}
      <div className="flex flex-col gap-3">
        {groupedResults.map(([type, items]) => {
          const isAllGroup = type === 'all';
          const config = isAllGroup
            ? { icon: 'discover' as PerriandIconName, label: 'All places' }
            : (CATEGORY_CONFIG[type] || { icon: 'activity' as PerriandIconName, label: type });
          const isExpanded = expandedCategory === type;
          const selectedInGroup = items.filter(i => selectedIds.has(i.id)).length;
          const typeColor = isAllGroup ? INK['40'] : (TYPE_COLORS[type] || INK['40']);

          return (
            <div key={type}>
              {/* Category header */}
              {!isAllGroup && (
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <PerriandIcon name={config.icon} size={16} color={TEXT.primary} />
                  <span style={{ fontFamily: FONT.sans, fontSize: 13, fontWeight: 600, color: TEXT.primary }}>
                    {config.label}
                  </span>
                  <span style={{ fontFamily: FONT.mono, fontSize: 10, color: TEXT.secondary }}>
                    {items.length}
                  </span>
                </div>
                <span style={{ fontFamily: FONT.mono, fontSize: 10, fontWeight: 600, color: 'var(--t-verde)' }}>
                  {selectedInGroup === items.length ? 'All selected' : `${selectedInGroup}/${items.length}`}
                </span>
              </div>
              )}

              {/* Place cards */}
              <div className="rounded-xl overflow-hidden" style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
                {items.slice(0, isExpanded ? items.length : MAX_VISIBLE).map((item, idx, visibleItems) => {
                  const isSelected = selectedIds.has(item.id);
                  const isAlreadyInLibrary = (item as any).alreadyInLibrary;
                  const isLowConfidence = item.enrichment?.confidence != null && item.enrichment.confidence < 0.5;
                  const itemColor = isAllGroup ? (TYPE_COLORS[item.type] || INK['40']) : typeColor;

                  return (
                    <div
                      key={item.id}
                      onClick={() => onToggleSelect(item.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleSelect(item.id); } }}
                      className="flex items-center gap-2.5 px-3 cursor-pointer transition-all"
                      style={{
                        padding: '10px 12px',
                        borderBottom: idx < visibleItems.length - 1 ? '1px solid var(--t-linen)' : 'none',
                        opacity: isSelected ? 1 : 0.45,
                        transition: 'opacity 150ms ease',
                      }}
                    >
                      {/* Checkbox */}
                      <div
                        className="w-[18px] h-[18px] rounded flex items-center justify-center flex-shrink-0"
                        style={{
                          background: isSelected ? itemColor : 'white',
                          border: isSelected ? 'none' : `1.5px solid var(--t-linen)`,
                          transition: 'all 150ms ease',
                        }}
                      >
                        {isSelected && <PerriandIcon name="check" size={11} color="white" />}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p style={{
                            fontFamily: FONT.sans,
                            fontSize: 13,
                            fontWeight: 600,
                            color: TEXT.primary,
                            margin: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {item.name}
                          </p>
                          {isAlreadyInLibrary && (
                            <span style={{
                              fontFamily: FONT.mono, fontSize: 8, fontWeight: 700,
                              color: 'var(--t-verde)', background: 'rgba(42,122,86,0.08)',
                              padding: '1px 5px', borderRadius: 4, flexShrink: 0,
                            }}>
                              IN LIBRARY
                            </span>
                          )}
                          {/* Low-confidence places are silently re-resolved on save — no badge shown */}
                        </div>
                        <p style={{
                          fontFamily: FONT.mono,
                          fontSize: 9,
                          color: TEXT.secondary,
                          margin: '1px 0 0',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {item.location || item.type}
                          {item.matchScore > 0 && ` · ${item.matchScore}%`}
                        </p>
                        {item.tasteNote && (
                          <p style={{
                            fontFamily: FONT.sans,
                            fontSize: 11,
                            fontStyle: 'italic',
                            color: TEXT.secondary,
                            margin: '2px 0 0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            &ldquo;{item.tasteNote}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Show more */}
                {items.length > MAX_VISIBLE && !isExpanded && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandedCategory(type); }}
                    className="w-full py-2 text-center cursor-pointer bg-transparent border-none"
                    style={{ fontFamily: FONT.sans, fontSize: 11, fontWeight: 600, color: '#8a6a2a' }}
                  >
                    + {items.length - MAX_VISIBLE} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Collection quick-assign (expandable) ── */}
      {(collections.length > 0 || onCreateCollection) && (
        <div className="mt-4">
          <button
            onClick={() => setShowCollections(!showCollections)}
            className="flex items-center gap-2 bg-transparent border-none cursor-pointer w-full text-left"
            style={{ padding: 0 }}
          >
            <PerriandIcon name="bookmark" size={14} color={TEXT.secondary} />
            <span style={{
              fontFamily: FONT.mono, fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em', color: TEXT.secondary,
            }}>
              Add to collections
            </span>
            <span style={{
              fontFamily: FONT.sans, fontSize: 10, color: TEXT.secondary,
              marginLeft: 'auto',
            }}>
              {collectionIds.length > 0 ? `${collectionIds.length} selected` : 'Optional'}
            </span>
            <svg
              width="10" height="10" viewBox="0 0 10 10" fill="none"
              style={{ transform: showCollections ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 150ms ease' }}
            >
              <path d="M2 4L5 7L8 4" stroke={TEXT.secondary} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {showCollections && (
            <div className="mt-2 p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.02)' }}>
              <div className="flex flex-wrap gap-1.5">
                {collections.map(sl => {
                  const isSelected = collectionIds.includes(sl.id);
                  return (
                    <button
                      key={sl.id}
                      onClick={() => setCollectionIds(prev =>
                        isSelected ? prev.filter(id => id !== sl.id) : [...prev, sl.id]
                      )}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all"
                      style={{
                        background: isSelected ? 'rgba(42,122,86,0.08)' : 'white',
                        border: isSelected ? '1px solid var(--t-verde)' : '1px solid var(--t-linen)',
                        fontSize: 12,
                        fontFamily: FONT.sans,
                        color: isSelected ? 'var(--t-verde)' : TEXT.primary,
                      }}
                    >
                      <span style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center' }}>
                        {sl.emoji && isPerriandIconName(sl.emoji)
                          ? <PerriandIcon name={sl.emoji} size={13} color={isSelected ? 'var(--t-verde)' : INK['50']} />
                          : sl.emoji || '📌'}
                      </span>
                      {sl.name}
                    </button>
                  );
                })}
                {/* + New Collection chip */}
                {onCreateCollection && !showCreateCollection && (
                  <button
                    onClick={() => setShowCreateCollection(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all"
                    style={{
                      background: 'transparent',
                      border: '1.5px dashed rgba(0,0,0,0.12)',
                      fontSize: 12,
                      fontFamily: FONT.sans,
                      color: TEXT.secondary,
                    }}
                  >
                    <PerriandIcon name="add" size={10} color={TEXT.secondary} />
                    New
                  </button>
                )}
              </div>
              {/* Inline create collection */}
              {onCreateCollection && showCreateCollection && (
                <div className="flex gap-2 items-center mt-2">
                  <input
                    type="text"
                    placeholder="Collection name…"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCollection(); }}
                    className="flex-1 min-w-0 rounded-lg py-2 px-2.5 text-[11px]"
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
                    onClick={handleCreateCollection}
                    disabled={!newCollectionName.trim()}
                    className="px-2.5 py-2 rounded-lg text-[10px] font-semibold cursor-pointer"
                    style={{
                      background: newCollectionName.trim() ? TEXT.primary : 'rgba(0,0,0,0.10)',
                      color: newCollectionName.trim() ? 'white' : 'rgba(0,0,0,0.30)',
                      border: 'none',
                      fontFamily: FONT.sans,
                    }}
                  >
                    Add
                  </button>
                </div>
              )}
              <p style={{ fontFamily: FONT.sans, fontSize: 10, color: TEXT.secondary, margin: '6px 0 0' }}>
                Applies to all selected places
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Enrichment hint ── */}
      {isEnriching && (
        <div
          className="flex items-center justify-center gap-2 mt-4 mb-1"
          style={{ fontFamily: FONT.sans, fontSize: 11, color: TEXT.secondary }}
        >
          <span
            className="inline-block w-3 h-3 rounded-full border-2"
            style={{
              borderColor: INK['30'],
              borderTopColor: 'transparent',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          Enriching photos &amp; details — saving now will back-fill automatically
        </div>
      )}

      {/* ── Save CTA ── */}
      <button
        onClick={() => onSaveSelected(collectionIds)}
        disabled={selectedCount === 0}
        className="w-full mt-3 py-3.5 rounded-2xl border-none cursor-pointer transition-all flex items-center justify-center gap-2"
        style={{
          background: selectedCount > 0 ? TEXT.primary : 'rgba(0,0,0,0.10)',
          color: selectedCount > 0 ? 'white' : TEXT.secondary,
          fontFamily: FONT.sans,
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Save {selectedCount} place{selectedCount === 1 ? '' : 's'}
        {tripContext && ' to Trip'}
        {collectionIds.length > 0 && ` + ${collectionIds.length} collection${collectionIds.length > 1 ? 's' : ''}`}
        <PerriandIcon name="terrazzo" size={16} color={selectedCount > 0 ? 'white' : TEXT.secondary} />
      </button>
    </>
  );
}
