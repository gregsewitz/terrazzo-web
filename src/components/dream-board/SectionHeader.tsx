'use client';

import { useState } from 'react';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT } from '@/constants/theme';
import { motion, AnimatePresence } from 'framer-motion';

interface SectionHeaderProps {
  id: string;
  label: string;
  entryCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onRename: (newLabel: string) => void;
  onRemove: () => void;
}

export function SectionHeader({
  id,
  label,
  entryCount,
  isCollapsed,
  onToggleCollapse,
  onRename,
  onRemove,
}: SectionHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const [showActions, setShowActions] = useState(false);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== label) {
      onRename(trimmed);
    } else {
      setEditValue(label);
    }
    setEditing(false);
  };

  return (
    <div
      className="group flex items-center gap-2 py-3 cursor-pointer select-none"
      style={{ borderBottom: `1px solid ${INK['08']}` }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Collapse chevron */}
      <button
        onClick={onToggleCollapse}
        className="flex items-center justify-center w-5 h-5 rounded border-none cursor-pointer flex-shrink-0"
        style={{ background: 'transparent' }}
      >
        <motion.div
          animate={{ rotate: isCollapsed ? -90 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <PerriandIcon name="arrow-right" size={10} color={INK['35']} style={{ transform: 'rotate(90deg)' }} />
        </motion.div>
      </button>

      {/* Label */}
      {editing ? (
        <input
          type="text"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') { setEditValue(label); setEditing(false); }
          }}
          className="flex-1 text-[14px] bg-transparent border-none outline-none"
          style={{ fontFamily: FONT.serif, color: TEXT.primary, fontWeight: 500 }}
          autoFocus
        />
      ) : (
        <span
          className="flex-1 text-[14px]"
          style={{ fontFamily: FONT.serif, color: TEXT.primary, fontWeight: 500 }}
          onClick={onToggleCollapse}
          onDoubleClick={() => setEditing(true)}
        >
          {label}
        </span>
      )}

      {/* Entry count badge */}
      <span
        className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
        style={{
          fontFamily: FONT.mono,
          color: TEXT.secondary,
          background: INK['04'],
        }}
      >
        {entryCount}
      </span>

      {/* Actions on hover */}
      <div
        className="flex items-center gap-0.5 transition-opacity flex-shrink-0"
        style={{ opacity: showActions ? 1 : 0 }}
      >
        <button
          onClick={() => setEditing(true)}
          className="w-5 h-5 flex items-center justify-center rounded border-none cursor-pointer"
          style={{ background: 'transparent' }}
          title="Rename section"
        >
          <PerriandIcon name="edit" size={10} color={INK['30']} />
        </button>
        <button
          onClick={onRemove}
          className="w-5 h-5 flex items-center justify-center rounded border-none cursor-pointer"
          style={{ background: 'transparent' }}
          title="Remove section"
        >
          <PerriandIcon name="close" size={10} color={INK['30']} />
        </button>
      </div>
    </div>
  );
}
