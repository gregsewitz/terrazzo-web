'use client';

import type { ReactNode, MouseEvent } from 'react';
import { useIsDesktop } from '@/hooks/useBreakpoint';

interface SheetProps {
  onClose: () => void;
  children: ReactNode;
  zIndex?: number;
  maxHeight?: '80dvh' | '90dvh' | 'full';
  showDragHandle?: boolean;
  stickyDragHandle?: boolean;
  backdropOpacity?: 30 | 40;
  /** Desktop rendering mode: bottom (default mobile sheet), right (side panel), center (modal dialog) */
  position?: 'bottom' | 'right' | 'center';
  /** Title shown in the header bar for right-panel and center-modal modes */
  title?: string;
  /** Width for right-panel mode (default 420) or max-width for center-modal mode (default 520) */
  panelWidth?: number;
}

export default function Sheet({
  onClose,
  children,
  zIndex = 60,
  maxHeight = '90dvh',
  showDragHandle = false,
  stickyDragHandle = false,
  backdropOpacity = 30,
  position = 'bottom',
  title,
  panelWidth,
}: SheetProps) {
  const isDesktop = useIsDesktop();
  const isFullScreen = maxHeight === 'full';

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // ─── Desktop: Right slide-out panel ───
  if (isDesktop && position === 'right') {
    const width = panelWidth || 420;
    return (
      <>
        <div
          className="fixed inset-0 fade-in-backdrop"
          style={{ zIndex, background: `rgba(0,0,0,${backdropOpacity / 100})` }}
          onClick={handleBackdropClick}
        />
        <div
          className="fixed top-0 right-0 bottom-0 slide-in-right flex flex-col"
          style={{
            zIndex,
            width,
            background: 'var(--t-cream)',
            boxShadow: '-8px 0 32px rgba(0,0,0,0.08)',
          }}
        >
          {/* Panel header */}
          <div
            className="flex items-center justify-between px-5 flex-shrink-0"
            style={{
              height: 56,
              borderBottom: '1px solid var(--t-linen)',
            }}
          >
            {title ? (
              <span style={{
                fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif",
                fontSize: 18,
                fontStyle: 'italic',
                color: 'var(--t-ink)',
              }}>
                {title}
              </span>
            ) : <span />}
            <button
              onClick={onClose}
              className="flex items-center justify-center border-none cursor-pointer rounded-full"
              style={{
                width: 32,
                height: 32,
                background: 'rgba(28,26,23,0.04)',
                color: 'var(--t-ink)',
                fontSize: 16,
                transition: 'background 150ms ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(28,26,23,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(28,26,23,0.04)')}
            >
              ✕
            </button>
          </div>
          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </div>
      </>
    );
  }

  // ─── Desktop: Centered modal ───
  if (isDesktop && position === 'center') {
    const maxW = panelWidth || 520;
    return (
      <>
        <div
          className="fixed inset-0 fade-in-backdrop"
          style={{ zIndex, background: `rgba(0,0,0,${backdropOpacity / 100})` }}
          onClick={handleBackdropClick}
        />
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex, pointerEvents: 'none' }}
        >
          <div
            className="rounded-2xl overflow-hidden flex flex-col"
            style={{
              pointerEvents: 'auto',
              width: '90vw',
              maxWidth: maxW,
              maxHeight: '80vh',
              background: 'var(--t-cream)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              opacity: 0, animation: 'fadeInUp 200ms ease both',
            }}
          >
            {/* Modal header */}
            {title && (
              <div
                className="flex items-center justify-between px-5 flex-shrink-0"
                style={{
                  height: 52,
                  borderBottom: '1px solid var(--t-linen)',
                }}
              >
                <span style={{
                  fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif",
                  fontSize: 17,
                  fontStyle: 'italic',
                  color: 'var(--t-ink)',
                }}>
                  {title}
                </span>
                <button
                  onClick={onClose}
                  className="flex items-center justify-center border-none cursor-pointer rounded-full"
                  style={{
                    width: 28,
                    height: 28,
                    background: 'rgba(28,26,23,0.04)',
                    color: 'var(--t-ink)',
                    fontSize: 14,
                    transition: 'background 150ms ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(28,26,23,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(28,26,23,0.04)')}
                >
                  ✕
                </button>
              </div>
            )}
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── Default: Bottom sheet (mobile + fallback) ───
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{
          zIndex,
          background: `rgba(0,0,0,${backdropOpacity / 100})`,
        }}
        onClick={handleBackdropClick}
      />

      {/* Sheet container */}
      <div
        className={`fixed left-0 right-0 overflow-y-auto ${isFullScreen ? 'inset-0' : 'bottom-0 rounded-t-2xl'}`}
        style={{
          zIndex,
          maxWidth: 560,
          margin: '0 auto',
          maxHeight: isFullScreen ? undefined : maxHeight,
          background: 'var(--t-cream)',
        }}
      >
        {/* Drag handle */}
        {showDragHandle && (
          <div
            className={`flex justify-center pt-3 pb-1 ${stickyDragHandle ? 'sticky top-0' : ''}`}
            style={stickyDragHandle ? { background: 'var(--t-cream)', zIndex: 1 } : undefined}
          >
            <div
              className="w-8 h-1 rounded-full"
              style={{ background: 'var(--t-travertine)' }}
            />
          </div>
        )}

        {children}
      </div>
    </>
  );
}
