'use client';

import React from 'react';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import { detectInputType } from '@/lib/import-helpers';
import type { ImportMode } from '@/stores/importStore';

interface ImportInputStepProps {
  onImport: () => void;
  onMapsImport: () => void;
  inputValue: string;
  onInputChange: (value: string) => void;
  mode: ImportMode;
  sourceName: string;
  onSourceNameChange: (name: string) => void;
  isProcessing: boolean;
  error: string | null;
  showMapsInput: boolean;
  setShowMapsInput: (show: boolean) => void;
  mapsUrl: string;
  setMapsUrl: (url: string) => void;
  onClose: () => void;
  isDesktop: boolean;
}

export const ImportInputStep = React.memo(function ImportInputStep({
  onImport,
  onMapsImport,
  inputValue,
  onInputChange,
  mode,
  sourceName,
  onSourceNameChange,
  isProcessing,
  error,
  showMapsInput,
  setShowMapsInput,
  mapsUrl,
  setMapsUrl,
  onClose,
  isDesktop,
}: ImportInputStepProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-1 mt-1">
        <h2
          style={{
            fontFamily: FONT.serif,
            color: 'var(--t-ink)',
            fontSize: isDesktop ? 22 : 20,
            fontStyle: 'italic',
          }}
        >
          Add places
        </h2>
        <button
          onClick={onClose}
          className="bg-transparent border-none cursor-pointer flex items-center justify-center w-8 h-8 rounded-full nav-hover"
          style={{ color: INK['80'] }}
        >
          <PerriandIcon name="close" size={16} color={INK['80']} />
        </button>
      </div>
      <p style={{ color: INK['85'], lineHeight: 1.5, fontSize: isDesktop ? 13 : 11, marginBottom: 16 }}>
        Paste anything — an article, a Google Maps list, a Substack, a text from a friend. We&apos;ll figure out the rest.
      </p>

      {/* Single magic text box */}
      <div
        className="rounded-2xl overflow-hidden mb-3 relative"
        style={{
          border: inputValue.trim() ? '2px solid var(--t-honey)' : '2px solid var(--t-linen)',
          background: 'white',
          transition: 'border-color 0.2s ease',
        }}
      >
        <textarea
          value={inputValue}
          onChange={e => {
            onInputChange(e.target.value);
          }}
          placeholder={`Paste a link, a message, or a list of places…\n\ne.g. a Condé Nast article, a Google Maps list,\na Substack post, or a text from a friend`}
          className="w-full p-4 text-[12px] resize-none border-none outline-none leading-relaxed"
          style={{ background: 'transparent', color: 'var(--t-ink)', fontFamily: FONT.sans, minHeight: 200 }}
        />
        {inputValue.length > 300 && (
          <div className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none" style={{ background: 'linear-gradient(transparent, white)' }} />
        )}
      </div>

      {/* Detected type indicator */}
      {inputValue.trim() && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="text-[10px]" style={{ color: INK['80'], fontFamily: FONT.mono }}>
            {mode === 'url' ? '🔗 Link detected' : mode === 'google-maps' ? '📍 Google Maps link detected' : '📋 Text'}
          </span>
          <span style={{ color: INK['15'] }}>·</span>
          <input
            type="text"
            value={sourceName}
            onChange={e => onSourceNameChange(e.target.value)}
            placeholder="Source name (optional)"
            className="text-[10px] bg-transparent border-none outline-none flex-1"
            style={{ color: '#8a6a2a', fontFamily: FONT.mono }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      <button
        onClick={onImport}
        disabled={isProcessing || !inputValue.trim()}
        className="w-full py-3.5 rounded-2xl border-none cursor-pointer text-[14px] font-semibold transition-all flex items-center justify-center gap-2"
        style={{ background: 'var(--t-ink)', color: 'white', opacity: isProcessing || !inputValue.trim() ? 0.35 : 1 }}
      >
        Find places
        <PerriandIcon name="terrazzo" size={16} color="white" />
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px" style={{ background: 'var(--t-linen)' }} />
        <span className="text-[10px]" style={{ color: INK['70'], fontFamily: FONT.mono }}>
          or
        </span>
        <div className="flex-1 h-px" style={{ background: 'var(--t-linen)' }} />
      </div>

      {/* Google Maps import */}
      {!showMapsInput ? (
        <button
          onClick={() => setShowMapsInput(true)}
          className="w-full py-3 rounded-2xl border-none cursor-pointer text-[13px] font-semibold transition-all flex items-center justify-center gap-2"
          style={{ background: 'white', color: 'var(--t-ink)', border: '1.5px solid var(--t-linen)' }}
        >
          <span style={{ fontSize: 16 }}>📍</span>
          Import from Google Maps
        </button>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '2px solid var(--t-honey)', background: 'white' }}>
          <div className="flex items-center gap-2 px-3 pt-3 pb-1">
            <span style={{ fontSize: 14 }}>📍</span>
            <span className="text-[11px] font-semibold" style={{ color: 'var(--t-ink)' }}>
              Google Maps saved list
            </span>
          </div>
          <input
            type="url"
            value={mapsUrl}
            onChange={e => setMapsUrl(e.target.value)}
            placeholder="Paste your maps.app.goo.gl link…"
            className="w-full px-3 py-2 text-[12px] border-none outline-none"
            style={{ background: 'transparent', color: 'var(--t-ink)', fontFamily: FONT.sans }}
            autoFocus
          />
          <div className="flex gap-2 px-3 pb-3">
            <button
              onClick={() => {
                setShowMapsInput(false);
                setMapsUrl('');
              }}
              className="flex-1 py-2 rounded-xl border-none cursor-pointer text-[11px]"
              style={{ background: 'var(--t-linen)', color: 'var(--t-ink)' }}
            >
              Cancel
            </button>
            <button
              onClick={onMapsImport}
              disabled={isProcessing || !mapsUrl.trim()}
              className="flex-1 py-2 rounded-xl border-none cursor-pointer text-[11px] font-semibold"
              style={{ background: 'var(--t-ink)', color: 'white', opacity: isProcessing || !mapsUrl.trim() ? 0.35 : 1 }}
            >
              Import list
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 rounded-xl text-center" style={{ background: 'rgba(214,48,32,0.08)' }}>
          <span className="text-[12px]" style={{ color: 'var(--t-signal-red)' }}>
            {error}
          </span>
        </div>
      )}
    </>
  );
});

ImportInputStep.displayName = 'ImportInputStep';
