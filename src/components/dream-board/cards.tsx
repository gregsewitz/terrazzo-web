'use client';

import { useState, useMemo } from 'react';
import { DreamBoardEntry } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT } from '@/constants/theme';
import { getVibeBg, getVibeBorder, getAccentBg, extractDomain } from './helpers';

// ─── Type icon for card header ───
const TYPE_EMOJI: Record<string, string> = {
  note: '✎',
  link: '🔗',
  checklist: '☑',
  question: '?',
  vibe: '◌',
};

// ═══════════════════════════════════════════════════════════════
//  Individual entry card
// ═══════════════════════════════════════════════════════════════
export function DreamBoardCard({
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
      ? 'rgba(238,113,109,0.04)'
      : isQuestion
        ? (isResolved ? INK['04'] : 'rgba(58,140,180,0.04)')
        : getAccentBg(entry.color);

  const cardBorder = isVibe
    ? getVibeBorder(entry.color)
    : entry.pinned
      ? 'rgba(238,113,109,0.2)'
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
            <PerriandIcon name="pin" size={10} color="var(--t-honey, #ee716d)" />
          )}
          <span className="text-[9px]" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
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
            <PerriandIcon name="pin" size={10} color={entry.pinned ? 'var(--t-honey, #ee716d)' : INK['30']} />
          </button>
          {isQuestion && (
            <button
              onClick={() => onUpdate(entry.id, { resolved: !entry.resolved })}
              className="w-5 h-5 flex items-center justify-center rounded border-none cursor-pointer"
              style={{ background: 'transparent' }}
              title={isResolved ? 'Reopen' : 'Mark resolved'}
            >
              <PerriandIcon name="check" size={10} color={isResolved ? 'var(--t-dark-teal, #3a8088)' : INK['30']} />
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
                <span className="text-[9px]" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>
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
                  style={{ color: isResolved ? TEXT.secondary : TEXT.secondary, fontFamily: FONT.serif }}
                >?</span>
                <p
                  className="text-[12px] leading-relaxed whitespace-pre-wrap flex-1"
                  style={{
                    color: isResolved ? TEXT.secondary : TEXT.primary,
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
                  <span className="text-[9px]" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>
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
              style={{ color: TEXT.primary, fontFamily: FONT.sans, margin: 0 }}
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
                style={{ color: TEXT.primary, fontFamily: FONT.sans }}
              >
                {entry.title || extractDomain(entry.content)}
              </span>
              <span
                className="text-[10px] block truncate"
                style={{ color: TEXT.secondary, fontFamily: FONT.mono }}
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
                style={{ color: TEXT.primary, fontFamily: FONT.sans }}
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
                    className="mt-0.5 accent-[var(--t-dark-teal)]"
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
export function EditableTextarea({ value, onChange, onSave, onCancel }: {
  value: string; onChange: (v: string) => void; onSave: () => void; onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full text-[12px] rounded-md p-2 resize-none border outline-none"
        style={{
          fontFamily: FONT.sans, color: TEXT.primary,
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
          style={{ background: INK['06'], color: TEXT.secondary, fontFamily: FONT.sans }}
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
export function ChecklistAdder({ onAdd }: { onAdd: (text: string) => void }) {
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
        style={{ fontFamily: FONT.sans, color: TEXT.secondary }}
      />
    </div>
  );
}
