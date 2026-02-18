'use client';

import { useParams, useRouter } from 'next/navigation';
import TabBar from '@/components/TabBar';
import { useSavedStore } from '@/stores/savedStore';
import { SOURCE_STYLES, REACTIONS, PlaceType, GhostSourceType, ImportedPlace } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';

const TYPE_COLORS: Record<PlaceType, string> = {
  restaurant: '#e87080',
  hotel: '#c8923a',
  bar: '#6844a0',
  museum: '#2a7a56',
  cafe: '#eeb420',
  activity: '#e86830',
  neighborhood: '#5a7a9a',
  shop: '#a06c28',
};

function SavedPlaceCard({ place }: { place: ImportedPlace }) {
  const rating = place.rating;
  const reaction = rating
    ? REACTIONS.find((r) => r.id === rating.reaction)
    : null;

  return (
    <div className="p-4 rounded-xl border" style={{ backgroundColor: 'white', borderColor: 'var(--t-linen)' }}>
      <div className="flex gap-3">
        {/* Thumbnail */}
        <div
          className="w-12 h-12 rounded-lg flex-shrink-0"
          style={{ backgroundColor: TYPE_COLORS[place.type] || 'var(--t-ghost)', opacity: 0.2 }}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-[13px] font-bold" style={{ color: 'var(--t-ink)' }}>
              {place.name}
            </h3>
            {rating && (
              <span style={{ fontSize: '14px' }}>
                {reaction?.icon}
              </span>
            )}
          </div>
          <p className="text-[10px] mb-2" style={{ color: 'rgba(28,26,23,0.95)' }}>
            {place.location}
          </p>

          {/* Source tag */}
          {place.ghostSource && (() => {
            const src = SOURCE_STYLES[place.ghostSource as GhostSourceType];
            return src ? (
              <div
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px]"
                style={{ backgroundColor: src.bg, color: src.color }}
              >
                <span>{src.icon}</span>
                <span className="font-medium">{src.label}</span>
              </div>
            ) : null;
          })()}
        </div>
      </div>
    </div>
  );
}

export default function CollectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const collectionId = params.id as string;

  const { collections, myPlaces } = useSavedStore();
  const collection = collections.find((c) => c.id === collectionId);

  if (!collection) {
    return (
      <div className="min-h-screen pb-16" style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}>
        <div className="px-4 pt-6 text-center">
          <p style={{ color: 'rgba(28,26,23,0.95)' }}>Collection not found</p>
        </div>
        <TabBar />
      </div>
    );
  }

  // Filter places - for demo, show first `count` places
  const placesInCollection = myPlaces.slice(0, collection.count);

  return (
    <div className="min-h-screen pb-16" style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}>
      <div className="px-4 pt-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="text-[14px] cursor-pointer"
            style={{ color: 'var(--t-verde)', background: 'none', border: 'none' }}
          >
            ←
          </button>
          <h1
            className="text-2xl italic flex-1"
            style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}
          >
            {collection.name}
          </h1>
        </div>

        {/* Curated Collection Badge */}
        {collection.isSmartCollection && (
          <div
            className="inline-block text-[10px] mb-4"
            style={{ fontFamily: "'Space Mono', monospace", color: 'var(--t-verde)' }}
          >
            Auto-updating · Curated Collection
          </div>
        )}

        {/* Collection Info */}
        <div className="mb-6 pb-4 border-b" style={{ borderColor: 'var(--t-linen)' }}>
          <div className="flex items-start justify-between">
            <div>
              <p
                className="text-[13px] font-bold mb-1"
                style={{ color: 'var(--t-ink)' }}
              >
                {collection.count} places
              </p>
              {collection.query && (
                <p
                  className="text-[10px]"
                  style={{ color: 'rgba(28,26,23,0.95)', fontFamily: "'Space Mono', monospace" }}
                >
                  Query: "{collection.query}"
                </p>
              )}
            </div>
            <div className="text-4xl">{collection.emoji}</div>
          </div>

          {/* Filter Tags */}
          {collection.filterTags && collection.filterTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {collection.filterTags.map((tag) => (
                <div
                  key={tag}
                  className="px-2.5 py-1 rounded-full text-[10px]"
                  style={{
                    backgroundColor: 'var(--t-verde)',
                    color: 'white',
                    fontFamily: "'Space Mono', monospace",
                  }}
                >
                  {tag}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Places */}
        {placesInCollection.length > 0 ? (
          <div className="space-y-3">
            {placesInCollection.map((place) => (
              <SavedPlaceCard key={place.id} place={place} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-2xl mb-3 flex justify-center">
              <PerriandIcon name="discover" size={32} />
            </div>
            <p className="text-[12px]" style={{ color: 'rgba(28,26,23,0.9)' }}>
              No places in this collection
            </p>
          </div>
        )}
      </div>
      <TabBar />
    </div>
  );
}
