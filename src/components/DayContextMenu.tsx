'use client';

import React, { useState } from 'react';
import { FONT, INK } from '@/constants/theme';
import AddDestinationSearch from './AddDestinationSearch';

export interface DayContextMenuProps {
  dayNumber: number;
  dayCount: number;
  onAddBefore: () => void;
  onAddAfter: () => void;
  onDuplicate: () => void;
  onClear: () => void;
  onDelete: () => void;
  onClose: () => void;
  /** 'popover' for desktop dropdown, 'sheet' for mobile bottom sheet */
  variant?: 'popover' | 'sheet';
  // Reorder support
  onMoveEarlier?: () => void;
  onMoveLater?: () => void;
  // Destination change support
  currentDestination?: string;
  uniqueDestinations?: string[];
  getDestColor?: (dest: string) => { accent: string; bg: string; text: string };
  onChangeDestination?: (dest: string) => void;
}

interface MenuItem {
  label: string;
  icon: string;
  action: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export default function DayContextMenu({
  dayNumber,
  dayCount,
  onAddBefore,
  onAddAfter,
  onDuplicate,
  onClear,
  onDelete,
  onClose,
  variant = 'popover',
  onMoveEarlier,
  onMoveLater,
  currentDestination,
  uniqueDestinations,
  getDestColor,
  onChangeDestination,
}: DayContextMenuProps) {
  const [showDestPicker, setShowDestPicker] = useState(false);
  const [showAddDest, setShowAddDest] = useState(false);

  const items: (MenuItem | 'divider')[] = [
    ...(onMoveEarlier ? [{ label: 'Move earlier', icon: '←', action: onMoveEarlier, disabled: dayNumber <= 1 } as MenuItem] : []),
    ...(onMoveLater ? [{ label: 'Move later', icon: '→', action: onMoveLater, disabled: dayNumber >= dayCount } as MenuItem] : []),
    ...((onMoveEarlier || onMoveLater) ? ['divider' as const] : []),
    { label: 'Add day before', icon: '↑+', action: onAddBefore },
    { label: 'Add day after', icon: '↓+', action: onAddAfter },
    { label: 'Duplicate day', icon: '⧉', action: onDuplicate },
    'divider',
    { label: 'Clear places', icon: '↩', action: onClear },
    ...(dayCount > 1
      ? [{ label: 'Delete day', icon: '×', action: onDelete, destructive: true } as MenuItem]
      : []),
  ];

  // Remove trailing divider if delete was hidden
  if (items[items.length - 1] === 'divider') items.pop();

  const isSheet = variant === 'sheet';

  const handleItemClick = (item: MenuItem) => {
    if (item.disabled) return;
    if (item.destructive) {
      item.action();
    } else {
      item.action();
      onClose();
    }
  };

  // Destination picker sub-view (sheet only)
  const renderDestPicker = () => {
    if (!uniqueDestinations || !getDestColor || !onChangeDestination) return null;

    if (showAddDest) {
      return (
        <div style={{ padding: '0 16px 16px' }}>
          <AddDestinationSearch
            onAdded={() => {
              setShowAddDest(false);
              setShowDestPicker(false);
              onClose();
            }}
            onCancel={() => setShowAddDest(false)}
          />
        </div>
      );
    }

    return (
      <div style={{ padding: '0 16px 8px' }}>
        {uniqueDestinations.map(dest => {
          const isCurrent = dest === currentDestination;
          const destC = getDestColor(dest);
          return (
            <button
              key={dest}
              onClick={() => {
                if (!isCurrent) onChangeDestination(dest);
                setShowDestPicker(false);
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                textAlign: 'left',
                padding: '12px 8px',
                borderRadius: 10,
                border: 'none',
                background: isCurrent ? destC.bg : 'transparent',
                fontFamily: FONT.sans,
                fontSize: 15,
                color: 'var(--t-ink)',
                cursor: isCurrent ? 'default' : 'pointer',
                fontWeight: isCurrent ? 600 : 400,
                opacity: isCurrent ? 0.5 : 1,
              }}
            >
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: destC.accent, flexShrink: 0,
              }} />
              {dest}
              {isCurrent && (
                <span style={{ marginLeft: 'auto', fontSize: 12, color: INK['40'] }}>current</span>
              )}
            </button>
          );
        })}
        <button
          onClick={() => setShowAddDest(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            textAlign: 'left',
            padding: '12px 8px',
            marginTop: 4,
            borderRadius: 10,
            border: 'none',
            borderTop: '1px solid var(--t-linen)',
            background: 'transparent',
            fontFamily: FONT.sans,
            fontSize: 14,
            color: INK['50'],
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          New destination
        </button>
      </div>
    );
  };

  if (isSheet) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}
        onClick={onClose}
      >
        {/* Backdrop */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
        {/* Sheet */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'relative',
            background: 'white',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            padding: '8px 0 env(safe-area-inset-bottom, 16px)',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
          }}
        >
          {/* Handle bar */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: INK['55'] + '40' }} />
          </div>
          {/* Title */}
          <div style={{
            fontFamily: FONT.sans,
            fontSize: 13,
            fontWeight: 600,
            color: INK['70'],
            textAlign: 'center',
            padding: '4px 0 8px',
          }}>
            Day {dayNumber}
          </div>

          {showDestPicker ? (
            <>
              {/* Back button + dest picker */}
              <button
                onClick={() => setShowDestPicker(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 20px 12px',
                  border: 'none',
                  background: 'none',
                  fontFamily: FONT.sans,
                  fontSize: 13,
                  fontWeight: 500,
                  color: INK['50'],
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 14 }}>‹</span> Back
              </button>
              {renderDestPicker()}
            </>
          ) : (
            <>
              {/* Destination row — tappable to open dest picker */}
              {onChangeDestination && currentDestination && getDestColor && (
                <>
                  <button
                    onClick={() => setShowDestPicker(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: '100%',
                      textAlign: 'left',
                      padding: '14px 20px',
                      border: 'none',
                      background: 'none',
                      fontFamily: FONT.sans,
                      fontSize: 15,
                      fontWeight: 500,
                      color: INK['85'],
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{
                      width: 24,
                      textAlign: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <span style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: getDestColor(currentDestination).accent,
                      }} />
                    </span>
                    <span style={{ flex: 1 }}>{currentDestination}</span>
                    <span style={{ fontSize: 12, color: INK['40'] }}>Change ›</span>
                  </button>
                  <div style={{ height: 1, background: 'var(--t-linen)', margin: '4px 16px' }} />
                </>
              )}

              {/* Menu items */}
              {items.map((item, i) => {
                if (item === 'divider') {
                  return <div key={`div-${i}`} style={{ height: 1, background: 'var(--t-linen)', margin: '4px 16px' }} />;
                }
                return (
                  <button
                    key={item.label}
                    onClick={() => handleItemClick(item)}
                    disabled={item.disabled}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: '100%',
                      textAlign: 'left',
                      padding: '14px 20px',
                      border: 'none',
                      background: 'none',
                      fontFamily: FONT.sans,
                      fontSize: 15,
                      fontWeight: 500,
                      color: item.disabled
                        ? INK['30']
                        : item.destructive ? '#c0392b' : INK['85'],
                      cursor: item.disabled ? 'default' : 'pointer',
                      WebkitTapHighlightColor: 'transparent',
                      opacity: item.disabled ? 0.5 : 1,
                    }}
                  >
                    <span style={{
                      width: 24,
                      textAlign: 'center',
                      fontSize: item.destructive ? 18 : 16,
                      opacity: item.destructive ? 1 : 0.6,
                    }}>
                      {item.icon}
                    </span>
                    {item.label}
                  </button>
                );
              })}
            </>
          )}

          {/* Cancel button */}
          <div style={{ padding: '4px 16px 8px' }}>
            <button
              onClick={onClose}
              style={{
                width: '100%',
                padding: '12px',
                border: 'none',
                borderRadius: 12,
                background: 'var(--t-linen)',
                fontFamily: FONT.sans,
                fontSize: 15,
                fontWeight: 600,
                color: INK['70'],
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Desktop popover variant
  return (
    <div
      style={{
        background: 'white',
        borderRadius: 12,
        boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
        border: '1px solid var(--t-linen)',
        padding: 0,
        minWidth: 200,
        zIndex: 50,
        overflow: 'hidden',
      }}
    >
      {/* ── Location section ── */}
      {onChangeDestination && currentDestination && getDestColor && (
        <div style={{ padding: '8px 6px 6px' }}>
          <div style={{ padding: '2px 8px 6px' }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['70'], textTransform: 'uppercase' as const, letterSpacing: 0.8, fontWeight: 600 }}>
              Location
            </span>
          </div>
          {showAddDest ? (
            <div style={{ padding: '0 4px 4px' }}>
              <AddDestinationSearch
                onAdded={() => {
                  setShowAddDest(false);
                  onClose();
                }}
                onCancel={() => setShowAddDest(false)}
              />
            </div>
          ) : (
            <>
              {uniqueDestinations?.map(dest => {
                const isCurrent = dest === currentDestination;
                const destC = getDestColor(dest);
                return (
                  <button
                    key={dest}
                    onClick={() => {
                      if (!isCurrent) onChangeDestination(dest);
                      onClose();
                    }}
                    onMouseEnter={(e) => {
                      if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'var(--t-linen)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = isCurrent ? destC.bg : 'transparent';
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 8px',
                      borderRadius: 6,
                      border: 'none',
                      background: isCurrent ? destC.bg : 'transparent',
                      fontFamily: FONT.sans,
                      fontSize: 12,
                      color: INK['85'],
                      cursor: isCurrent ? 'default' : 'pointer',
                      fontWeight: isCurrent ? 600 : 400,
                      transition: 'background 100ms',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: destC.accent, flexShrink: 0 }} />
                    {dest}
                    {isCurrent && (
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: INK['70'], fontWeight: 400 }}>✓</span>
                    )}
                  </button>
                );
              })}
              <button
                onClick={() => setShowAddDest(true)}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--t-linen)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 8px',
                  marginTop: 2,
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  fontFamily: FONT.sans,
                  fontSize: 12,
                  color: INK['70'],
                  cursor: 'pointer',
                  transition: 'background 100ms',
                }}
              >
                <span style={{ fontSize: 13, lineHeight: 1, width: 8, textAlign: 'center' }}>+</span>
                New destination
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Day actions section ── */}
      <div style={{
        padding: '6px 6px 6px',
        borderTop: onChangeDestination && currentDestination ? '1px solid var(--t-linen)' : 'none',
      }}>
        <div style={{ padding: '2px 8px 6px' }}>
          <span style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['70'], textTransform: 'uppercase' as const, letterSpacing: 0.8, fontWeight: 600 }}>
            Day
          </span>
        </div>
        {items.map((item, i) => {
          if (item === 'divider') {
            return <div key={`div-${i}`} style={{ height: 1, background: 'var(--t-linen)', margin: '3px 8px' }} />;
          }
          return (
            <button
              key={item.label}
              onClick={() => handleItemClick(item)}
              disabled={item.disabled}
              onMouseEnter={(e) => {
                if (!item.disabled) (e.currentTarget as HTMLElement).style.background = item.destructive ? '#fef2f2' : 'var(--t-linen)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'none';
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                textAlign: 'left',
                padding: '6px 8px',
                border: 'none',
                background: 'none',
                fontFamily: FONT.sans,
                fontSize: 12,
                fontWeight: 500,
                color: item.disabled ? INK['30'] : item.destructive ? '#c0392b' : INK['80'],
                cursor: item.disabled ? 'default' : 'pointer',
                borderRadius: 6,
                transition: 'background 100ms',
                opacity: item.disabled ? 0.5 : 1,
              }}
            >
              <span style={{
                width: 18,
                textAlign: 'center',
                fontSize: item.destructive ? 14 : 12,
                opacity: item.destructive ? 1 : 0.6,
              }}>
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
