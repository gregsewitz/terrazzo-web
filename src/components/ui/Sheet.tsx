'use client';

import type { ReactNode, MouseEvent } from 'react';

interface SheetProps {
  onClose: () => void;
  children: ReactNode;
  zIndex?: number;
  maxHeight?: '80dvh' | '90dvh' | 'full';
  showDragHandle?: boolean;
  stickyDragHandle?: boolean;
  backdropOpacity?: 30 | 40;
}

export default function Sheet({
  onClose,
  children,
  zIndex = 60,
  maxHeight = '90dvh',
  showDragHandle = false,
  stickyDragHandle = false,
  backdropOpacity = 30,
}: SheetProps) {
  const isFullScreen = maxHeight === 'full';

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

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
          maxWidth: 480,
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
