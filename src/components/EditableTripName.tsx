'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FONT } from '@/constants/theme';

interface EditableTripNameProps {
  name: string;
  onRename: (newName: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Inline-editable trip name. Click to edit, Enter/blur to save, Escape to cancel.
 */
export default function EditableTripName({ name, onRename, className, style }: EditableTripNameProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft when name changes externally
  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  // Auto-focus + select when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const save = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) {
      onRename(trimmed);
    } else {
      setDraft(name); // revert
    }
    setEditing(false);
  }, [draft, name, onRename]);

  const cancel = useCallback(() => {
    setDraft(name);
    setEditing(false);
  }, [name]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); save(); }
          if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
        className={className}
        style={{
          ...style,
          background: 'transparent',
          border: 'none',
          borderBottom: '1.5px solid var(--t-ink)',
          outline: 'none',
          padding: '0 0 1px',
          margin: 0,
          width: '100%',
          minWidth: 80,
        }}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={className}
      style={{
        ...style,
        cursor: 'text',
        borderBottom: '1.5px solid transparent',
      }}
      title="Click to rename"
    >
      {name}
    </span>
  );
}
