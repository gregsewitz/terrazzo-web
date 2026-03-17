'use client';

import { useEffect, useState } from 'react';
import { onSaveStatus } from '@/lib/db-save';

/**
 * Floating save-status indicator.
 * Shows when saves are in progress, retrying, or have failed.
 * Invisible when idle — zero overhead for happy path.
 */
export default function SaveIndicator() {
  const [status, setStatus] = useState<'idle' | 'saving' | 'error' | 'retrying'>('idle');
  const [pending, setPending] = useState(0);
  const [lastError, setLastError] = useState<string>();
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    let successTimer: ReturnType<typeof setTimeout>;
    let prevStatus = 'idle';

    const unsub = onSaveStatus((s, p, err) => {
      // Show brief "Saved" flash when transitioning from saving → idle
      if (prevStatus === 'saving' && s === 'idle') {
        setShowSuccess(true);
        successTimer = setTimeout(() => setShowSuccess(false), 1500);
      }
      prevStatus = s;

      setStatus(s);
      setPending(p);
      setLastError(err);
    });

    return () => {
      unsub();
      clearTimeout(successTimer);
    };
  }, []);

  if (status === 'idle' && !showSuccess) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        padding: '8px 16px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        backdropFilter: 'blur(8px)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        transition: 'all 0.3s ease',
        ...(status === 'error'
          ? { background: 'rgba(220, 38, 38, 0.9)', color: '#fff' }
          : status === 'retrying'
          ? { background: 'rgba(234, 179, 8, 0.9)', color: '#000' }
          : showSuccess
          ? { background: 'rgba(22, 163, 74, 0.9)', color: '#fff' }
          : { background: 'rgba(0, 0, 0, 0.8)', color: '#fff' }),
      }}
    >
      {status === 'saving' && (
        <>
          <Spinner /> Saving{pending > 1 ? ` (${pending})` : ''}...
        </>
      )}
      {status === 'retrying' && (
        <>
          <span style={{ fontSize: 16 }}>⟳</span> {lastError || 'Retrying save...'}
        </>
      )}
      {status === 'error' && (
        <>
          <span style={{ fontSize: 16 }}>⚠</span> {lastError || 'Save failed'}
        </>
      )}
      {showSuccess && status === 'idle' && (
        <>
          <span style={{ fontSize: 16 }}>✓</span> Saved
        </>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      style={{
        width: 14,
        height: 14,
        border: '2px solid rgba(255,255,255,0.3)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        display: 'inline-block',
        animation: 'dbsave-spin 0.6s linear infinite',
      }}
    >
      <style>{`@keyframes dbsave-spin { to { transform: rotate(360deg) } }`}</style>
    </span>
  );
}
