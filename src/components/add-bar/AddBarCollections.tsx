'use client';

import { useState } from 'react';
import { FONT, INK } from '@/constants/theme';
import { PerriandIcon, isPerriandIconName } from '@/components/icons/PerriandIcons';
import PlacePhoto from '@/components/PlacePhoto';
import { SectionHeader } from './AddBarShared';
import type { ImportedPlace, Collection } from '@/types';
import type { AddBarState } from '@/stores/addBarStore';

type TripContext = NonNullable<AddBarState['tripContext']>;

interface AddBarCollectionsProps {
  previewPlace: ImportedPlace;
  collections: Collection[];
  selectedCollectionIds: string[];
  tripContext: TripContext | null;
  saving: boolean;
  onToggleCollection: (id: string) => void;
  onCreateCollection: (name: string, emoji: string) => Promise<string>;
  onConfirmSave: () => void;
}

export default function AddBarCollections({
  previewPlace, collections, selectedCollectionIds, tripContext,
  saving, onToggleCollection, onCreateCollection, onConfirmSave,
}: AddBarCollectionsProps) {
  const [showCollectionCreate, setShowCollectionCreate] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  return (
    <>
      {/* Place card with photo + AI blurb */}
      <div
        className="rounded-xl mt-3 mb-4 overflow-hidden"
        style={{ background: 'white', border: '1px solid var(--t-linen)' }}
      >
        {previewPlace.google?.photoUrl && (
          <div style={{ position: 'relative', width: '100%', height: 140 }}>
            <PlacePhoto
              src={previewPlace.google.photoUrl}
              alt={previewPlace.name}
              fill
              sizes="400px"
            />
          </div>
        )}
        <div className="px-4 py-3">
          <p style={{ fontFamily: FONT.sans, fontSize: 14, fontWeight: 600, color: 'var(--t-ink)', margin: 0 }}>
            {previewPlace.name}
          </p>
          <p style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['50'], margin: '3px 0 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {previewPlace.type}{previewPlace.location ? ` \u00B7 ${previewPlace.location}` : ''}
          </p>
          {previewPlace.matchScore ? (
            <p style={{ fontFamily: FONT.mono, fontSize: 10, color: 'var(--t-verde)', margin: '3px 0 0' }}>
              {previewPlace.matchScore}% taste match
            </p>
          ) : null}
          {previewPlace.tasteNote && (
            <p style={{
              fontFamily: FONT.sans,
              fontSize: 12,
              fontStyle: 'italic',
              color: INK['60'],
              margin: '6px 0 0',
              lineHeight: 1.4,
            }}>
              &ldquo;{previewPlace.tasteNote}&rdquo;
            </p>
          )}
        </div>
      </div>

      <SectionHeader label="Add to collections" />
      <div className="flex flex-col gap-1.5 mb-2">
        {collections.map(sl => {
          const isIn = selectedCollectionIds.includes(sl.id);
          return (
            <button
              key={sl.id}
              onClick={() => onToggleCollection(sl.id)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all cursor-pointer w-full text-left"
              style={{
                background: isIn ? 'rgba(42,122,86,0.04)' : 'white',
                border: isIn ? '1.5px solid var(--t-verde)' : '1px solid var(--t-linen)',
              }}
            >
              <span style={{ fontSize: 14, width: 20, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {sl.emoji && isPerriandIconName(sl.emoji)
                  ? <PerriandIcon name={sl.emoji} size={16} color={INK['50']} />
                  : sl.emoji}
              </span>
              <div className="flex-1 text-left">
                <span style={{ fontFamily: FONT.sans, fontSize: 13, color: 'var(--t-ink)' }}>
                  {sl.name}
                </span>
                <span className="ml-2" style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['50'] }}>
                  {sl.placeIds.length}
                </span>
              </div>
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: isIn ? 'var(--t-verde)' : INK['06'] }}
              >
                {isIn && <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>&#10003;</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Inline create new collection */}
      <div className="mb-4">
        {showCollectionCreate ? (
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Collection name..."
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              autoFocus
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && newCollectionName.trim()) {
                  const newId = await onCreateCollection(newCollectionName.trim(), '📌');
                  onToggleCollection(newId);
                  setNewCollectionName('');
                  setShowCollectionCreate(false);
                }
              }}
              className="flex-1 min-w-0 rounded-lg py-2 px-3"
              style={{
                background: 'white',
                border: '1px solid var(--t-linen)',
                color: 'var(--t-ink)',
                fontFamily: FONT.sans,
                fontSize: 12,
                outline: 'none',
              }}
            />
            <button
              onClick={async () => {
                if (!newCollectionName.trim()) return;
                const newId = await onCreateCollection(newCollectionName.trim(), '📌');
                onToggleCollection(newId);
                setNewCollectionName('');
                setShowCollectionCreate(false);
              }}
              disabled={!newCollectionName.trim()}
              className="px-3 py-2 rounded-lg cursor-pointer"
              style={{
                background: newCollectionName.trim() ? 'var(--t-ink)' : INK['10'],
                color: newCollectionName.trim() ? 'white' : INK['30'],
                border: 'none',
                fontFamily: FONT.sans,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              Add
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCollectionCreate(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl cursor-pointer transition-all"
            style={{
              background: 'none',
              border: `1.5px dashed ${INK['12']}`,
              color: INK['50'],
              fontFamily: FONT.sans,
              fontSize: 12,
            }}
          >
            <PerriandIcon name="add" size={12} color={INK['40']} />
            New Collection
          </button>
        )}
      </div>

      {/* Save CTA */}
      <button
        onClick={onConfirmSave}
        disabled={saving}
        className="w-full py-3.5 rounded-xl cursor-pointer transition-all"
        style={{
          background: saving ? 'var(--t-verde)' : 'var(--t-ink)',
          color: 'white',
          border: 'none',
          fontFamily: FONT.sans,
          fontSize: 14,
          fontWeight: 600,
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? 'Saved' : tripContext
          ? `Save to Library + Day ${tripContext.dayIndex + 1}`
          : selectedCollectionIds.length > 0
            ? `Save to Library + ${selectedCollectionIds.length} collection${selectedCollectionIds.length > 1 ? 's' : ''}`
            : 'Save to Library'
        }
      </button>
      <p style={{
        fontFamily: FONT.sans,
        fontSize: 11,
        color: INK['40'],
        textAlign: 'center',
        marginTop: 6,
      }}>
        {tripContext
          ? 'Saved to Library and added to your trip'
          : 'Collections are optional — you can organize later'}
      </p>
    </>
  );
}
