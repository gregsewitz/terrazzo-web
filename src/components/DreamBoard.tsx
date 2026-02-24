'use client';

import { useState, useRef, useMemo, useCallback } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { DreamBoardEntry, DreamBoardEntryType } from '@/types';
import { PerriandIcon, type PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';

// ─── Entry type config ───
const ENTRY_TYPES: { type: DreamBoardEntryType; label: string; icon: PerriandIconName; placeholder: string }[] = [
  { type: 'note', label: 'Note', icon: 'edit', placeholder: 'Jot something down...' },
  { type: 'link', label: 'Link', icon: 'article', placeholder: 'Paste a URL...' },
  { type: 'checklist', label: 'Checklist', icon: 'check', placeholder: 'Checklist title...' },
  { type: 'question', label: 'Question', icon: 'discover', placeholder: 'Something to figure out...' },
  { type: 'vibe', label: 'Vibe', icon: 'sparkle', placeholder: 'Set the tone...' },
];

// ─── Vibe accent colors ───
const VIBE_COLORS = [
  { value: 'honey', label: 'Warm', bg: 'rgba(200,146,58,0.10)', border: 'rgba(200,146,58,0.25)' },
  { value: 'verde', label: 'Fresh', bg: 'rgba(42,122,86,0.08)', border: 'rgba(42,122,86,0.20)' },
  { value: 'blue', label: 'Cool', bg: 'rgba(58,140,180,0.08)', border: 'rgba(58,140,180,0.20)' },
  { value: 'rose', label: 'Rosy', bg: 'rgba(180,80,80,0.08)', border: 'rgba(180,80,80,0.20)' },
  { value: 'violet', label: 'Rich', bg: 'rgba(104,68,160,0.08)', border: 'rgba(104,68,160,0.20)' },
];

function getVibeBg(color?: string): string {
  return VIBE_COLORS.find(c => c.value === color)?.bg || VIBE_COLORS[0].bg;
}
function getVibeBorder(color?: string): string {
  return VIBE_COLORS.find(c => c.value === color)?.border || VIBE_COLORS[0].border;
}

// ─── Accent color options (for generic cards) ───
const ACCENT_COLORS = [
  { value: undefined, bg: INK['06'] },
  { value: 'verde', bg: 'rgba(42,122,86,0.12)' },
  { value: 'honey', bg: 'rgba(200,146,58,0.12)' },
  { value: 'blue', bg: 'rgba(58,140,180,0.12)' },
  { value: 'rose', bg: 'rgba(180,80,80,0.12)' },
];

function getAccentBg(color?: string): string {
  return ACCENT_COLORS.find(c => c.value === color)?.bg || 'white';
}

// ─── URL detection ───
const URL_REGEX = /^https?:\/\/[^\s]+$/i;
function isUrl(text: string): boolean { return URL_REGEX.test(text.trim()); }
function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url; }
}

// ─── Type icon for card header ───
const TYPE_EMOJI: Record<DreamBoardEntryType, string> = {
  note: '✎',
  link: '🔗',
  checklist: '☑',
  question: '?',
  vibe: '◌',
};

interface DreamBoardProps {
  compact?: boolean; // true for desktop right-panel mode (narrower)
}

export default function DreamBoard({ compact }: DreamBoardProps) {
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
          <p className="text-[11px]" style={{ color: INK['50'], fontFamily: FONT.sans, margin: 0, marginTop: 2 }}>
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
                  color: isActive ? 'white' : INK['50'],
                  borderColor: isActive ? 'var(--t-ink)' : 'var(--t-linen)',
                  fontFamily: FONT.sans, fontSize: 11, fontWeight: 500,
                }}
              >
                <PerriandIcon name={t.icon} size={11} color={isActive ? 'white' : INK['40']} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Type-specific hint */}
        <p
          className="text-[10px] mb-1.5"
          style={{ color: INK['35'], fontFamily: FONT.sans, margin: 0, marginBottom: 6 }}
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
              style={{ color: 'rgba(58,140,180,0.5)', fontFamily: FONT.serif }}
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
                <span className="text-[11px] flex-1" style={{ color: INK['60'], fontFamily: FONT.sans }}>{item}</span>
                <button
                  onClick={() => setChecklistItems(prev => prev.filter((_, j) => j !== i))}
                  className="w-4 h-4 flex items-center justify-center border-none cursor-pointer"
                  style={{ background: 'transparent' }}
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
                style={{ fontFamily: FONT.sans, color: INK['50'] }}
              />
            </div>
          </div>
        )}

        {/* Vibe color picker — only visible when vibe type selected */}
        {inputType === 'vibe' && (
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[10px]" style={{ color: INK['40'], fontFamily: FONT.mono }}>Tone:</span>
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
            <p className="text-[12px] mt-3 text-center leading-relaxed" style={{ color: INK['35'], fontFamily: FONT.sans }}>
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
          <span className="text-[10px]" style={{ color: INK['35'], fontFamily: FONT.mono }}>
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
}

// ═══════════════════════════════════════════════════════════════
//  Individual entry card
// ═══════════════════════════════════════════════════════════════
function DreamBoardCard({
  entry,
  compact,
  onUpdate,
  onRemove,
  onTogglePin,
}: {
  entry: DreamBoardEntry;
  compact?: boolean;
  onUpdate: (id: string, updates: Partial<DreamBoardEntry>) => void;
  onRemove: (id: string) => void;
  onTogglePin: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(entry.content);
  const [showActions, setShowActions] = useState(false);

  const timeAgo = useMemo(() => {
    const diff = Date.now() - new Date(entry.createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }, [entry.createdAt]);

  const handleSaveEdit = () => {
    onUpdate(entry.id, { content: editValue });
    setEditing(false);
  };

  const handleChecklistToggle = (idx: number) => {
    if (!entry.items) return;
    const newItems = entry.items.map((item, i) =>
      i === idx ? { ...item, done: !item.done } : item
    );
    onUpdate(entry.id, { items: newItems });
  };

  const handleChecklistAdd = (text: string) => {
    if (!text.trim()) return;
    const newItems = [...(entry.items || []), { text: text.trim(), done: false }];
    onUpdate(entry.id, { items: newItems });
  };

  // ─── Card styling by type ───
  const isVibe = entry.type === 'vibe';
  const isQuestion = entry.type === 'question';
  const isResolved = isQuestion && entry.resolved;

  const cardBg = isVibe
    ? getVibeBg(entry.color)
    : entry.pinned
      ? 'rgba(200,146,58,0.04)'
      : isQuestion
        ? (isResolved ? INK['04'] : 'rgba(58,140,180,0.04)')
        : getAccentBg(entry.color);

  const cardBorder = isVibe
    ? getVibeBorder(entry.color)
    : entry.pinned
      ? 'rgba(200,146,58,0.2)'
      : isQuestion && !isResolved
        ? 'rgba(58,140,180,0.2)'
        : 'var(--t-linen)';

  return (
    <div
      className="group/sp rounded-lg border overflow-hidden transition-all"
      style={{ background: cardBg, borderColor: cardBorder }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-2.5 pt-2 pb-0.5">
        <div className="flex items-center gap-1.5">
          {entry.pinned && (
            <PerriandIcon name="pin" size={10} color="var(--t-honey, #c8923a)" />
          )}
          <span className="text-[9px]" style={{ color: INK['35'], fontFamily: FONT.mono }}>
            {TYPE_EMOJI[entry.type] || '✎'} {timeAgo}
          </span>
        </div>

        {/* Actions — visible on hover (or always on mobile via touch) */}
        <div
          className="flex items-center gap-0.5 transition-opacity"
          style={{ opacity: showActions ? 1 : 0 }}
        >
          <button
            onClick={() => onTogglePin(entry.id)}
            className="w-5 h-5 flex items-center justify-center rounded border-none cursor-pointer"
            style={{ background: 'transparent' }}
            title={entry.pinned ? 'Unpin' : 'Pin to top'}
          >
            <PerriandIcon name="pin" size={10} color={entry.pinned ? 'var(--t-honey, #c8923a)' : INK['30']} />
          </button>
          {isQuestion && (
            <button
              onClick={() => onUpdate(entry.id, { resolved: !entry.resolved })}
              className="w-5 h-5 flex items-center justify-center rounded border-none cursor-pointer"
              style={{ background: 'transparent' }}
              title={isResolved ? 'Reopen' : 'Mark resolved'}
            >
              <PerriandIcon name="check" size={10} color={isResolved ? 'var(--t-verde, #2a7a56)' : INK['30']} />
            </button>
          )}
          {(entry.type === 'note' || entry.type === 'vibe' || entry.type === 'question') && (
            <button
              onClick={() => { setEditValue(entry.content); setEditing(!editing); }}
              className="w-5 h-5 flex items-center justify-center rounded border-none cursor-pointer"
              style={{ background: 'transparent' }}
              title="Edit"
            >
              <PerriandIcon name="edit" size={10} color={INK['30']} />
            </button>
          )}
          <button
            onClick={() => onRemove(entry.id)}
            className="w-5 h-5 flex items-center justify-center rounded border-none cursor-pointer"
            style={{ background: 'transparent' }}
            title="Delete"
          >
            <PerriandIcon name="close" size={10} color={INK['30']} />
          </button>
        </div>
      </div>

      {/* Card body */}
      <div className="px-2.5 pb-2.5">
        {/* ── Vibe ── */}
        {isVibe && (
          editing ? (
            <EditableTextarea value={editValue} onChange={setEditValue} onSave={handleSaveEdit} onCancel={() => setEditing(false)} />
          ) : (
            <div>
              <div className="flex items-start gap-2">
                <span
                  className="flex-shrink-0 text-[14px] mt-0.5"
                  style={{ opacity: 0.5 }}
                >◌</span>
                <p
                  className="text-[13px] leading-relaxed whitespace-pre-wrap flex-1"
                  style={{
                    color: 'var(--t-ink)',
                    fontFamily: FONT.serif,
                    fontStyle: 'italic',
                    margin: 0,
                  }}
                >
                  &ldquo;{entry.content}&rdquo;
                </p>
              </div>
              <div
                className="flex items-center gap-1 mt-2 px-2 py-1 rounded"
                style={{ background: getVibeBg(entry.color) }}
              >
                <PerriandIcon name="sparkle" size={9} color={INK['35']} />
                <span className="text-[9px]" style={{ color: INK['40'], fontFamily: FONT.sans }}>
                  Influences AI recommendations for this trip
                </span>
              </div>
            </div>
          )
        )}

        {/* ── Question ── */}
        {isQuestion && (
          editing ? (
            <EditableTextarea value={editValue} onChange={setEditValue} onSave={handleSaveEdit} onCancel={() => setEditing(false)} />
          ) : (
            <div>
              <div className="flex items-start gap-2">
                <span
                  className="flex-shrink-0 text-[15px] font-semibold mt-[-1px]"
                  style={{ color: isResolved ? INK['20'] : 'rgba(58,140,180,0.6)', fontFamily: FONT.serif }}
                >?</span>
                <p
                  className="text-[12px] leading-relaxed whitespace-pre-wrap flex-1"
                  style={{
                    color: isResolved ? INK['40'] : 'var(--t-ink)',
                    fontFamily: FONT.sans,
                    margin: 0,
                    textDecoration: isResolved ? 'line-through' : 'none',
                  }}
                >
                  {entry.content}
                </p>
              </div>
              {!isResolved && (
                <div
                  className="flex items-center gap-1 mt-2 px-2 py-1 rounded"
                  style={{ background: 'rgba(58,140,180,0.06)' }}
                >
                  <PerriandIcon name="discover" size={9} color="rgba(58,140,180,0.5)" />
                  <span className="text-[9px]" style={{ color: 'rgba(58,140,180,0.6)', fontFamily: FONT.sans }}>
                    AI will help research this during planning
                  </span>
                </div>
              )}
            </div>
          )
        )}

        {/* ── Note ── */}
        {entry.type === 'note' && (
          editing ? (
            <EditableTextarea value={editValue} onChange={setEditValue} onSave={handleSaveEdit} onCancel={() => setEditing(false)} />
          ) : (
            <p
              className="text-[12px] leading-relaxed whitespace-pre-wrap"
              style={{ color: 'var(--t-ink)', fontFamily: FONT.sans, margin: 0 }}
            >
              {entry.content}
            </p>
          )
        )}

        {/* ── Link ── */}
        {entry.type === 'link' && (
          <a
            href={entry.content}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 no-underline group/link"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(58,140,180,0.08)' }}
            >
              <PerriandIcon name="article" size={14} color="rgba(58,140,180,0.7)" />
            </div>
            <div className="min-w-0 flex-1">
              <span
                className="text-[12px] font-medium block truncate group-hover/link:underline"
                style={{ color: 'var(--t-ink)', fontFamily: FONT.sans }}
              >
                {entry.title || extractDomain(entry.content)}
              </span>
              <span
                className="text-[10px] block truncate"
                style={{ color: INK['40'], fontFamily: FONT.mono }}
              >
                {extractDomain(entry.content)}
              </span>
            </div>
          </a>
        )}

        {/* ── Checklist ── */}
        {entry.type === 'checklist' && (
          <div>
            {entry.title && (
              <span
                className="text-[12px] font-medium block mb-1.5"
                style={{ color: 'var(--t-ink)', fontFamily: FONT.sans }}
              >
                {entry.title}
              </span>
            )}
            <div className="flex flex-col gap-1">
              {(entry.items || []).map((item, idx) => (
                <label key={idx} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => handleChecklistToggle(idx)}
                    className="mt-0.5 accent-[var(--t-verde)]"
                    style={{ width: 14, height: 14 }}
                  />
                  <span
                    className="text-[12px] leading-relaxed"
                    style={{
                      color: item.done ? INK['35'] : 'var(--t-ink)',
                      fontFamily: FONT.sans,
                      textDecoration: item.done ? 'line-through' : 'none',
                    }}
                  >
                    {item.text}
                  </span>
                </label>
              ))}
            </div>
            <ChecklistAdder onAdd={handleChecklistAdd} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared editable textarea ───
function EditableTextarea({ value, onChange, onSave, onCancel }: {
  value: string; onChange: (v: string) => void; onSave: () => void; onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full text-[12px] rounded-md p-2 resize-none border outline-none"
        style={{
          fontFamily: FONT.sans, color: 'var(--t-ink)',
          borderColor: 'var(--t-linen)', background: 'white',
          minHeight: 60, lineHeight: 1.6,
        }}
        autoFocus
        onKeyDown={e => {
          if (e.key === 'Enter' && e.metaKey) onSave();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <div className="flex gap-1 justify-end">
        <button
          onClick={onCancel}
          className="text-[10px] px-2 py-1 rounded border-none cursor-pointer"
          style={{ background: INK['06'], color: INK['50'], fontFamily: FONT.sans }}
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="text-[10px] px-2 py-1 rounded border-none cursor-pointer"
          style={{ background: 'var(--t-ink)', color: 'white', fontFamily: FONT.sans }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ─── Inline checklist item adder ───
function ChecklistAdder({ onAdd }: { onAdd: (text: string) => void }) {
  const [value, setValue] = useState('');

  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <span className="text-[11px]" style={{ color: INK['20'] }}>+</span>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && value.trim()) {
            onAdd(value);
            setValue('');
          }
        }}
        placeholder="Add item..."
        className="flex-1 text-[11px] bg-transparent border-none outline-none"
        style={{ fontFamily: FONT.sans, color: INK['50'] }}
      />
    </div>
  );
}
