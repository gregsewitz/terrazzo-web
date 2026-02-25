'use client';

import React, { useState } from 'react';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import type { TransportEvent, TransportMode, TRANSPORT_ICONS } from '@/types';

// ─── Mode config ───
const MODE_CONFIG: Record<TransportMode, { label: string; icon: string; color: string }> = {
  flight: { label: 'Flight', icon: 'discover', color: '#5b8cc0' },
  train: { label: 'Train', icon: 'plan', color: '#7a9a5a' },
  ferry: { label: 'Ferry', icon: 'discover', color: '#6a9ab0' },
  bus: { label: 'Bus', icon: 'plan', color: '#a08a6a' },
  drive: { label: 'Drive', icon: 'location', color: '#8a7a9a' },
  other: { label: 'Transport', icon: 'plan', color: '#9a8a7a' },
};

const MODE_OPTIONS: TransportMode[] = ['flight', 'train', 'ferry', 'bus', 'drive', 'other'];

// ─── Slot position mapping ───
const SLOT_ORDER = ['breakfast', 'morning', 'lunch', 'afternoon', 'dinner', 'evening'];

/** Parse a time string into hours (24h). Handles: "14:30", "2:30 PM", "11am", "2pm", "11 am", "14h30" */
function parseTimeHours(timeStr: string): number | null {
  const t = timeStr.trim();
  // "14:30" or "9:00"
  const match24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) return parseInt(match24[1]);
  // "2:30 PM" or "11:00am"
  const match12colon = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12colon) {
    let h = parseInt(match12colon[1]);
    if (match12colon[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (match12colon[3].toUpperCase() === 'AM' && h === 12) h = 0;
    return h;
  }
  // "11am", "2pm", "11 am", "2 PM" (no minutes)
  const matchBare = t.match(/^(\d{1,2})\s*(AM|PM)$/i);
  if (matchBare) {
    let h = parseInt(matchBare[1]);
    if (matchBare[2].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (matchBare[2].toUpperCase() === 'AM' && h === 12) h = 0;
    return h;
  }
  // "14h30" European style
  const matchEuro = t.match(/^(\d{1,2})h(\d{2})$/i);
  if (matchEuro) return parseInt(matchEuro[1]);
  // Plain number like "14" or "9" (assume 24h)
  const matchPlain = t.match(/^(\d{1,2})$/);
  if (matchPlain) {
    const h = parseInt(matchPlain[1]);
    if (h >= 0 && h <= 23) return h;
  }
  return null;
}

/** Derive afterSlot from departure time string */
function deriveAfterSlot(timeStr?: string): string | undefined {
  if (!timeStr) return undefined;
  const hours = parseTimeHours(timeStr);
  if (hours === null) return undefined;

  // Map time to slot boundary
  if (hours < 8) return undefined;          // before breakfast — render at top
  if (hours < 10) return 'breakfast';
  if (hours < 12) return 'morning';
  if (hours < 14) return 'lunch';
  if (hours < 19) return 'afternoon';
  if (hours < 21) return 'dinner';
  return 'evening';
}

// ═══════════════════════════════════════════
// TransportBanner — display component
// ═══════════════════════════════════════════

interface TransportBannerProps {
  transport: TransportEvent;
  onEdit?: () => void;
  onRemove?: () => void;
  compact?: boolean;
}

function TransportBannerComponent({ transport, onEdit, onRemove, compact = false }: TransportBannerProps) {
  const config = MODE_CONFIG[transport.mode];
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flex items-center gap-2 relative"
      style={{
        padding: compact ? '4px 8px' : '6px 12px',
        background: `${config.color}08`,
        borderTop: `1px dashed ${config.color}30`,
        borderBottom: `1px dashed ${config.color}30`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Mode icon */}
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: compact ? 22 : 26,
          height: compact ? 22 : 26,
          borderRadius: 6,
          background: `${config.color}18`,
        }}
      >
        <PerriandIcon name={config.icon as any} size={compact ? 11 : 13} color={config.color} />
      </div>

      {/* Content */}
      <div className="flex flex-col min-w-0 flex-1" style={{ gap: 0 }}>
        <div className="flex items-center gap-1.5">
          {transport.departureTime && (
            <span style={{
              fontFamily: FONT.mono,
              fontSize: compact ? 9 : 10,
              fontWeight: 700,
              color: config.color,
            }}>
              {transport.departureTime}
            </span>
          )}
          <span
            className="truncate"
            style={{
              fontFamily: FONT.sans,
              fontSize: compact ? 10 : 11,
              fontWeight: 600,
              color: 'var(--t-ink)',
            }}
          >
            {config.label} {transport.from} → {transport.to}
          </span>
        </div>
        {(transport.details || transport.arrivalTime) && (
          <span style={{
            fontFamily: FONT.mono,
            fontSize: compact ? 9 : 10,
            color: INK['55'],
          }}>
            {transport.details}
            {transport.details && transport.arrivalTime ? ' · ' : ''}
            {transport.arrivalTime ? `arr. ${transport.arrivalTime}` : ''}
          </span>
        )}
      </div>

      {/* Confirmed badge */}
      {transport.isConfirmed && (
        <div
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ background: 'rgba(42,122,86,0.1)' }}
        >
          <PerriandIcon name="check" size={8} color="var(--t-verde)" />
          <span style={{ fontFamily: FONT.mono, fontSize: 8, fontWeight: 700, color: 'var(--t-verde)' }}>
            Booked
          </span>
        </div>
      )}

      {/* Hover actions */}
      {hovered && (onEdit || onRemove) && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center justify-center"
              style={{
                width: 20, height: 20, borderRadius: 4,
                background: INK['06'], border: 'none', cursor: 'pointer',
              }}
            >
              <PerriandIcon name="edit" size={10} color={INK['50']} />
            </button>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              className="flex items-center justify-center"
              style={{
                width: 20, height: 20, borderRadius: 4,
                background: INK['06'], border: 'none', cursor: 'pointer',
              }}
            >
              <PerriandIcon name="close" size={10} color={INK['50']} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const TransportBanner = React.memo(TransportBannerComponent);

// ═══════════════════════════════════════════
// TransportInput — add/edit form
// ═══════════════════════════════════════════

interface TransportInputProps {
  initial?: Partial<TransportEvent>;
  onSave: (transport: Omit<TransportEvent, 'id'>) => void;
  onCancel: () => void;
  /** Current day's destination, used as default "from" */
  fromDefault?: string;
  compact?: boolean;
}

export function TransportInput({ initial, onSave, onCancel, fromDefault, compact = false }: TransportInputProps) {
  const [mode, setMode] = useState<TransportMode>(initial?.mode || 'flight');
  const [from, setFrom] = useState(initial?.from || fromDefault || '');
  const [to, setTo] = useState(initial?.to || '');
  const [departureTime, setDepartureTime] = useState(initial?.departureTime || '');
  const [arrivalTime, setArrivalTime] = useState(initial?.arrivalTime || '');
  const [details, setDetails] = useState(initial?.details || '');

  const handleSave = () => {
    if (!from.trim() || !to.trim()) return;
    onSave({
      mode,
      from: from.trim(),
      to: to.trim(),
      departureTime: departureTime.trim() || undefined,
      arrivalTime: arrivalTime.trim() || undefined,
      details: details.trim() || undefined,
      afterSlot: deriveAfterSlot(departureTime.trim()),
    });
  };

  const fontSize = compact ? 10 : 11;
  const inputStyle: React.CSSProperties = {
    fontFamily: FONT.sans,
    fontSize,
    fontWeight: 500,
    color: 'var(--t-ink)',
    background: 'transparent',
    border: 'none',
    borderBottom: `1px solid ${INK['20']}`,
    outline: 'none',
    padding: '2px 4px',
  };

  return (
    <div
      className="flex flex-col gap-2"
      style={{
        padding: compact ? '8px 10px' : '10px 14px',
        background: 'white',
        borderTop: `1px dashed ${INK['20']}`,
        borderBottom: `1px dashed ${INK['20']}`,
      }}
    >
      {/* Mode picker */}
      <div className="flex flex-wrap gap-1">
        {MODE_OPTIONS.map(m => {
          const c = MODE_CONFIG[m];
          const active = mode === m;
          return (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex items-center gap-1 px-2 py-1 rounded-full cursor-pointer transition-all"
              style={{
                fontFamily: FONT.mono,
                fontSize: 9,
                fontWeight: active ? 700 : 500,
                color: active ? 'white' : INK['50'],
                background: active ? c.color : INK['06'],
                border: 'none',
              }}
            >
              <PerriandIcon name={c.icon as any} size={9} color={active ? 'white' : INK['55']} />
              {c.label}
            </button>
          );
        })}
      </div>

      {/* From → To */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={from}
          onChange={e => setFrom(e.target.value)}
          placeholder="From…"
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
          autoFocus
        />
        <span style={{ fontFamily: FONT.sans, fontSize: 11, color: INK['55'] }}>→</span>
        <input
          type="text"
          value={to}
          onChange={e => setTo(e.target.value)}
          placeholder="To…"
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          onKeyDown={e => {
            if (e.key === 'Escape') onCancel();
            if (e.key === 'Enter') handleSave();
          }}
        />
      </div>

      {/* Times + details */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={departureTime}
          onChange={e => setDepartureTime(e.target.value)}
          placeholder="Departs (e.g. 14:30)"
          style={{ ...inputStyle, width: 100 }}
          onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
        />
        <input
          type="text"
          value={arrivalTime}
          onChange={e => setArrivalTime(e.target.value)}
          placeholder="Arrives"
          style={{ ...inputStyle, width: 80 }}
          onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
        />
        <input
          type="text"
          value={details}
          onChange={e => setDetails(e.target.value)}
          placeholder="Flight #, ref…"
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          onKeyDown={e => {
            if (e.key === 'Escape') onCancel();
            if (e.key === 'Enter') handleSave();
          }}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1 rounded-full cursor-pointer"
          style={{
            fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
            color: INK['50'], background: INK['06'], border: 'none',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1 rounded-full cursor-pointer"
          style={{
            fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
            color: 'white',
            background: from.trim() && to.trim() ? 'var(--t-ink)' : INK['20'],
            border: 'none',
            opacity: from.trim() && to.trim() ? 1 : 0.5,
          }}
        >
          {initial ? 'Update' : 'Add'}
        </button>
      </div>
    </div>
  );
}

/** Resolve afterSlot — use stored value, or re-derive from departureTime */
function resolveAfterSlot(t: TransportEvent): string | undefined {
  if (t.afterSlot) return t.afterSlot;
  // Re-derive for transports saved before the parser was improved
  return deriveAfterSlot(t.departureTime);
}

// ─── Helper: get transports that should render after a given slot ───
export function getTransportsAfterSlot(
  transports: TransportEvent[] | undefined,
  slotId: string,
): TransportEvent[] {
  if (!transports?.length) return [];
  return transports.filter(t => resolveAfterSlot(t) === slotId);
}

/** Transports that should render before the first slot (early departures) */
export function getTransportsBeforeSlots(
  transports: TransportEvent[] | undefined,
): TransportEvent[] {
  if (!transports?.length) return [];
  return transports.filter(t => !resolveAfterSlot(t));
}
