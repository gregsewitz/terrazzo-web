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
 * Uses a hidden measuring span so the input auto-sizes to its content.
 */
export default function EditableTripName({ name, onRename, className, style }: EditableTripNameProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [inputWidth, setInputWidth] = useState<number | undefined>(undefined);

  // Sync draft when name changes externally
  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  // Measure the text width whenever draft changes
  useEffect(() => {
    if (editing && measureRef.current) {
      // Add a small buffer (8px) so the cursor isn't jammed against the edge
      setInputWidth(measureRef.current.scrollWidth + 8);
    }
  }, [draft, editing]);

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
      <>
        {/* Hidden span to measure text width — same font styles as the input */}
        <span
          ref={measureRef}
          aria-hidden
          style={{
            ...style,
            position: 'absolute',
            visibility: 'hidden',
            whiteSpace: 'pre',
            pointerEvents: 'none',
            padding: 0,
            margin: 0,
          }}
        >
          {draft || ' '}
        </span>
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
            width: inputWidth ?? 'auto',
            minWidth: 40,
            maxWidth: '100%',
          }}
        />
      </>
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
