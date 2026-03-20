'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { FONT, COLOR } from '@/constants/theme';

/**
 * Floating undo button for the Day Planner.
 * Appears in the bottom-right when undo is available.
 * Also handles Cmd+Z / Ctrl+Z keyboard shortcut and Cmd+Shift+Z / Ctrl+Shift+Z for redo.
 */
export default function UndoFloatingButton() {
  const undo = useTripStore(s => s.undo);
  const redo = useTripStore(s => s.redo);
  const canUndo = useTripStore(s => s.canUndo);
  const canRedo = useTripStore(s => s.canRedo);
  const undoLabel = useTripStore(s => s.undoLabel);

  const hasUndo = canUndo();
  const hasRedo = canRedo();
  const label = undoLabel();

  // Show/hide with a brief delay after last action for entrance animation
  const [visible, setVisible] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (hasUndo) {
      setVisible(true);
    } else {
      // Small delay before hiding so exit animation can play
      const t = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(t);
    }
  }, [hasUndo]);

  // Keyboard shortcut handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isMeta = e.metaKey || e.ctrlKey;
    if (!isMeta) return;

    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (canUndo()) undo();
    } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
      e.preventDefault();
      if (canRedo()) redo();
    }
  }, [undo, redo, canUndo, canRedo]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 100, // above the bottom tab bar
        right: 16,
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
        opacity: hasUndo ? 1 : 0,
        transform: hasUndo ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(8px)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        pointerEvents: hasUndo ? 'auto' : 'none',
      }}
    >
      {/* Tooltip */}
      {showTooltip && label && (
        <div
          style={{
            background: `var(--t-ink, ${COLOR.navy})`,
            color: 'var(--t-cream, #faf8f5)',
            padding: '5px 10px',
            borderRadius: 8,
            fontSize: 11,
            fontFamily: FONT.sans,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          Undo: {label}
          <span
            style={{
              marginLeft: 6,
              padding: '1px 4px',
              borderRadius: 3,
              background: 'rgba(255,255,255,0.15)',
              fontSize: 10,
              fontFamily: FONT.mono,
            }}
          >
            ⌘Z
          </span>
        </div>
      )}

      {/* Undo button */}
      <button
        onClick={() => { if (hasUndo) undo(); }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label={`Undo${label ? `: ${label}` : ''}`}
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: 'none',
          background: `var(--t-ink, ${COLOR.navy})`,
          color: 'var(--t-cream, #faf8f5)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,42,85,0.25), 0 1px 3px rgba(0,42,85,0.15)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
        onPointerDown={(e) => {
          const btn = e.currentTarget;
          btn.style.transform = 'scale(0.92)';
        }}
        onPointerUp={(e) => {
          const btn = e.currentTarget;
          btn.style.transform = 'scale(1)';
        }}
        onPointerLeave={(e) => {
          const btn = e.currentTarget;
          btn.style.transform = 'scale(1)';
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      </button>
    </div>
  );
}
