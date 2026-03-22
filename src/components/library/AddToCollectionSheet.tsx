'use client';

import { useCallback } from 'react';
import { useSavedStore } from '@/stores/savedStore';
import { ImportedPlace } from '@/types';
import BaseSheet from '@/components/ui/BaseSheet';
import CollectionPickerList from '@/components/ui/CollectionPickerList';

export default function AddToCollectionSheet({
  place,
  onClose,
}: {
  place: ImportedPlace;
  onClose: () => void;
}) {
  const collections = useSavedStore(s => s.collections);
  const addPlaceToCollection = useSavedStore(s => s.addPlaceToCollection);
  const removePlaceFromCollection = useSavedStore(s => s.removePlaceFromCollection);
  const createCollectionAsync = useSavedStore(s => s.createCollectionAsync);

  const isSelected = useCallback(
    (collectionId: string) => {
      const col = collections.find(c => c.id === collectionId);
      return col ? col.placeIds.includes(place.id) : false;
    },
    [collections, place.id],
  );

  const handleToggle = useCallback(
    (collectionId: string) => {
      if (isSelected(collectionId)) {
        removePlaceFromCollection(collectionId, place.id);
      } else {
        addPlaceToCollection(collectionId, place.id);
      }
    },
    [isSelected, addPlaceToCollection, removePlaceFromCollection, place.id],
  );

  const handleCreate = useCallback(
    async (name: string, iconName: string) => {
      const realId = await createCollectionAsync(name, iconName);
      addPlaceToCollection(realId, place.id);
      return realId;
    },
    [createCollectionAsync, addPlaceToCollection, place.id],
  );

  return (
    <BaseSheet
      title="Add to Collection"
      subtitle={place.name}
      onClose={onClose}
    >
      <div className="px-4 pb-4 flex flex-col flex-1 min-h-0">
        <CollectionPickerList
          collections={collections}
          isSelected={isSelected}
          onToggle={handleToggle}
          onCreate={handleCreate}
          autoToggleNew={false}
          listClassName="flex flex-col gap-1.5 mb-2 flex-1 min-h-0 overflow-y-auto"
        />
      </div>
    </BaseSheet>
  );
}
