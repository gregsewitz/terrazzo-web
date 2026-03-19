'use client';

import { useState, useRef, useMemo, useCallback, memo, useEffect } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { DreamBoardEntry, DreamBoardEntryType } from '@/types';
import { PerriandIcon, type PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT } from '@/constants/theme';
import { SECTION_PRESETS, migrateEntryType } from '../dream-board/helpers';
import { DreamBoardCard } from '../dream-board/cards';
import { SectionHeader } from '../dream-board/SectionHeader';
import { SearchFilter } from '../dream-board/SearchFilter';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ───
interface DreamBoardProps {
  compact?: boolean;
}

interface SectionGroup {
  divider: DreamBoardEntry;
  entries: DreamBoardEntry[];
}

// ═══════════════════════════════════════════════════════════════
//  Dream Board — freeform-first, document-like
// ═══════════════════════════════════════════════════════════════

const DreamBoard = memo(function DreamBoard({ compact }: DreamBoardProps) {
  const trips = useTripStore(s => s.trips);
  const currentTripId = useTripStore(s => s.currentTripId);
  const trip = useMemo(() => trips.find(t => t.id === currentTripId), [trips, currentTripId]);

  // Store actions
  const addText = useTripStore(s => s.addDreamBoardText);
  const addChecklist = useTripStore(s => s.addDreamBoardChecklist);
  const addDivider = useTripStore(s => s.addDreamBoardDivider);
  const updateEntry = useTripStore(s => s.updateDreamBoardEntry);
  const removeEntry = useTripStore(s => s.removeDreamBoardEntry);
  const togglePin = useTripStore(s => s.toggleDreamBoardPin);

  // Migrate legacy entries on read
  const rawEntries: DreamBoardEntry[] = useMemo(() => {
    const raw = trip?.dreamBoard || trip?.scratchpad || [];
    return raw.map(e => ({
      ...e,
      type: migrateEntryType(e.type) as DreamBoardEntryType,
    }));
  }, [trip?.dreamBoard, trip?.scratchpad]);

  // ─── Input state ───
  const [inputValue, setInputValue] = useState('');
  const [isChecklistMode, setIsChecklistMode] = useState(false);
  const [checklistTitle, setChecklistTitle] = useState('');
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [checklistDraft, setChecklistDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const checklistInputRef = useRef<HTMLInputElement>(null);

  // ─── Search & filter state ───
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<DreamBoardEntryType | 'all'>('all');

  // ─── Section collapse state ───
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // ─── Section add UI ───
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  const [customSectionName, setCustomSectionName] = useState('');

  // ─── Auto-grow textarea ───
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [inputValue]);

  // ─── Group entries by section ───
  const { pinnedEntries, unsortedEntries, sections, entryCounts } = useMemo(() => {
    const dividers = rawEntries.filter(e => e.type === 'divider');
    const nonDividers = rawEntries.filter(e => e.type !== 'divider');

    const matchesSearch = (e: DreamBoardEntry) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        e.content.toLowerCase().includes(q) ||
        (e.title?.toLowerCase().includes(q) ?? false) ||
        (e.items?.some(i => i.text.toLowerCase().includes(q)) ?? false)
      );
    };

    const matchesFilter = (e: DreamBoardEntry) => {
      if (activeFilter === 'all') return true;
      return e.type === activeFilter;
    };

    const filtered = nonDividers.filter(e => matchesSearch(e) && matchesFilter(e));

    const pinned = filtered.filter(e => e.pinned);
    const unpinned = filtered.filter(e => !e.pinned);

    const unsorted = unpinned.filter(e => !e.section);
    const sectionGroups: SectionGroup[] = dividers.map(d => ({
      divider: d,
      entries: unpinned.filter(e => e.section === d.id),
    }));

    const sortByTime = (a: DreamBoardEntry, b: DreamBoardEntry) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

    pinned.sort(sortByTime);
    unsorted.sort(sortByTime);
    sectionGroups.forEach(s => s.entries.sort(sortByTime));

    const counts: Record<DreamBoardEntryType | 'all', number> = {
      all: nonDividers.length,
      text: nonDividers.filter(e => e.type === 'text').length,
      link: nonDividers.filter(e => e.type === 'link').length,
      checklist: nonDividers.filter(e => e.type === 'checklist').length,
      divider: 0,
    };

    return {
      pinnedEntries: pinned,
      unsortedEntries: unsorted,
      sections: sectionGroups,
      entryCounts: counts,
    };
  }, [rawEntries, searchQuery, activeFilter]);

  // ─── Handlers ───
  const handleSubmit = useCallback(() => {
    if (isChecklistMode) {
      if (!checklistTitle.trim() && checklistItems.length === 0) return;
      addChecklist(checklistTitle.trim() || 'Checklist', checklistItems);
      setChecklistTitle('');
      setChecklistItems([]);
      setChecklistDraft('');
      setIsChecklistMode(false);
      return;
    }

    const text = inputValue.trim();
    if (!text) return;
    addText(text);
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [inputValue, isChecklistMode, checklistTitle, checklistItems, addText, addChecklist]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleAddSection = useCallback((label: string) => {
    addDivider(label);
    setShowSectionPicker(false);
    setCustomSectionName('');
  }, [addDivider]);

  const toggleSectionCollapse = useCallback((sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }, []);

  const placeholders = [
    'Jot a thought, paste a link, drop a confirmation number...',
    'Notes, links, anything \u2014 just start typing...',
    'What are you thinking for this trip?',
  ];
  const [placeholderIdx] = useState(() => Math.floor(Math.random() * placeholders.length));

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div
        className="flex-shrink-0"
        style={{
          padding: compact ? '8px 12px' : '14px 20px',
          borderBottom: `1px solid ${INK['06']}`,
        }}
      >
        <h2
          className={compact ? 'text-[14px]' : 'text-[18px]'}
          style={{ fontFamily: FONT.serif, fontStyle: 'italic', color: TEXT.primary, margin: 0 }}
        >
          Dream Board
        </h2>
        {!compact && (
          <p className="text-[11px] mt-1" style={{ color: TEXT.secondary, fontFamily: FONT.sans, margin: 0 }}>
            The messy thinking that becomes a great trip.
          </p>
        )}
      </div>

      {/* ── Freeform input area ── */}
      <div
        className="flex-shrink-0"
        style={{
          padding: compact ? '10px 12px' : '14px 20px',
          borderBottom: `1px solid ${INK['06']}`,
        }}
      >
        {isChecklistMode ? (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={checklistTitle}
                onChange={e => setChecklistTitle(e.target.value)}
                placeholder="List title (optional)..."
                className="flex-1 text-[13px] bg-transparent border-none outline-none"
                style={{ fontFamily: FONT.sans, fontWeight: 500, color: TEXT.primary }}
                autoFocus
              />
              <button
                onClick={() => setIsChecklistMode(false)}
                className="text-[10px] px-2 py-1 rounded border-none cursor-pointer"
                style={{ background: INK['06'], color: TEXT.secondary, fontFamily: FONT.sans }}
              >
                Cancel
              </button>
            </div>

            {checklistItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 mb-1 pl-1">
                <span className="text-[11px]" style={{ color: INK['20'] }}>{'\u2610'}</span>
                <span className="text-[11px] flex-1" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>
                  {item}
                </span>
                <button
                  onClick={() => setChecklistItems(prev => prev.filter((_, j) => j !== i))}
                  className="w-4 h-4 flex items-center justify-center border-none cursor-pointer"
                  style={{ background: 'transparent' }}
                >
                  <PerriandIcon name="close" size={8} color={INK['20']} />
                </button>
              </div>
            ))}

            <div className="flex items-center gap-2 pl-1">
              <span className="text-[11px]" style={{ color: INK['15'] }}>+</span>
              <input
                ref={checklistInputRef}
                type="text"
                value={checklistDraft}
                onChange={e => setChecklistDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && checklistDraft.trim()) {
                    setChecklistItems(prev => [...prev, checklistDraft.trim()]);
                    setChecklistDraft('');
                  }
                }}
                placeholder="Add an item..."
                className="flex-1 text-[11px] bg-transparent border-none outline-none"
                style={{ fontFamily: FONT.sans, color: TEXT.secondary }}
              />
            </div>

            {(checklistTitle.trim() || checklistItems.length > 0) && (
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleSubmit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-none cursor-pointer"
                  style={{ background: 'var(--t-ink)', color: 'white', fontFamily: FONT.sans, fontSize: 11 }}
                >
                  <PerriandIcon name="add" size={10} color="white" />
                  Add list
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholders[placeholderIdx]}
              className="w-full text-[13px] bg-transparent border-none outline-none resize-none"
              style={{
                fontFamily: FONT.sans,
                color: TEXT.primary,
                lineHeight: 1.6,
                minHeight: 36,
                maxHeight: 200,
              }}
              rows={1}
            />

            <div className="flex items-center justify-between mt-1.5">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsChecklistMode(true)}
                  className="flex items-center gap-1 px-2 py-1 rounded border cursor-pointer transition-colors"
                  style={{
                    background: 'transparent',
                    borderColor: INK['10'],
                    color: TEXT.secondary,
                    fontFamily: FONT.sans,
                    fontSize: 10,
                  }}
                  title="Create a checklist"
                >
                  <PerriandIcon name="check" size={10} color={INK['30']} />
                  List
                </button>

                <button
                  onClick={() => setShowSectionPicker(!showSectionPicker)}
                  className="flex items-center gap-1 px-2 py-1 rounded border cursor-pointer transition-colors"
                  style={{
                    background: showSectionPicker ? INK['08'] : 'transparent',
                    borderColor: INK['10'],
                    color: TEXT.secondary,
                    fontFamily: FONT.sans,
                    fontSize: 10,
                  }}
                  title="Add a section"
                >
                  <PerriandIcon name="add" size={10} color={INK['30']} />
                  Section
                </button>
              </div>

              <AnimatePresence>
                {inputValue.trim() && (
                  <motion.button
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    onClick={handleSubmit}
                    className="flex items-center justify-center flex-shrink-0 cursor-pointer"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'var(--t-ink)',
                      border: 'none',
                    }}
                  >
                    <PerriandIcon name="add" size={14} color="white" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {inputValue.length > 20 && (
              <p className="text-[9px] mt-1" style={{ color: TEXT.secondary, fontFamily: FONT.mono, margin: 0 }}>
                Shift+Enter for new line
              </p>
            )}
          </div>
        )}

        {/* Section picker */}
        <AnimatePresence>
          {showSectionPicker && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div
                className="mt-2 pt-2 flex flex-col gap-1"
                style={{ borderTop: `1px solid ${INK['06']}` }}
              >
                <p className="text-[10px] mb-1" style={{ color: TEXT.secondary, fontFamily: FONT.mono, margin: 0 }}>
                  Add a section
                </p>
                <div className="flex flex-wrap gap-1">
                  {SECTION_PRESETS.map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => handleAddSection(preset.label)}
                      className="flex items-center gap-1 px-2 py-1 rounded-full border cursor-pointer transition-colors"
                      style={{
                        background: 'transparent',
                        borderColor: INK['10'],
                        color: TEXT.secondary,
                        fontFamily: FONT.sans,
                        fontSize: 10,
                      }}
                    >
                      <PerriandIcon name={preset.icon as PerriandIconName} size={10} color={INK['30']} />
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={customSectionName}
                    onChange={e => setCustomSectionName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && customSectionName.trim()) {
                        handleAddSection(customSectionName.trim());
                      }
                    }}
                    placeholder="Or type a custom name..."
                    className="flex-1 text-[11px] bg-transparent border-none outline-none"
                    style={{ fontFamily: FONT.sans, color: TEXT.secondary }}
                  />
                  {customSectionName.trim() && (
                    <button
                      onClick={() => handleAddSection(customSectionName.trim())}
                      className="text-[10px] px-2 py-1 rounded border-none cursor-pointer"
                      style={{ background: 'var(--t-ink)', color: 'white', fontFamily: FONT.sans }}
                    >
                      Add
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Search & filter (show when > 3 entries) ── */}
      {rawEntries.filter(e => e.type !== 'divider').length > 3 && (
        <div
          className="flex-shrink-0"
          style={{ padding: compact ? '8px 12px' : '10px 20px' }}
        >
          <SearchFilter
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            entryCounts={entryCounts}
          />
        </div>
      )}

      {/* ── Entries — flowing document layout ── */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ padding: compact ? '8px 12px' : '12px 20px', scrollbarWidth: 'thin' }}
      >
        {rawEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mb-4"
              style={{ background: INK['04'] }}
            >
              <PerriandIcon name="edit" size={18} color={INK['20']} />
            </div>
            <p
              className="text-[13px] text-center leading-relaxed"
              style={{ color: TEXT.secondary, fontFamily: FONT.sans, maxWidth: 220 }}
            >
              Drop links, jot down notes, save confirmation numbers — this is your messy thinking space.
            </p>
            <p className="text-[10px] mt-3 text-center" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
              Just start typing above
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Pinned entries */}
            {pinnedEntries.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <PerriandIcon name="pin" size={10} color={INK['30']} />
                  <span className="text-[10px]" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
                    Pinned
                  </span>
                </div>
                <AnimatePresence mode="popLayout">
                  {pinnedEntries.map(entry => (
                    <DreamBoardCard
                      key={entry.id}
                      entry={entry}
                      compact={compact}
                      onUpdate={updateEntry}
                      onRemove={removeEntry}
                      onTogglePin={togglePin}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Unsorted entries */}
            {unsortedEntries.length > 0 && (
              <div className="mb-2">
                <AnimatePresence mode="popLayout">
                  {unsortedEntries.map(entry => (
                    <DreamBoardCard
                      key={entry.id}
                      entry={entry}
                      compact={compact}
                      onUpdate={updateEntry}
                      onRemove={removeEntry}
                      onTogglePin={togglePin}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Sections */}
            {sections.map(({ divider, entries }) => {
              const isCollapsed = collapsedSections.has(divider.id);
              return (
                <div key={divider.id} className="mb-3">
                  <SectionHeader
                    id={divider.id}
                    label={divider.title || 'Untitled'}
                    entryCount={entries.length}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={() => toggleSectionCollapse(divider.id)}
                    onRename={(newLabel) => updateEntry(divider.id, { title: newLabel })}
                    onRemove={() => removeEntry(divider.id)}
                  />
                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        {entries.length === 0 ? (
                          <p
                            className="text-[11px] py-4 pl-4"
                            style={{ color: TEXT.secondary, fontFamily: FONT.sans, fontStyle: 'italic' }}
                          >
                            Nothing here yet.
                          </p>
                        ) : (
                          <AnimatePresence mode="popLayout">
                            {entries.map(entry => (
                              <DreamBoardCard
                                key={entry.id}
                                entry={entry}
                                compact={compact}
                                onUpdate={updateEntry}
                                onRemove={removeEntry}
                                onTogglePin={togglePin}
                              />
                            ))}
                          </AnimatePresence>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      {rawEntries.filter(e => e.type !== 'divider').length > 0 && (
        <div
          className="flex-shrink-0 flex items-center justify-between"
          style={{
            padding: compact ? '6px 12px' : '8px 20px',
            borderTop: `1px solid ${INK['06']}`,
          }}
        >
          <span className="text-[10px]" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
            {rawEntries.filter(e => e.type !== 'divider').length} item
            {rawEntries.filter(e => e.type !== 'divider').length !== 1 ? 's' : ''}
            {pinnedEntries.length > 0 && ` \u00b7 ${pinnedEntries.length} pinned`}
          </span>
        </div>
      )}
    </div>
  );
});

DreamBoard.displayName = 'DreamBoard';
export default DreamBoard;
