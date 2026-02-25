'use client';

import React, { useState } from 'react';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import { ImportedPlace, PerriandIconName } from '@/types';

// Category config for grouping imported results
const CATEGORY_CONFIG: Record<string, { icon: PerriandIconName; label: string }> = {
  restaurant: { icon: 'restaurant', label: 'Restaurants & bars' },
  hotel: { icon: 'hotel', label: 'Hotels' },
  bar: { icon: 'bar', label: 'Bars' },
  cafe: { icon: 'cafe', label: 'Coffee & sweet' },
  museum: { icon: 'museum', label: 'Sights & museums' },
  activity: { icon: 'activity', label: 'Activities' },
  neighborhood: { icon: 'neighborhood', label: 'Neighborhoods' },
  shop: { icon: 'shop', label: 'Shops' },
};

interface ImportResultsStepProps {
  importResults: ImportedPlace[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onConfirm: () => void;
  onImportMore: () => void;
  sourceName: string;
  detectedDestination: string;
  isDesktop: boolean;
}

export const ImportResultsStep = React.memo(function ImportResultsStep({
  importResults,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onConfirm,
  onImportMore,
  sourceName,
  detectedDestination,
  isDesktop,
}: ImportResultsStepProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Group results by category
  const groupedResults = React.useMemo(() => {
    const groups: Record<string, ImportedPlace[]> = {};
    importResults.forEach(item => {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
    });
    return Object.entries(groups).sort(([, a], [, b]) => b.length - a.length);
  }, [importResults]);

  return (
    <>
      <div className="mt-1 mb-1">
        <h2 className="text-xl italic" style={{ fontFamily: FONT.serif, color: 'var(--t-ink)' }}>
          Found {importResults.length} places
        </h2>
        <p className="text-[10px] mt-0.5" style={{ color: INK['95'] }}>
          {sourceName ? `From "${sourceName}"` : 'From pasted content'}
          {detectedDestination ? ` · ${detectedDestination}` : ''}
        </p>
      </div>

      {sourceName && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg mb-4 mt-2" style={{ background: 'rgba(199,82,51,0.06)' }}>
          <PerriandIcon name="article" size={12} color="#c75233" />
          <span className="text-[10px] font-semibold" style={{ color: '#c75233' }}>
            {sourceName}
          </span>
        </div>
      )}

      {/* Bulk select controls */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px]" style={{ color: INK['95'] }}>
          {selectedIds.size} of {importResults.length} selected
        </span>
        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            className="text-[10px] font-semibold bg-transparent border-none cursor-pointer"
            style={{ color: 'var(--t-verde)' }}
          >
            Select all
          </button>
          <button onClick={onDeselectAll} className="text-[10px] font-semibold bg-transparent border-none cursor-pointer" style={{ color: INK['90'] }}>
            Clear
          </button>
        </div>
      </div>

      {/* Category groups */}
      <div className="flex flex-col gap-3 mt-1">
        {groupedResults.map(([type, items]) => {
          const config = CATEGORY_CONFIG[type] || { icon: 'activity' as PerriandIconName, label: type };
          const isExpanded = expandedCategory === type;
          const selectedInGroup = items.filter(i => selectedIds.has(i.id)).length;
          const MAX_VISIBLE = 4;

          return (
            <div key={type}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <PerriandIcon name={config.icon} size={18} color="var(--t-ink)" />
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--t-ink)' }}>
                    {config.label}
                  </span>
                  <span className="text-[10px]" style={{ color: INK['90'] }}>
                    {items.length}
                  </span>
                </div>
                <span className="text-[10px] font-semibold" style={{ color: 'var(--t-verde)' }}>
                  {selectedInGroup === items.length ? 'All selected' : `${selectedInGroup}/${items.length}`}
                </span>
              </div>

              <div className="rounded-xl overflow-hidden" style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
                {items.slice(0, isExpanded ? items.length : MAX_VISIBLE).map((item, idx) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => onToggleSelect(item.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleSelect(item.id); } }}
                      className="flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-all"
                      style={{
                        borderBottom:
                          idx < (isExpanded ? items.length : Math.min(items.length, MAX_VISIBLE)) - 1
                            ? '1px solid var(--t-linen)'
                            : 'none',
                      }}
                    >
                      <div
                        className="w-[18px] h-[18px] rounded flex items-center justify-center flex-shrink-0"
                        style={{
                          background: isSelected ? 'var(--t-verde)' : 'white',
                          border: isSelected ? 'none' : '1.5px solid var(--t-linen)',
                        }}
                      >
                        {isSelected && <PerriandIcon name="check" size={12} color="white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold" style={{ color: 'var(--t-ink)' }}>
                          {item.name}
                        </div>
                        {item.tasteNote && (
                          <div className="text-[10px] truncate" style={{ color: INK['95'] }}>
                            &ldquo;{item.tasteNote}&rdquo;
                          </div>
                        )}
                      </div>
                      {item.matchScore > 0 && (
                        <span
                          className="text-[9px] font-semibold px-2 py-0.5 rounded-md flex-shrink-0"
                          style={{ background: 'rgba(200,146,58,0.1)', color: '#8a6a2a', fontFamily: FONT.mono }}
                        >
                          {item.matchScore}%
                        </span>
                      )}
                    </div>
                  );
                })}

                {items.length > MAX_VISIBLE && !isExpanded && (
                  <button
                    onClick={() => setExpandedCategory(type)}
                    className="w-full py-2 text-center text-[10px] font-semibold cursor-pointer bg-transparent border-none"
                    style={{ color: '#8a6a2a' }}
                  >
                    + {items.length - MAX_VISIBLE} more {config.label.toLowerCase()}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm button */}
      <button
        onClick={onConfirm}
        disabled={selectedIds.size === 0}
        className="w-full mt-6 py-3.5 rounded-2xl border-none cursor-pointer text-[14px] font-semibold transition-all flex items-center justify-center gap-2"
        style={{
          background: selectedIds.size > 0 ? 'var(--t-ink)' : INK['10'],
          color: selectedIds.size > 0 ? 'white' : INK['90'],
        }}
      >
        Save {selectedIds.size} places
        <PerriandIcon name="terrazzo" size={16} color={selectedIds.size > 0 ? 'white' : INK['90']} />
      </button>
      <p className="text-center text-[10px] mt-1.5 mb-2" style={{ color: INK['90'] }}>
        Deselect any you don&apos;t want
        {detectedDestination ? ` · All go to ${detectedDestination}` : ''}
      </p>

      <button onClick={onImportMore} className="w-full mt-1 py-2 bg-transparent border-none cursor-pointer text-[11px]" style={{ color: INK['95'] }}>
        ← Import more
      </button>
    </>
  );
});

ImportResultsStep.displayName = 'ImportResultsStep';
