'use client';

import { useImportStore } from '@/stores/importStore';
import { INK } from '@/constants/theme';

/**
 * FloatingImportBar — small pill above TabBar showing background import progress.
 * Renders globally (in layout.tsx) so it persists across page navigation.
 * Tapping expands back to the full ImportDrawer at the results step.
 */
export default function FloatingImportBar() {
  const isProcessing = useImportStore(s => s.isProcessing);
  const isMinimized = useImportStore(s => s.isMinimized);
  const progressPercent = useImportStore(s => s.progressPercent);
  const progressLabel = useImportStore(s => s.progressLabel);
  const discoveredNames = useImportStore(s => s.discoveredNames);
  const importResults = useImportStore(s => s.importResults);
  const backgroundError = useImportStore(s => s.backgroundError);
  const patch = useImportStore(s => s.patch);
  const resetBackgroundTask = useImportStore(s => s.resetBackgroundTask);

  // Only show when minimized AND either processing or has results/error to show
  const isActive = isMinimized && (isProcessing || importResults.length > 0 || backgroundError);
  if (!isActive) return null;

  const isComplete = !isProcessing && importResults.length > 0 && !backgroundError;
  const isError = !!backgroundError;
  const placeCount = importResults.length || discoveredNames.length;

  function handleTap() {
    patch({ isMinimized: false, isOpen: true });
  }

  function handleDismissError() {
    resetBackgroundTask();
    patch({ isProcessing: false });
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 76, // above TabBar
        left: 0,
        right: 0,
        zIndex: 51,
        maxWidth: 480,
        margin: '0 auto',
        padding: '0 12px',
        pointerEvents: 'none',
      }}
    >
      <div
        onClick={isError ? handleDismissError : handleTap}
        style={{
          pointerEvents: 'auto',
          background: isError ? '#FFF0F0' : 'var(--t-cream)',
          border: `1.5px solid ${isError ? '#FFD0D0' : isComplete ? 'var(--t-honey)' : 'var(--t-linen)'}`,
          borderRadius: 16,
          padding: '12px 16px',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          transition: 'all 0.2s ease',
          ...(isComplete ? {
            animation: 'floatBarPulse 2s ease-in-out infinite',
          } : {}),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Status indicator */}
          {isError ? (
            <div style={{
              width: 28, height: 28, borderRadius: 14,
              background: '#FF6B6B', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, flexShrink: 0,
            }}>!</div>
          ) : isComplete ? (
            <div style={{
              width: 28, height: 28, borderRadius: 14,
              background: 'var(--t-honey)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, flexShrink: 0,
            }}>✓</div>
          ) : (
            <div style={{
              width: 28, height: 28, borderRadius: 14,
              background: 'var(--t-linen)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, overflow: 'hidden',
              position: 'relative',
            }}>
              {/* Mini circular progress */}
              <svg width="28" height="28" viewBox="0 0 28 28" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
                <circle cx="14" cy="14" r="11" fill="none" stroke="var(--t-travertine)" strokeWidth="3" />
                <circle
                  cx="14" cy="14" r="11" fill="none"
                  stroke="var(--t-honey)" strokeWidth="3"
                  strokeDasharray={`${(progressPercent / 100) * 69.1} 69.1`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 0.3s ease' }}
                />
              </svg>
              <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--t-ink)', position: 'relative', zIndex: 1 }}>
                {Math.round(progressPercent)}
              </span>
            </div>
          )}

          {/* Text content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: 13, fontWeight: 600, color: 'var(--t-ink)',
              margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              fontFamily: 'var(--font-sans)',
            }}>
              {isError ? 'Import failed' : isComplete ? 'Import ready' : progressLabel || 'Importing…'}
            </p>
            <p style={{
              fontSize: 11, color: INK['70'], margin: '2px 0 0',
              fontFamily: 'var(--font-sans)',
            }}>
              {isError
                ? 'Tap to dismiss'
                : isComplete
                  ? `${placeCount} place${placeCount === 1 ? '' : 's'} — tap to review`
                  : placeCount > 0
                    ? `${placeCount} place${placeCount === 1 ? '' : 's'} found so far`
                    : 'Working in background…'
              }
            </p>
          </div>

          {/* Expand chevron (not shown for errors) */}
          {!isError && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
              <path d="M4 10L8 6L12 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        {/* Progress bar for active imports */}
        {!isComplete && !isError && (
          <div style={{
            marginTop: 8,
            height: 3,
            borderRadius: 2,
            background: 'var(--t-linen)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, var(--t-honey), #E8A756)',
              borderRadius: 2,
              transition: 'width 0.3s ease',
            }} />
          </div>
        )}
      </div>

      {/* Pulse animation for completed state */}
      <style>{`
        @keyframes floatBarPulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
          50% { box-shadow: 0 4px 20px rgba(200,160,80,0.25); }
        }
      `}</style>
    </div>
  );
}
