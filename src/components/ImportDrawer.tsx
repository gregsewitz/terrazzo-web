'use client';

import { useImportStore, ImportMode } from '@/stores/importStore';
import { useTripStore } from '@/stores/tripStore';

const IMPORT_MODES: { value: ImportMode; label: string; icon: string; description: string }[] = [
  { value: 'text', label: 'Paste Text', icon: '📝', description: "Paste a friend's list or notes" },
  { value: 'url', label: 'Paste URL', icon: '🔗', description: 'CN Traveller, YOLO Journal, etc.' },
  { value: 'google-maps', label: 'Google Maps', icon: '📍', description: 'Import from saved lists' },
  { value: 'email', label: 'Email Scan', icon: '✉️', description: 'Find booking confirmations' },
];

interface ImportDrawerProps {
  onClose: () => void;
}

export default function ImportDrawer({ onClose }: ImportDrawerProps) {
  const {
    mode, setMode, inputValue, setInputValue,
    isProcessing, setProcessing, detectedCount, setDetectedCount,
    error, setError, emailConnected,
  } = useImportStore();
  const addToPool = useTripStore(s => s.addToPool);

  async function handleImport() {
    if (!inputValue.trim() && mode !== 'email') return;
    setProcessing(true);
    setError(null);

    try {
      const endpoint = mode === 'url' ? '/api/import/url' : mode === 'text' ? '/api/import/text' : '/api/email/scan';
      const body = mode === 'email' ? {} : { content: inputValue };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Import failed');

      const data = await res.json();
      if (data.places?.length) {
        addToPool(data.places);
        setDetectedCount(data.places.length);
      } else {
        setError('No places found in the content');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setProcessing(false);
    }
  }

  async function handleConnectEmail() {
    try {
      const res = await fetch('/api/auth/nylas/connect');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError('Failed to connect email');
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />

      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl"
        style={{ maxWidth: 480, margin: '0 auto', background: 'var(--t-cream)' }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-8 h-1 rounded-full" style={{ background: 'var(--t-travertine)' }} />
        </div>

        <div className="px-4 pb-8">
          <h2
            className="text-lg mb-3"
            style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}
          >
            Import Places
          </h2>

          {/* Mode selector */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {IMPORT_MODES.map(m => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className="flex items-start gap-2 p-3 rounded-xl border-none cursor-pointer text-left transition-all"
                style={{
                  background: mode === m.value ? 'rgba(200,146,58,0.1)' : 'rgba(28,26,23,0.03)',
                  border: mode === m.value ? '1.5px solid var(--t-honey)' : '1.5px solid transparent',
                }}
              >
                <span className="text-lg">{m.icon}</span>
                <div>
                  <div className="text-[11px] font-semibold" style={{ color: 'var(--t-ink)' }}>{m.label}</div>
                  <div className="text-[9px] mt-0.5" style={{ color: 'rgba(28,26,23,0.5)' }}>{m.description}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Input area */}
          {mode === 'email' ? (
            <div className="text-center py-4">
              {emailConnected ? (
                <button
                  onClick={handleImport}
                  disabled={isProcessing}
                  className="px-6 py-2.5 rounded-full border-none cursor-pointer text-[12px] font-semibold"
                  style={{ background: 'var(--t-verde)', color: 'white', opacity: isProcessing ? 0.6 : 1 }}
                >
                  {isProcessing ? 'Scanning...' : '✉️ Scan Gmail for Bookings'}
                </button>
              ) : (
                <button
                  onClick={handleConnectEmail}
                  className="px-6 py-2.5 rounded-full border-none cursor-pointer text-[12px] font-semibold"
                  style={{ background: 'var(--t-panton-orange)', color: 'white' }}
                >
                  Connect Gmail
                </button>
              )}
            </div>
          ) : (
            <>
              <textarea
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder={
                  mode === 'url'
                    ? 'Paste article URL (e.g. cntraveller.com/...)'
                    : mode === 'google-maps'
                    ? 'Paste Google Maps list URL'
                    : "Paste your friend's recommendations..."
                }
                className="w-full h-28 p-3 rounded-xl text-[12px] resize-none border-none outline-none"
                style={{
                  background: 'rgba(28,26,23,0.04)',
                  color: 'var(--t-ink)',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              />
              <button
                onClick={handleImport}
                disabled={isProcessing || !inputValue.trim()}
                className="w-full mt-3 py-2.5 rounded-full border-none cursor-pointer text-[12px] font-semibold transition-opacity"
                style={{
                  background: 'var(--t-panton-orange)',
                  color: 'white',
                  opacity: isProcessing || !inputValue.trim() ? 0.5 : 1,
                }}
              >
                {isProcessing ? 'Parsing...' : `Import from ${mode === 'url' ? 'URL' : mode === 'google-maps' ? 'Google Maps' : 'Text'}`}
              </button>
            </>
          )}

          {/* Results / Error */}
          {detectedCount > 0 && (
            <div className="mt-3 p-3 rounded-xl text-center" style={{ background: 'rgba(42,122,86,0.08)' }}>
              <span className="text-[12px] font-semibold" style={{ color: 'var(--t-verde)' }}>
                ✓ {detectedCount} places imported to your pool
              </span>
            </div>
          )}

          {error && (
            <div className="mt-3 p-3 rounded-xl text-center" style={{ background: 'rgba(214,48,32,0.08)' }}>
              <span className="text-[12px]" style={{ color: 'var(--t-signal-red)' }}>{error}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
