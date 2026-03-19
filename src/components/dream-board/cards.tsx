'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { DreamBoardEntry } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT } from '@/constants/theme';
import {
  extractDomain,
  parseMarkdownBlocks,
  parseInlineMarkdown,
  detectConfirmationCodes,
  type MarkdownSegment,
} from './helpers';
import { motion } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════
//  Inline markdown renderer
// ═══════════════════════════════════════════════════════════════

function InlineSegments({ segments }: { segments: MarkdownSegment[] }) {
  return (
    <>
      {segments.map((seg, i) => {
        switch (seg.type) {
          case 'bold':
            return <strong key={i} style={{ fontWeight: 600 }}>{seg.content}</strong>;
          case 'italic':
            return <em key={i} style={{ fontFamily: FONT.serif }}>{seg.content}</em>;
          case 'code':
            return (
              <code
                key={i}
                className="px-1 py-0.5 rounded text-[11px]"
                style={{
                  fontFamily: FONT.mono,
                  background: INK['06'],
                  color: TEXT.primary,
                }}
              >
                {seg.content}
              </code>
            );
          case 'link':
            return (
              <a
                key={i}
                href={seg.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 decoration-1"
                style={{ color: TEXT.accent, textDecorationColor: INK['20'] }}
              >
                {seg.label}
              </a>
            );
          default:
            return <span key={i}>{seg.content}</span>;
        }
      })}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Confirmation code chip (copy on click)
// ═══════════════════════════════════════════════════════════════

function ConfCodeChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [code]);

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border cursor-pointer transition-colors"
      style={{
        fontFamily: FONT.mono,
        fontSize: 11,
        color: TEXT.primary,
        background: INK['04'],
        borderColor: INK['10'],
      }}
      title="Copy to clipboard"
    >
      {code}
      <PerriandIcon
        name={copied ? 'check' : 'edit'}
        size={9}
        color={copied ? 'var(--t-dark-teal)' : INK['30']}
      />
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Rich text display with inline smart detection
// ═══════════════════════════════════════════════════════════════

function RichTextDisplay({ content }: { content: string }) {
  const blocks = useMemo(() => parseMarkdownBlocks(content), [content]);
  const codes = useMemo(() => detectConfirmationCodes(content), [content]);

  return (
    <div className="flex flex-col gap-1">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading':
            return (
              <p
                key={i}
                className={block.level === 1 ? 'text-[14px]' : block.level === 2 ? 'text-[13px]' : 'text-[12px]'}
                style={{
                  fontFamily: FONT.serif,
                  fontWeight: 600,
                  color: TEXT.primary,
                  margin: 0,
                  marginTop: i > 0 ? 4 : 0,
                }}
              >
                {block.content}
              </p>
            );
          case 'bullet':
            return (
              <div key={i} className="flex items-start gap-2 pl-1">
                <span className="text-[10px] mt-1 flex-shrink-0" style={{ color: INK['30'] }}>
                  {'\u2022'}
                </span>
                <p
                  className="text-[12px] leading-relaxed flex-1"
                  style={{ fontFamily: FONT.sans, color: TEXT.primary, margin: 0 }}
                >
                  <InlineSegments segments={block.segments} />
                </p>
              </div>
            );
          case 'empty':
            return <div key={i} className="h-2" />;
          default:
            return (
              <p
                key={i}
                className="text-[12px] leading-relaxed"
                style={{ fontFamily: FONT.sans, color: TEXT.primary, margin: 0 }}
              >
                <InlineSegments segments={block.segments} />
              </p>
            );
        }
      })}

      {/* Detected confirmation codes rendered as copyable chips */}
      {codes.length > 0 && (
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span className="text-[9px]" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
            Conf:
          </span>
          {codes.map((c, i) => (
            <ConfCodeChip key={i} code={c.code} />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Editable textarea (shared)
// ═══════════════════════════════════════════════════════════════

function EditableTextarea({ value, onChange, onSave, onCancel }: {
  value: string; onChange: (v: string) => void; onSave: () => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [value]);

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full text-[12px] rounded-lg p-2.5 resize-none border outline-none"
        style={{
          fontFamily: FONT.sans,
          color: TEXT.primary,
          borderColor: INK['12'],
          background: 'white',
          minHeight: 60,
          lineHeight: 1.6,
        }}
        autoFocus
        onKeyDown={e => {
          if (e.key === 'Enter' && e.metaKey) onSave();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <div className="flex items-center justify-between">
        <span className="text-[9px]" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
          **bold** *italic* - bullets
        </span>
        <div className="flex gap-1">
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
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Checklist inline adder
// ═══════════════════════════════════════════════════════════════

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
        style={{ fontFamily: FONT.sans, color: TEXT.secondary }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Main card component — flowing document style
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
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  }, [entry.createdAt]);

  const handleSaveEdit = useCallback(() => {
    onUpdate(entry.id, { content: editValue });
    setEditing(false);
  }, [entry.id, editValue, onUpdate]);

  const handleChecklistToggle = useCallback((idx: number) => {
    if (!entry.items) return;
    const newItems = entry.items.map((item, i) =>
      i === idx ? { ...item, done: !item.done } : item
    );
    onUpdate(entry.id, { items: newItems });
  }, [entry.id, entry.items, onUpdate]);

  const handleChecklistAdd = useCallback((text: string) => {
    if (!text.trim()) return;
    const newItems = [...(entry.items || []), { text: text.trim(), done: false }];
    onUpdate(entry.id, { items: newItems });
  }, [entry.id, entry.items, onUpdate]);

  const doneCount = entry.items?.filter(i => i.done).length || 0;
  const totalCount = entry.items?.length || 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className="group/entry relative"
      style={{
        borderLeft: entry.pinned
          ? '2px solid var(--t-coral, #ee716d)'
          : '2px solid transparent',
        paddingLeft: compact ? 10 : 14,
        paddingTop: 6,
        paddingBottom: 6,
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Timestamp + actions */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          {entry.pinned && (
            <PerriandIcon name="pin" size={9} color="var(--t-coral, #ee716d)" />
          )}
          <span className="text-[9px]" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
            {timeAgo}
          </span>
        </div>

        <div
          className="flex items-center gap-0.5 transition-opacity"
          style={{ opacity: showActions ? 1 : 0 }}
        >
          <button
            onClick={() => onTogglePin(entry.id)}
            className="w-5 h-5 flex items-center justify-center rounded border-none cursor-pointer"
            style={{ background: 'transparent' }}
            title={entry.pinned ? 'Unpin' : 'Pin'}
          >
            <PerriandIcon name="pin" size={10} color={entry.pinned ? 'var(--t-coral, #ee716d)' : INK['30']} />
          </button>
          {(entry.type === 'text' || entry.type === 'link') && (
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

      {/* ── Text entry ── */}
      {entry.type === 'text' && (
        editing ? (
          <EditableTextarea
            value={editValue}
            onChange={setEditValue}
            onSave={handleSaveEdit}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div
            className="cursor-text"
            onClick={() => { setEditValue(entry.content); setEditing(true); }}
          >
            <RichTextDisplay content={entry.content} />
          </div>
        )
      )}

      {/* ── Link entry ── */}
      {entry.type === 'link' && (
        <a
          href={entry.content}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 no-underline py-1 rounded-lg transition-colors group/link"
        >
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(58,140,180,0.08)' }}
          >
            <PerriandIcon name="article" size={13} color="rgba(58,140,180,0.6)" />
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

      {/* ── Checklist entry ── */}
      {entry.type === 'checklist' && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            {entry.title && (
              <span
                className="text-[12px] font-medium"
                style={{ color: TEXT.primary, fontFamily: FONT.sans }}
              >
                {entry.title}
              </span>
            )}
            {totalCount > 0 && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full"
                style={{
                  fontFamily: FONT.mono,
                  color: doneCount === totalCount ? 'var(--t-dark-teal)' : TEXT.secondary,
                  background: doneCount === totalCount ? 'rgba(58,128,136,0.08)' : INK['04'],
                }}
              >
                {doneCount}/{totalCount}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-0.5">
            {(entry.items || []).map((item, idx) => (
              <label key={idx} className="flex items-start gap-2 cursor-pointer py-0.5">
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
                    color: item.done ? INK['35'] : TEXT.primary,
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
    </motion.div>
  );
}
