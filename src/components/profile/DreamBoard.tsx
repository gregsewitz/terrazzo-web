'use client';

import { useState, useRef, useMemo, useCallback, memo } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { DreamBoardEntry, DreamBoardEntryType } from '@/types';
import { PerriandIcon, type PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT } from '@/constants/theme';
import { VIBE_COLORS, getVibeBg, isUrl, extractDomain } from '../dream-board/helpers';
import { DreamBoardCard } from '../dream-board/cards';

// ─── Entry type config ───
const ENTRY_TYPES: { type: DreamBoardEntryType; label: string; icon: PerriandIconName; placeholder: string }[] = [
  { type: 'note', label: 'Note', icon: 'edit', placeholder: 'Jot something down...' },
  { type: 'link', label: 'Link', icon: 'article', placeholder: 'Paste a URL...' },
  { type: 'checklist', label: 'Checklist', icon: 'check', placeholder: 'Checklist title...' },
  { type: 'question', label: 'Question', icon: 'discover', placeholder: 'Something to figure out...' },
  { type: 'vibe', label: 'Vibe', icon: 'sparkle', placeholder: 'Set the tone...' },
];

interface DreamBoardProps {
  compact?: boolean; // true for desktop right-panel mode (narrower)
}

const DreamBoard = memo(function DreamBoard({ compact }: DreamBoardProps) {
  const trips = useTripStore(s => s.trips);
  const currentTripId = useTripStore(s => s.currentTripId);
  const trip = useMemo(() => trips.find(t => t.id === currentTripId), [trips, currentTripId]);
  const addEntry = useTripStore(s => s.addDreamBoardEntry);
  const updateEntry = useTripStore(s => s.updateDreamBoardEntry);
  const removeEntry = useTripStore(s => s.removeDreamBoardEntry);
  const togglePin = useTripStore(s => s.toggleDreamBoardPin);

  const entries = trip?.dreamBoard || trip?.scratchpad || [];

  // Sort: pinned first, then vibes (always near top), then by creation date (newest first)
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      // Vibes float up (after pinned items) as they set the tone
      if (a.type === 'vibe' && b.type !== 'vibe') return -1;
      if (a.type !== 'vibe' && b.type === 'vibe') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [entries]);

  // ─── Input state ───
  const [inputType, setInputType] = useState<DreamBoardEntryType>('note');
  const [inputValue, setInputValue] = useState('');
  const [vibeColor, setVibeColor] = useState<string>('honey');
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [checklistDraft, setChecklistDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const checklistInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = useCallback(() => {
    const text = inputValue.trim();

    // Auto-detect links
    const type = isUrl(text) ? 'link' : inputType;

    if (type === 'checklist') {
      // For checklists, the input is the title, and checklistItems are the items
      if (!text && checklistItems.length === 0) return;
      addEntry({
        type: 'checklist',
        content: '',
        title: text || 'Checklist',
        items: checklistItems.map(t => ({ text: t, done: false })),
      });
      setChecklistItems([]);
      setChecklistDraft('');
    } else if (!text) {
      return;
    } else if (type === 'link') {
      addEntry({ type: 'link', content: text, title: extractDomain(text) });
    } else if (type === 'question') {
      addEntry({ type: 'question', content: text, resolved: false });
    } else if (type === 'vibe') {
      addEntry({ type: 'vibe', content: text, color: vibeColor });
    } else {
      addEntry({ type: 'note', content: text });
    }

    setInputValue('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [inputValue, inputType, vibeColor, checklistItems, addEntry]);

  return (
    <div className="flex flex-col h-full">
      {/* Header — always visible */}
      <div
        className="flex-shrink-0"
        style={{
          padding: compact ? '6px 10px' : '10px 16px',
          borderBottom: '1px solid var(--t-linen)',
        }}
      >
        <h2
          className={compact ? 'text-[13px]' : 'text-base'}
          style={{ fontFamily: FONT.serif, fontStyle: 'italic', color: 'var(--t-ink)', margin: 0 }}
        >
          Dream Board
        </h2>
        {!compact && (
          <p className="text-[11px]" style={{ color: TEXT.secondary, fontFamily: FONT.sans, margin: 0, marginTop: 2 }}>
            Notes, questions, vibes, links — the messy thinking that becomes a great trip.
          </p>
        )}
      </div>

      {/* Input area — always-visible type tabs + adaptive input */}
      <div
        className="flex-shrink-0"
        style={{
          padding: compact ? '8px 10px' : '12px 16px',
          borderBottom: '1px solid var(--t-linen)',
        }}
      >
        {/* Type pill row — always visible */}
        <div className="flex items-center gap-1 mb-2" style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
          {ENTRY_TYPES.map(t => {
            const isActive = inputType === t.type;
            return (
              <button
                key={t.type}
                onClick={() => {
                  setInputType(t.type);
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border cursor-pointer transition-all flex-shrink-0"
                style={{
                  background: isActive ? 'var(--t-ink)' : 'transparent',
                  color: isActive ? 'white' : TEXT.secondary,
                  borderColor: isActive ? 'var(--t-ink)' : 'var(--t-linen)',
                  fontFamily: FONT.sans, fontSize: 11, fontWeight: 500,
                }}
              >
                <PerriandIcon name={t.icon} size={11} color={isActive ? 'white' : TEXT.secondary} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Type-specific hint */}
        <p
          className="text-[10px] mb-1.5"
          style={{ color: TEXT.secondary, fontFamily: FONT.sans, margin: 0, marginBottom: 6 }}
        >
          {inputType === 'note' && 'Freeform — jot anything down.'}
          {inputType === 'link' && 'Paste a URL to save for later.'}
          {inputType === 'checklist' && 'A to-do list for this trip.'}
          {inputType === 'question' && 'Something to research — AI will help answer during planning.'}
          {inputType === 'vibe' && 'Set the mood — influences AI recommendations for this trip.'}
        </p>

        {/* Main input row */}
        <div className="flex items-center gap-2">
          {/* Question prefix indicator */}
          {inputType === 'question' && (
            <span
              className="flex-shrink-0 text-[16px] font-semibold"
              style={{ color: TEXT.secondary, fontFamily: FONT.serif }}
            >?</span>
          )}

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder={ENTRY_TYPES.find(t => t.type === inputType)?.placeholder || 'Add something...'}
            className="flex-1 text-[13px] bg-transparent border-none outline-none"
            style={{
              fontFamily: inputType === 'vibe' ? FONT.serif : FONT.sans,
              fontStyle: inputType === 'vibe' ? 'italic' : 'normal',
              color: 'var(--t-ink)',
            }}
          />

          {/* Add button */}
          {(inputValue.trim() || (inputType === 'checklist' && checklistItems.length > 0)) && (
            <button
              onClick={handleAdd}
              className="flex items-center justify-center flex-shrink-0 cursor-pointer"
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--t-ink)', border: 'none',
              }}
            >
              <PerriandIcon name="add" size={14} color="white" />
            </button>
          )}
        </div>

        {/* Checklist inline builder — only when checklist type selected */}
        {inputType === 'checklist' && (
          <div className="mt-2 pl-1">
            {checklistItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 mb-1">
                <span className="text-[11px]" style={{ color: INK['20'] }}>☐</span>
                <span className="text-[11px] flex-1" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>{item}</span>
                <button
                  onClick={() => setChecklistItems(prev => prev.filter((_, j) => j !== i))}
                  className="w-4 h-4 flex items-center justify-center border-none cursor-pointer"
                  style={{ background: 'transparent' }}
                  aria-label="Remove item"
                >
                  <PerriandIcon name="close" size={8} color={INK['20']} />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
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
                placeholder="Add an item and press Enter..."
                className="flex-1 text-[11px] bg-transparent border-none outline-none"
                style={{ fontFamily: FONT.sans, color: TEXT.secondary }}
              />
            </div>
          </div>
        )}

        {/* Vibe color picker — only visible when vibe type selected */}
        {inputType === 'vibe' && (
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[10px]" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>Tone:</span>
            {VIBE_COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setVibeColor(c.value)}
                className="w-5 h-5 rounded-full border-2 cursor-pointer transition-all"
                style={{
                  background: c.bg,
                  borderColor: vibeColor === c.value ? c.border : 'transparent',
                  transform: vibeColor === c.value ? 'scale(1.15)' : 'scale(1)',
                }}
                title={c.label}
              />
            ))}
          </div>
        )}
      </div>

      {/* Entries list */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ padding: compact ? '8px 10px' : '12px 16px', scrollbarWidth: 'thin' }}
      >
        {sortedEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <PerriandIcon name="discover" size={28} color={INK['15']} />
            <p className="text-[12px] mt-3 text-center leading-relaxed" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>
              Drop links, jot down questions,<br />
              set the vibe — this is your<br />
              messy thinking space.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sortedEntries.map(entry => (
              <DreamBoardCard
                key={entry.id}
                entry={entry}
                compact={compact}
                onUpdate={updateEntry}
                onRemove={removeEntry}
                onTogglePin={togglePin}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer count */}
      {entries.length > 0 && (
        <div
          className="flex-shrink-0 flex items-center justify-between"
          style={{
            padding: compact ? '6px 10px' : '8px 16px',
            borderTop: '1px solid var(--t-linen)',
          }}
        >
          <span className="text-[10px]" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
            {entries.length} item{entries.length !== 1 ? 's' : ''}
            {entries.filter(e => e.pinned).length > 0 &&
              ` · ${entries.filter(e => e.pinned).length} pinned`
            }
            {entries.filter(e => e.type === 'question' && !e.resolved).length > 0 &&
              ` · ${entries.filter(e => e.type === 'question' && !e.resolved).length} open ?'s`
            }
          </span>
        </div>
      )}
    </div>
  );
});

DreamBoard.displayName = 'DreamBoard';
export default DreamBoard;
