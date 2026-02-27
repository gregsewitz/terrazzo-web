'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import type { PlaceType } from '@/types';

/** Tiny inline clock icon (no dependency on icon set) */
function ClockIcon({ size = 10, color = '#666' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.5" />
      <path d="M8 4.5V8L10.5 9.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Time formatting helpers ───

/** Convert 24h "HH:mm" → "8:15 PM" */
export function formatTime12h(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

/** Infer a contextual label based on place type */
export function inferTimeLabel(placeType: PlaceType, existingLabel?: string): string {
  if (existingLabel) return existingLabel;
  switch (placeType) {
    case 'restaurant': return 'Reservation';
    case 'bar': return 'Reservation';
    case 'hotel': return 'Check-in';
    case 'museum': return 'Entry';
    case 'activity': return 'Starts';
    default: return 'At';
  }
}

/** Build the display string: "Reservation at 8:15 PM" */
export function buildTimeDisplay(time24: string, placeType: PlaceType, label?: string): string {
  const inferredLabel = inferTimeLabel(placeType, label);
  const formatted = formatTime12h(time24);
  return `${inferredLabel} at ${formatted}`;
}

// ─── Inline Time Editor Component ───

interface PlaceTimeEditorProps {
  specificTime?: string;
  specificTimeLabel?: string;
  placeType: PlaceType;
  onSave: (time: string | undefined, label?: string) => void;
  compact?: boolean;
}

export default function PlaceTimeEditor({
  specificTime,
  specificTimeLabel,
  placeType,
  onSave,
  compact = false,
}: PlaceTimeEditorProps) {
  const [editing, setEditing] = useState(false);
  const [timeValue, setTimeValue] = useState(specificTime || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus the input when editing starts
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      // On mobile, the click/showPicker triggers the native time picker
      try { inputRef.current.showPicker?.(); } catch {}
    }
  }, [editing]);

  // Close on click outside
  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleSave();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editing, timeValue]);

  const handleSave = useCallback(() => {
    setEditing(false);
    if (timeValue && timeValue !== specificTime) {
      onSave(timeValue, specificTimeLabel);
    } else if (!timeValue && specificTime) {
      onSave(undefined); // Clear time
    }
  }, [timeValue, specificTime, specificTimeLabel, onSave]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setTimeValue('');
    setEditing(false);
    onSave(undefined);
  }, [onSave]);

  const handleStartEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setTimeValue(specificTime || '');
    setEditing(true);
  }, [specificTime]);

  // ─── Display mode: show time or "+ time" affordance ───
  if (!editing) {
    if (specificTime) {
      return (
        <span
          onClick={handleStartEdit}
          className="inline-flex items-center gap-1 cursor-pointer group/time"
          style={{
            fontSize: compact ? 9 : 10,
            fontFamily: FONT.sans,
            color: INK['70'],
            fontStyle: 'italic',
          }}
        >
          <ClockIcon size={compact ? 8 : 9} color={INK['50']} />
          {buildTimeDisplay(specificTime, placeType, specificTimeLabel)}
          <span
            className="opacity-0 group-hover/time:opacity-60 transition-opacity"
            onClick={handleClear}
            style={{ fontSize: 8, color: INK['40'], marginLeft: 2 }}
          >
            ×
          </span>
        </span>
      );
    }

    // No time set — show clickable affordance
    return (
      <span
        onClick={handleStartEdit}
        className="inline-flex items-center gap-1 cursor-pointer hover:opacity-90 transition-opacity"
        style={{
          fontSize: compact ? 8 : 9,
          fontFamily: FONT.sans,
          color: INK['55'],
        }}
      >
        <ClockIcon size={compact ? 7 : 8} color={INK['50']} />
        + time
      </span>
    );
  }

  // ─── Edit mode: branded time input ───
  return (
    <div
      ref={containerRef}
      className="inline-flex items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="inline-flex items-center gap-1 rounded-md"
        style={{
          background: 'var(--t-cream, #faf8f4)',
          border: '1px solid var(--t-verde-muted, rgba(42,122,86,0.25))',
          boxShadow: '0 1px 3px rgba(28,26,23,0.06)',
          padding: '2px 6px',
        }}
      >
        <ClockIcon size={compact ? 8 : 9} color="rgba(42,122,86,0.6)" />
        <input
          ref={inputRef}
          type="time"
          value={timeValue}
          onChange={(e) => setTimeValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') { setEditing(false); setTimeValue(specificTime || ''); }
          }}
          onBlur={handleSave}
          style={{
            fontFamily: FONT.mono,
            fontSize: compact ? 10 : 11,
            color: INK['85'],
            background: 'transparent',
            border: 'none',
            outline: 'none',
            width: 80,
            letterSpacing: '0.02em',
          }}
        />
      </div>
      {specificTime && (
        <button
          onClick={handleClear}
          className="flex items-center justify-center rounded-full hover:opacity-80 transition-opacity"
          style={{
            width: 16, height: 16,
            background: INK['08'],
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <PerriandIcon name="close" size={7} color={INK['55']} />
        </button>
      )}
    </div>
  );
}
