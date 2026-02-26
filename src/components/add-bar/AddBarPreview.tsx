'use client';

import { useState } from 'react';
import { FONT, INK } from '@/constants/theme';
import { PerriandIcon, isPerriandIconName } from '@/components/icons/PerriandIcons';
import { SectionHeader, PlaceRow } from './AddBarShared';
import type { ImportedPlace, Collection } from '@/types';
import type { AddBarState } from '@/stores/addBarStore';

type TripContext = NonNullable<AddBarState['tripContext']>;

interface AddBarPreviewProps {
  importResults: ImportedPlace[];
  collections: Collection[];
  tripContext: TripContext | null;
  onSavePlace: (place: ImportedPlace) => void;
  onSaveAll: (collectionIds: string[]) => void;
}

export default function AddBarPreview({
  importResults, collections, tripContext, onSavePlace, onSaveAll,
}: AddBarPreviewProps) {
  const [importCollectionIds, setImportCollectionIds] = useState<string[]>([]);

  if (importResults.length === 0) return null;

  return (
    <>
      <SectionHeader label={`Found ${importResults.length} place${importResults.length === 1 ? '' : 's'}`} />
      {importResults.map(place => (
        <PlaceRow
          key={place.id}
          place={place}
          matchScore={place.matchScore}
          onTap={() => onSavePlace(place)}
          action="save"
        />
      ))}

      {/* Optional collection picker for batch save */}
      {collections.length > 0 && (
        <div className="pt-3 mb-2 p-3 rounded-xl" style={{ background: INK['02'] }}>
          <p style={{
            fontFamily: FONT.mono, fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: INK['40'], margin: '0 0 6px',
          }}>
            Also add to collections
          </p>
          <div className="flex flex-col gap-1">
            {collections.map(sl => {
              const isSelected = importCollectionIds.includes(sl.id);
              return (
                <button
                  key={sl.id}
                  onClick={() => setImportCollectionIds(prev =>
                    isSelected ? prev.filter(id => id !== sl.id) : [...prev, sl.id]
                  )}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all text-left"
                  style={{
                    background: isSelected ? 'rgba(42,122,86,0.08)' : 'transparent',
                    border: isSelected ? '1px solid var(--t-verde)' : '1px solid transparent',
                  }}
                >
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                    style={{ background: isSelected ? 'var(--t-verde)' : INK['08'] }}
                  >
                    {isSelected && <span style={{ color: 'white', fontSize: 9, fontWeight: 700 }}>&#10003;</span>}
                  </div>
                  <span style={{ fontSize: 14, width: 18, textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {sl.emoji && isPerriandIconName(sl.emoji)
                      ? <PerriandIcon name={sl.emoji} size={14} color={INK['50']} />
                      : sl.emoji}
                  </span>
                  <span style={{ fontFamily: FONT.sans, fontSize: 12, color: 'var(--t-ink)' }}>
                    {sl.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="pt-2">
        <button
          onClick={() => onSaveAll(importCollectionIds)}
          className="w-full py-3 rounded-xl cursor-pointer transition-all"
          style={{
            background: 'var(--t-ink)',
            color: 'white',
            border: 'none',
            fontFamily: FONT.sans,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Save all {importResults.length} to Library
          {tripContext && ' + Trip'}
          {importCollectionIds.length > 0 && ` + ${importCollectionIds.length} collection${importCollectionIds.length > 1 ? 's' : ''}`}
        </button>
      </div>
    </>
  );
}
