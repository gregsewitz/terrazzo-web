'use client';

import React, { useState, useRef, useEffect } from 'react';
import { PerriandIcon, isPerriandIconName, type PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT } from '@/constants/theme';
import type { ActiveTab, CollectionOption } from '@/hooks/useEmailReservations';

// ─── Component ──────────────────────────────────────────────────────────────

interface ImportBottomBarProps {
  selectedCount: number;
  activeTab: ActiveTab;
  importing: boolean;
  onImport: () => void;
  onDismiss: () => void;
  // Collection support
  collections?: CollectionOption[];
  selectedCollectionId?: string | null;
  onSelectCollection?: (id: string | null) => void;
  onCreateCollection?: (name: string) => Promise<string | null>;
  creatingCollection?: boolean;
}

export const ImportBottomBar = React.memo(function ImportBottomBar({
  selectedCount,
  activeTab,
  importing,
  onImport,
  onDismiss,
  collections = [],
  selectedCollectionId = null,
  onSelectCollection,
  onCreateCollection,
  creatingCollection = false,
}: ImportBottomBarProps) {
  const hasSelection = selectedCount > 0;
  const label = activeTab === 'upcoming'
    ? `Import ${selectedCount} place${selectedCount !== 1 ? 's' : ''}`
    : `Save ${selectedCount} to library`;

  // Collection picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [newName, setNewName] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
        setCreateMode(false);
        setNewName('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [pickerOpen]);

  // Auto-focus create input
  useEffect(() => {
    if (createMode && inputRef.current) inputRef.current.focus();
  }, [createMode]);

  const selectedCollection = collections.find(c => c.id === selectedCollectionId);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || !onCreateCollection) return;
    const id = await onCreateCollection(name);
    if (id) {
      setCreateMode(false);
      setNewName('');
      setPickerOpen(false);
    }
  };

  const handleRemoveCollection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectCollection?.(null);
  };

  // Collection icon renderer — always uses PerriandIcon
  const renderIcon = (iconName: string, size: number, color: string) => {
    const name = isPerriandIconName(iconName) ? iconName : 'sparkle';
    return <PerriandIcon name={name as PerriandIconName} size={size} color={color} />;
  };

  return (
    <div
      className="sticky bottom-0 z-20 px-5 py-4"
      style={{
        background: 'linear-gradient(transparent, var(--t-cream) 20%)',
        pointerEvents: 'none',
      }}
    >
      <div style={{ pointerEvents: 'auto' }} className="flex flex-col gap-2">

        {/* ── Collection chip (above the import button) ── */}
        {hasSelection && !importing && (
          <div className="relative" ref={pickerRef}>
            {/* The chip */}
            {!selectedCollection ? (
              <button
                onClick={() => setPickerOpen(!pickerOpen)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-none cursor-pointer transition-all mx-auto"
                style={{
                  background: pickerOpen ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.06)',
                  color: TEXT.secondary,
                }}
              >
                <PerriandIcon name="discover" size={12} color={INK['40']} />
                <span className="text-[11px] font-medium" style={{ fontFamily: FONT.sans }}>
                  + Collection
                </span>
              </button>
            ) : (
              <button
                onClick={() => setPickerOpen(!pickerOpen)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-none cursor-pointer transition-all mx-auto"
                style={{
                  background: 'rgba(42,122,86,0.06)',
                  color: 'var(--t-verde)',
                }}
              >
                {renderIcon(selectedCollection.emoji, 12, 'var(--t-verde)')}
                <span className="text-[11px] font-semibold" style={{ fontFamily: FONT.sans }}>
                  {selectedCollection.name}
                </span>
                <span
                  onClick={handleRemoveCollection}
                  className="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(42,122,86,0.10)' }}
                >
                  <span className="text-[9px] leading-none" style={{ color: 'var(--t-verde)' }}>✕</span>
                </span>
              </button>
            )}

            {/* ── Dropdown picker ── */}
            {pickerOpen && (
              <div
                className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-[260px] rounded-xl overflow-hidden shadow-lg"
                style={{
                  background: 'white',
                  border: '1px solid var(--t-linen)',
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-3 pt-3 pb-2">
                  <span className="text-[11px] font-semibold" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>
                    Add to collection
                  </span>
                  {selectedCollectionId && (
                    <button
                      onClick={() => { onSelectCollection?.(null); setPickerOpen(false); }}
                      className="text-[10px] bg-transparent border-none cursor-pointer"
                      style={{ color: TEXT.secondary }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Collection list */}
                <div className="max-h-[200px] overflow-y-auto px-1.5 pb-1.5" style={{ scrollbarWidth: 'thin' }}>
                  {collections.map((col) => {
                    const isActive = col.id === selectedCollectionId;
                    return (
                      <button
                        key={col.id}
                        onClick={() => {
                          onSelectCollection?.(col.id);
                          setPickerOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left border-none cursor-pointer transition-all"
                        style={{
                          background: isActive ? 'rgba(42,122,86,0.06)' : 'transparent',
                        }}
                        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = INK['04']; }}
                        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                          style={{ background: isActive ? 'rgba(42,122,86,0.10)' : INK['06'] }}
                        >
                          {renderIcon(col.emoji, 12, isActive ? 'var(--t-verde)' : INK['50'])}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium truncate" style={{ color: TEXT.primary }}>
                            {col.name}
                          </div>
                          <div className="text-[9px]" style={{ color: TEXT.secondary }}>
                            {col.placeCount} place{col.placeCount !== 1 ? 's' : ''}
                          </div>
                        </div>
                        {isActive && (
                          <PerriandIcon name="check" size={12} color="var(--t-verde)" />
                        )}
                      </button>
                    );
                  })}

                  {collections.length === 0 && !createMode && (
                    <div className="px-2 py-3 text-center">
                      <span className="text-[10px]" style={{ color: TEXT.secondary }}>No collections yet</span>
                    </div>
                  )}
                </div>

                {/* Divider + Create new */}
                <div style={{ borderTop: `1px solid var(--t-linen)` }}>
                  {!createMode ? (
                    <button
                      onClick={() => setCreateMode(true)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 border-none cursor-pointer transition-all text-left"
                      style={{ background: 'transparent', color: TEXT.accent }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(238,113,109,0.04)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span className="text-[13px] leading-none">+</span>
                      <span className="text-[11px] font-semibold" style={{ fontFamily: FONT.sans }}>
                        New collection
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-2">
                      <input
                        ref={inputRef}
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); handleCreate(); }
                          if (e.key === 'Escape') { setCreateMode(false); setNewName(''); }
                        }}
                        placeholder="Collection name"
                        className="flex-1 text-[11px] bg-transparent outline-none"
                        style={{ color: TEXT.primary, fontFamily: FONT.sans }}
                        disabled={creatingCollection}
                      />
                      <button
                        onClick={handleCreate}
                        disabled={!newName.trim() || creatingCollection}
                        className="text-[10px] font-semibold px-2.5 py-1 rounded-md border-none cursor-pointer"
                        style={{
                          background: newName.trim() ? 'var(--t-honey)' : 'rgba(0,0,0,0.10)',
                          color: newName.trim() ? 'white' : TEXT.secondary,
                        }}
                      >
                        {creatingCollection ? '…' : 'Create'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Primary action */}
        <button
          onClick={onImport}
          disabled={!hasSelection || importing}
          className="w-full py-3.5 rounded-2xl border-none cursor-pointer text-[14px] font-semibold transition-all flex items-center justify-center gap-2"
          style={{
            background: hasSelection ? TEXT.primary : 'rgba(0,0,0,0.10)',
            color: hasSelection ? 'white' : TEXT.secondary,
            opacity: importing ? 0.7 : 1,
            fontFamily: FONT.sans,
          }}
        >
          {importing ? (
            <>
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Importing…
            </>
          ) : (
            <>
              {label}
              <PerriandIcon name="terrazzo" size={16} color={hasSelection ? 'white' : TEXT.secondary} />
            </>
          )}
        </button>

        {/* Secondary dismiss */}
        {hasSelection && !importing && (
          <button
            onClick={onDismiss}
            className="w-full py-2 bg-transparent border-none cursor-pointer text-[11px] font-medium"
            style={{ color: TEXT.secondary }}
          >
            Dismiss {selectedCount} instead
          </button>
        )}

        {!hasSelection && (
          <p className="text-center text-[10px] mt-0.5" style={{ color: TEXT.secondary }}>
            Select places to import them to your library
          </p>
        )}
      </div>
    </div>
  );
});

ImportBottomBar.displayName = 'ImportBottomBar';
