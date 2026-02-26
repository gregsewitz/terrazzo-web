'use client';

import React from 'react';
import { FONT, INK } from '@/constants/theme';

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
}

interface MenuItem {
  label: string;
  icon: string;
  action: () => void;
  destructive?: boolean;
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
}: DayContextMenuProps) {
  const items: (MenuItem | 'divider')[] = [
    { label: 'Add day before', icon: '↑+', action: onAddBefore },
    { label: 'Add day after', icon: '↓+', action: onAddAfter },
    { label: 'Duplicate day', icon: '⧉', action: onDuplicate },
    { label: 'Clear places', icon: '↩', action: onClear },
    'divider',
    ...(dayCount > 1
      ? [{ label: 'Delete day', icon: '×', action: onDelete, destructive: true } as MenuItem]
      : []),
  ];

  // Remove trailing divider if delete was hidden
  if (items[items.length - 1] === 'divider') items.pop();

  const isSheet = variant === 'sheet';

  const handleItemClick = (item: MenuItem) => {
    // For delete, don't close — the confirmation dialog will handle it
    if (item.destructive) {
      item.action();
    } else {
      item.action();
      onClose();
    }
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
          {/* Items */}
          {items.map((item, i) => {
            if (item === 'divider') {
              return <div key={`div-${i}`} style={{ height: 1, background: 'var(--t-linen)', margin: '4px 16px' }} />;
            }
            return (
              <button
                key={item.label}
                onClick={() => handleItemClick(item)}
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
                  color: item.destructive ? '#c0392b' : INK['85'],
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
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
        borderRadius: 10,
        boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
        border: '1px solid var(--t-linen)',
        padding: '4px 0',
        minWidth: 170,
        zIndex: 50,
      }}
    >
      {items.map((item, i) => {
        if (item === 'divider') {
          return <div key={`div-${i}`} style={{ height: 1, background: 'var(--t-linen)', margin: '4px 0' }} />;
        }
        return (
          <button
            key={item.label}
            onClick={() => handleItemClick(item)}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = item.destructive ? '#fef2f2' : 'var(--t-linen)';
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
              padding: '7px 12px',
              border: 'none',
              background: 'none',
              fontFamily: FONT.sans,
              fontSize: 12,
              fontWeight: 500,
              color: item.destructive ? '#c0392b' : INK['80'],
              cursor: 'pointer',
              borderRadius: 0,
              transition: 'background 100ms',
            }}
          >
            <span style={{
              width: 18,
              textAlign: 'center',
              fontSize: item.destructive ? 14 : 12,
              opacity: item.destructive ? 1 : 0.5,
            }}>
              {item.icon}
            </span>
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
