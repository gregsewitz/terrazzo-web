'use client';

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { FONT, INK } from '@/constants/theme';
import { parseQuickEntry } from '@/lib/parseQuickEntry';
import type { QuickEntry } from '@/types';

interface QuickEntryInputProps {
  slotLabel: string;
  onSubmit: (entry: Omit<QuickEntry, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
  /** Auto-focus the input on mount (mobile: true after tap, desktop: true) */
  autoFocus?: boolean;
  /** Pre-fill with existing text for editing an entry */
  initialValue?: string;
}

function QuickEntryInput({ slotLabel, onSubmit, onCancel, autoFocus = true, initialValue }: QuickEntryInputProps) {
  const [value, setValue] = useState(initialValue || '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      // Small delay for mobile keyboard animation
      const timer = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      onCancel();
      return;
    }

    const parsed = parseQuickEntry(trimmed);
    onSubmit(parsed);
    setValue('');
  }, [value, onSubmit, onCancel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }, [handleSubmit, onCancel]);

  // Close on outside click (blur)
  const handleBlur = useCallback(() => {
    // Small delay to allow click events on submit button to fire
    setTimeout(() => {
      if (!value.trim()) {
        onCancel();
      }
    }, 150);
  }, [value, onCancel]);

  // Live preview of parsed category
  const preview = value.trim() ? parseQuickEntry(value.trim()) : null;
  const isTentative = value.trim().endsWith('?');

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: 'white',
        border: '1.5px solid var(--t-verde)',
        boxShadow: '0 2px 8px rgba(42,122,86,0.10)',
      }}
    >
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={`Add to ${slotLabel.toLowerCase()}...`}
          className="flex-1 min-w-0 bg-transparent outline-none"
          style={{
            fontFamily: FONT.sans,
            fontSize: 16, // ≥16px prevents iOS Safari auto-zoom on focus
            color: 'var(--t-ink)',
            border: 'none',
            padding: '4px 0',
            lineHeight: 1.4,
          }}
          // Prevent zoom on iOS
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
          enterKeyHint="done"
        />

        {/* Submit button — only shown when there's text */}
        {value.trim() && (
          <button
            onClick={(e) => { e.stopPropagation(); handleSubmit(); }}
            onMouseDown={(e) => e.preventDefault()} // Prevent blur from firing first
            className="flex-shrink-0 px-3 py-2 sm:px-2 sm:py-1 rounded-md flex items-center justify-center"
            style={{
              background: 'var(--t-verde)',
              border: 'none',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
            aria-label="Add entry"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Live parse preview — shows category + time hint as user types */}
      {preview && (
        <div
          className="px-2.5 pb-1.5 flex items-center gap-2"
          style={{ borderTop: '1px solid var(--t-linen)' }}
        >
          <span
            className="text-[9px] font-medium px-1.5 py-px rounded"
            style={{
              background: INK['06'],
              color: INK['80'],
              fontFamily: FONT.mono,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {preview.category}
          </span>
          {preview.specificTime && (
            <span
              className="text-[9px]"
              style={{ color: INK['70'], fontFamily: FONT.mono }}
            >
              {preview.specificTimeLabel ? `${preview.specificTimeLabel} ` : ''}{preview.specificTime}
            </span>
          )}
          {isTentative && (
            <span
              className="text-[9px] italic"
              style={{ color: INK['70'], fontFamily: FONT.sans }}
            >
              tentative
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(QuickEntryInput);
