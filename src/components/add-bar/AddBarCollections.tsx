'use client';

import { useCallback } from 'react';
import { FONT, INK } from '@/constants/theme';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import PlacePhoto from '@/components/PlacePhoto';
import { SectionHeader } from './AddBarShared';
import CollectionPickerList from '@/components/ui/CollectionPickerList';
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
  const isSelected = useCallback(
    (id: string) => selectedCollectionIds.includes(id),
    [selectedCollectionIds],
  );

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

      <CollectionPickerList
        collections={collections}
        isSelected={isSelected}
        onToggle={onToggleCollection}
        onCreate={onCreateCollection}
        listClassName="flex flex-col gap-1.5 mb-2"
      />

    </>
  );
}

/** Sticky footer CTA — rendered outside the scroll area by UniversalAddBar */
export function AddBarCollectionsCTA({
  saving, tripContext, selectedCollectionIds, onConfirmSave,
}: Pick<AddBarCollectionsProps, 'saving' | 'tripContext' | 'selectedCollectionIds' | 'onConfirmSave'>) {
  return (
    <div
      className="px-5 pb-4 pt-2 flex-shrink-0"
      style={{
        borderTop: '1px solid var(--t-linen)',
        background: 'var(--t-cream)',
      }}
    >
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
        marginBottom: 0,
      }}>
        {tripContext
          ? 'Saved to Library and added to your trip'
          : 'Collections are optional — you can organize later'}
      </p>
    </div>
  );
}
