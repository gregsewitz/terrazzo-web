'use client';

import { useState, useRef, useMemo, useCallback } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { ScratchpadEntry, ScratchpadEntryType } from '@/types';
import { PerriandIcon, type PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';

// ─── Entry type config ───
const ENTRY_TYPES: { type: ScratchpadEntryType; label: string; icon: PerriandIconName; placeholder: string }[] = [
  { type: 'note', label: 'Note', icon: 'edit', placeholder: 'Jot something down...' },
  { type: 'link', label: 'Link', icon: 'article', placeholder: 'Paste a URL...' },
  { type: 'checklist', label: 'Checklist', icon: 'check', placeholder: 'Checklist title...' },
];

// ─── Accent color options ───
const ACCENT_COLORS = [
  { value: undefined, label: 'None', bg: INK['06'] },
  { value: 'verde', label: 'Green', bg: 'rgba(42,122,86,0.12)' },
  { value: 'honey', label: 'Gold', bg: 'rgba(200,146,58,0.12)' },
  { value: 'blue', label: 'Blue', bg: 'rgba(58,140,180,0.12)' },
  { value: 'rose', label: 'Rose', bg: 'rgba(180,80,80,0.12)' },
];

function getAccentBg(color?: string): string {
  const found = ACCENT_COLORS.find(c => c.value === color);
  return found?.bg || 'white';
}

// ─── URL detection ───
const URL_REGEX = /^https?:\/\/[^\s]+$/i;
function isUrl(text: string): boolean {
  return URL_REGEX.test(text.trim());
}
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

interface ScratchpadProps {
  compact?: boolean; // true for desktop right-panel mode (narrower)
}

export default function Scratchpad({ compact }: ScratchpadProps) {
  const trips = useTripStore(s => s.trips);
  const currentTripId = useTripStore(s => s.currentTripId);
  const trip = useMemo(() => trips.find(t => t.id === currentTripId), [trips, currentTripId]);
  const addEntry = useTripStore(s => s.addScratchpadEntry);
  const updateEntry = useTripStore(s => s.updateScratchpadEntry);
  const removeEntry = useTripStore(s => s.removeScratchpadEntry);
  const togglePin = useTripStore(s => s.toggleScratchpadPin);

  const entries = trip?.scratchpad || [];

  // Sort: pinned first, then by creation date (newest first)
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [entries]);

  // ─── Input state ───
  const [inputType, setInputType] = useState<ScratchpadEntryType>('note');
  const [inputValue, setInputValue] = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = useCallback(() => {
    const text = inputValue.trim();
    if (!text) return;

    // Auto-detect links
    const type = isUrl(text) ? 'link' : inputType;

    if (type === 'checklist') {
      addEntry({
        type: 'checklist',
        content: '',
        title: text,
        items: [],
      });
    } else if (type === 'link') {
      addEntry({
        type: 'link',
        content: text,
        title: extractDomain(text),
      });
    } else {
      addEntry({
        type: 'note',
        content: text,
      });
    }

    setInputValue('');
    setInputType('note');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [inputValue, inputType, addEntry]);

  return (
    <div className="flex flex-col h-full">
      {/* Header — only in full mode (mobile) */}
      {!compact && (
        <div
          className="px-5 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--t-linen)' }}
        >
          <h2
            className="text-base mb-0.5"
            style={{ fontFamily: FONT.serif, fontStyle: 'italic', color: 'var(--t-ink)', margin: 0 }}
          >
            Scratchpad
          </h2>
          <p className="text-[11px]" style={{ color: INK['50'], fontFamily: FONT.sans }}>
            Notes, links, ideas — anything you want to come back to.
          </p>
        </div>
      )}

      {/* Input area */}
      <div
        className="flex-shrink-0"
        style={{
          padding: compact ? '8px 10px' : '12px 16px',
          borderBottom: '1px solid var(--t-linen)',
        }}
      >
        <div className="flex items-center gap-2">
          {/* Type picker toggle */}
          <button
            onClick={() => setShowTypePicker(!showTypePicker)}
            className="flex items-center justify-center flex-shrink-0 cursor-pointer nav-hover"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: INK['04'],
              border: 'none',
            }}
            title={`Type: ${inputType}`}
          >
            <PerriandIcon
              name={ENTRY_TYPES.find(t => t.type === inputType)?.icon || 'edit'}
              size={14}
              color={INK['50']}
            />
          </button>

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder={ENTRY_TYPES.find(t => t.type === inputType)?.placeholder || 'Add something...'}
            className="flex-1 text-[13px] bg-transparent border-none outline-none"
            style={{ fontFamily: FONT.sans, color: 'var(--t-ink)' }}
          />

          {/* Add button */}
          {inputValue.trim() && (
            <button
              onClick={handleAdd}
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
            </button>
          )}
        </div>

        {/* Type picker dropdown */}
        {showTypePicker && (
          <div className="flex gap-1.5 mt-2">
            {ENTRY_TYPES.map(t => (
              <button
                key={t.type}
                onClick={() => { setInputType(t.type); setShowTypePicker(false); }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border cursor-pointer transition-all"
                style={{
                  background: inputType === t.type ? 'var(--t-ink)' : 'white',
                  color: inputType === t.type ? 'white' : INK['70'],
                  borderColor: inputType === t.type ? 'var(--t-ink)' : 'var(--t-linen)',
                  fontFamily: FONT.sans,
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                <PerriandIcon name={t.icon} size={11} color={inputType === t.type ? 'white' : INK['50']} />
                {t.label}
              </button>
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
            <PerriandIcon name="edit" size={28} color={INK['15']} />
            <p className="text-[12px] mt-3 text-center" style={{ color: INK['35'], fontFamily: FONT.sans }}>
              Drop links, jot down ideas,<br />make checklists — all in one place.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sortedEntries.map(entry => (
              <ScratchpadCard
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
          </span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Individual entry card
// ═══════════════════════════════════════════════════════════════
function ScratchpadCard({
  entry,
  compact,
  onUpdate,
  onRemove,
  onTogglePin,
}: {
  entry: ScratchpadEntry;
  compact?: boolean;
  onUpdate: (id: string, updates: Partial<ScratchpadEntry>) => void;
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

  const bg = getAccentBg(entry.color);

  return (
    <div
      className="group/sp rounded-lg border overflow-hidden transition-all"
      style={{
        background: entry.pinned ? 'rgba(200,146,58,0.04)' : bg,
        borderColor: entry.pinned ? 'rgba(200,146,58,0.2)' : 'var(--t-linen)',
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Card header — pin indicator + actions */}
      <div className="flex items-center justify-between px-2.5 pt-2 pb-0.5">
        <div className="flex items-center gap-1.5">
          {entry.pinned && (
            <PerriandIcon name="pin" size={10} color="var(--t-honey, #c8923a)" />
          )}
          <span className="text-[9px]" style={{ color: INK['35'], fontFamily: FONT.mono }}>
            {entry.type === 'link' ? '🔗' : entry.type === 'checklist' ? '☑' : '✎'} {timeAgo}
          </span>
        </div>

        {/* Actions — visible on hover */}
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
          {entry.type === 'note' && (
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

      {/* Card body — depends on type */}
      <div className="px-2.5 pb-2.5">
        {entry.type === 'note' && (
          editing ? (
            <div className="flex flex-col gap-1.5">
              <textarea
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                className="w-full text-[12px] rounded-md p-2 resize-none border outline-none"
                style={{
                  fontFamily: FONT.sans,
                  color: 'var(--t-ink)',
                  borderColor: 'var(--t-linen)',
                  background: 'white',
                  minHeight: 60,
                  lineHeight: 1.6,
                }}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.metaKey) handleSaveEdit();
                  if (e.key === 'Escape') setEditing(false);
                }}
              />
              <div className="flex gap-1 justify-end">
                <button
                  onClick={() => setEditing(false)}
                  className="text-[10px] px-2 py-1 rounded border-none cursor-pointer"
                  style={{ background: INK['06'], color: INK['50'], fontFamily: FONT.sans }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="text-[10px] px-2 py-1 rounded border-none cursor-pointer"
                  style={{ background: 'var(--t-ink)', color: 'white', fontFamily: FONT.sans }}
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <p
              className="text-[12px] leading-relaxed whitespace-pre-wrap"
              style={{ color: 'var(--t-ink)', fontFamily: FONT.sans, margin: 0 }}
            >
              {entry.content}
            </p>
          )
        )}

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
                <label
                  key={idx}
                  className="flex items-start gap-2 cursor-pointer"
                >
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
            {/* Add item inline */}
            <ChecklistAdder onAdd={handleChecklistAdd} />
          </div>
        )}
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
