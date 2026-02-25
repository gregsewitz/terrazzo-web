'use client';

import React from 'react';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import { ImportedPlace, GhostSourceType, SOURCE_STYLES } from '@/types';

interface ImportSuccessStepProps {
  savedPlaces: ImportedPlace[];
  sourceName: string;
  detectedDestination: string;
  createdCollectionName: string;
  onClose: () => void;
  onImportMore: () => void;
  isDesktop: boolean;
}

export const ImportSuccessStep = React.memo(function ImportSuccessStep({
  savedPlaces,
  sourceName,
  detectedDestination,
  createdCollectionName,
  onClose,
  onImportMore,
  isDesktop,
}: ImportSuccessStepProps) {
  // Top matches for success screen
  const topMatches = React.useMemo(() => {
    return [...savedPlaces].sort((a, b) => b.matchScore - a.matchScore).slice(0, 4);
  }, [savedPlaces]);

  return (
    <>
      {/* Success banner */}
      <div className="flex items-center gap-3 rounded-2xl p-4 mt-1 mb-4" style={{ background: 'rgba(42,122,86,0.06)' }}>
        <div className="text-2xl">
          <PerriandIcon name="check" size={28} color="var(--t-verde)" />
        </div>
        <div>
          <div className="text-[13px] font-semibold" style={{ color: 'var(--t-verde)' }}>
            {savedPlaces.length} places saved
          </div>
          <div className="text-[10px]" style={{ color: INK['95'] }}>
            {sourceName ? `From "${sourceName}"` : 'From pasted content'}
            {detectedDestination ? ` · ${detectedDestination}` : ''}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl text-center border-none cursor-pointer flex flex-col items-center"
          style={{ background: 'var(--t-linen)' }}
        >
          <div className="mb-0.5">
            <PerriandIcon name="trips" size={18} color="var(--t-ink)" />
          </div>
          <div className="text-[10px] font-semibold" style={{ color: 'var(--t-ink)' }}>
            View collection
          </div>
        </button>
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl text-center border-none cursor-pointer flex flex-col items-center"
          style={{ background: 'var(--t-linen)' }}
        >
          <div className="mb-0.5">
            <PerriandIcon name="discover" size={18} color="var(--t-ink)" />
          </div>
          <div className="text-[10px] font-semibold" style={{ color: 'var(--t-ink)' }}>
            Start a trip
          </div>
        </button>
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl text-center border-none cursor-pointer flex flex-col items-center"
          style={{ background: 'var(--t-linen)' }}
        >
          <div className="mb-0.5">
            <PerriandIcon name="pin" size={18} color="var(--t-ink)" />
          </div>
          <div className="text-[10px] font-semibold" style={{ color: 'var(--t-ink)' }}>
            View on map
          </div>
        </button>
      </div>

      {/* Auto-created collection card */}
      <div className="rounded-2xl overflow-hidden mb-4" style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
        <div className="relative" style={{ height: 100, background: 'linear-gradient(135deg, #d8c8a8, #c0b090, #b8a888)' }}>
          {[30, 50, 35, 60, 40].map((top, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{ top, left: 60 + i * 50, width: 10, height: 10, background: 'var(--t-honey)', opacity: 0.8 }}
            />
          ))}
          <div
            className="absolute bottom-2 left-3 px-2 py-0.5 rounded-md text-[9px] text-white"
            style={{ background: 'rgba(0,0,0,0.4)' }}
          >
            {detectedDestination || 'Import'}
          </div>
        </div>
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold" style={{ color: 'var(--t-ink)' }}>
                {createdCollectionName}
              </div>
              <div className="text-[10px]" style={{ color: INK['95'] }}>
                {savedPlaces.length} places · auto-created collection
              </div>
            </div>
            <div className="text-[12px]" style={{ color: '#8a6a2a' }}>
              →
            </div>
          </div>
        </div>
      </div>

      {/* Top matches for you */}
      {topMatches.length > 0 && (
        <>
          <div
            className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1"
            style={{ color: '#8a6a2a', fontFamily: FONT.mono, letterSpacing: '1px' }}
          >
            <PerriandIcon name="terrazzo" size={12} color="var(--t-honey)" />
            Top matches for you
          </div>

          {topMatches.map(place => {
            const sourceStyle = place.ghostSource ? SOURCE_STYLES[place.ghostSource as GhostSourceType] : null;
            return (
              <div
                key={place.id}
                className="flex gap-2.5 rounded-xl p-3 mb-2"
                style={{ background: 'white', border: '1px solid var(--t-linen)' }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${sourceStyle?.color || '#c8923a'}30, ${sourceStyle?.color || '#c8923a'}15)`,
                    color: sourceStyle?.color || '#8a6a2a',
                    fontFamily: FONT.mono,
                  }}
                >
                  {place.matchScore}%
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold" style={{ color: 'var(--t-ink)' }}>
                    {place.name}
                  </div>
                  <div className="text-[10px]" style={{ color: INK['95'] }}>
                    {place.type.charAt(0).toUpperCase() + place.type.slice(1)} · {place.location}
                  </div>
                  {place.tasteNote && (
                    <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--t-ghost)', fontStyle: 'italic' }}>
                      &ldquo;{place.tasteNote}&rdquo;
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Done button */}
      <button
        onClick={onClose}
        className="w-full mt-4 py-3 rounded-2xl border-none cursor-pointer text-[13px] font-semibold"
        style={{ background: 'var(--t-ink)', color: 'white' }}
      >
        Done
      </button>

      <button
        onClick={onImportMore}
        className="w-full mt-2 py-2 bg-transparent border-none cursor-pointer text-[11px]"
        style={{ color: INK['95'] }}
      >
        Import more places
      </button>
    </>
  );
});

ImportSuccessStep.displayName = 'ImportSuccessStep';
