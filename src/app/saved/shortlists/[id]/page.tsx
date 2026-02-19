'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import TabBar from '@/components/TabBar';
import { useSavedStore } from '@/stores/savedStore';
import { REACTIONS, ImportedPlace, SOURCE_STYLES, PlaceType, GhostSourceType } from '@/types';
import { PlaceDetailProvider, usePlaceDetail } from '@/context/PlaceDetailContext';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import GoogleMapView from '@/components/GoogleMapView';
import { FONT, INK } from '@/constants/theme';

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

const THUMB_GRADIENTS: Record<string, string> = {
  restaurant: 'linear-gradient(135deg, #d8c8ae, #c0ab8e)',
  hotel: 'linear-gradient(135deg, #d0c8d8, #b8b0c0)',
  bar: 'linear-gradient(135deg, #c0d0c8, #a8c0b0)',
  cafe: 'linear-gradient(135deg, #d8d0c0, #c8c0b0)',
  museum: 'linear-gradient(135deg, #c0c8d0, #a8b0b8)',
  activity: 'linear-gradient(135deg, #c0d0c8, #a8b8a8)',
  neighborhood: 'linear-gradient(135deg, #d0d8c8, #b8c0a8)',
  shop: 'linear-gradient(135deg, #d8c8b8, #c0b0a0)',
};

export default function ShortlistDetailPage() {
  const ratePlace = useSavedStore(s => s.ratePlace);

  return (
    <PlaceDetailProvider config={{
      onRate: (place, rating) => ratePlace(place.id, rating),
    }}>
      <ShortlistDetailContent />
    </PlaceDetailProvider>
  );
}

function ShortlistDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { openDetail } = usePlaceDetail();
  const shortlistId = params.id as string;

  const myPlaces = useSavedStore(s => s.myPlaces);
  const shortlists = useSavedStore(s => s.shortlists);
  const removePlaceFromShortlist = useSavedStore(s => s.removePlaceFromShortlist);
  const deleteShortlist = useSavedStore(s => s.deleteShortlist);
  const updateShortlist = useSavedStore(s => s.updateShortlist);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [mapOpen, setMapOpen] = useState(false);

  const shortlist = shortlists.find(s => s.id === shortlistId);

  const placesInShortlist = useMemo(() => {
    if (!shortlist) return [];
    return shortlist.placeIds
      .map(id => myPlaces.find(p => p.id === id))
      .filter(Boolean) as ImportedPlace[];
  }, [shortlist, myPlaces]);

  if (!shortlist) {
    return (
      <div className="min-h-screen pb-16" style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto', overflowX: 'hidden' }}>
        <div className="px-4 pt-5 text-center">
          <p style={{ color: INK['70'] }}>Shortlist not found</p>
          <button
            onClick={() => router.back()}
            className="mt-4 text-[12px] cursor-pointer"
            style={{ color: 'var(--t-verde)', background: 'none', border: 'none' }}
          >
            ← Back
          </button>
        </div>
        <TabBar />
      </div>
    );
  }

  const isPerriandIcon = shortlist.emoji && !shortlist.emoji.match(/[\u{1F000}-\u{1FFFF}]/u) && shortlist.emoji.length > 2;


  const startEditing = () => {
    setEditName(shortlist.name);
    setEditDescription(shortlist.description || '');
    setIsEditing(true);
  };

  const saveEditing = () => {
    updateShortlist(shortlist.id, {
      name: editName.trim() || shortlist.name,
      description: editDescription.trim() || undefined,
    });
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen pb-16" style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <div className="px-4 pt-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => router.back()}
            className="cursor-pointer"
            style={{ color: 'var(--t-verde)', background: 'none', border: 'none', fontSize: 16 }}
          >
            ←
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            {placesInShortlist.length > 0 && (
              <button
                onClick={() => setMapOpen(true)}
                className="text-[10px] px-2.5 py-1.5 rounded-full cursor-pointer flex items-center gap-1"
                style={{
                  background: 'rgba(200,146,58,0.08)',
                  color: '#8a6a2a',
                  border: 'none',
                  fontFamily: FONT.mono,
                }}
              >
                <PerriandIcon name="pin" size={10} color="var(--t-honey)" />
                Map
              </button>
            )}
            {!shortlist.isDefault && (
              <>
                <button
                  onClick={startEditing}
                  className="text-[10px] px-2.5 py-1.5 rounded-full cursor-pointer"
                  style={{
                    background: INK['04'],
                    color: INK['70'],
                    border: 'none',
                    fontFamily: FONT.mono,
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-[10px] px-2.5 py-1.5 rounded-full cursor-pointer"
                  style={{
                    background: 'rgba(214,48,32,0.06)',
                    color: 'var(--t-signal-red)',
                    border: 'none',
                    fontFamily: FONT.mono,
                  }}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        {/* Shortlist info */}
        <div className="mb-6 pb-4 border-b" style={{ borderColor: 'var(--t-linen)' }}>
          <div className="flex items-start gap-3">
            <span style={{ fontSize: isPerriandIcon ? 28 : 36 }}>
              {isPerriandIcon ? (
                <PerriandIcon name={shortlist.emoji as any} size={28} color="var(--t-ink)" />
              ) : (
                shortlist.emoji
              )}
            </span>
            <div className="flex-1">
              {isEditing ? (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                    className="w-full text-[16px] rounded-lg px-2 py-1"
                    style={{
                      fontFamily: FONT.serif,
                      fontStyle: 'italic',
                      color: 'var(--t-ink)',
                      background: 'white',
                      border: '1px solid var(--t-linen)',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Add a description..."
                    className="w-full text-[11px] rounded-lg px-2 py-1"
                    style={{
                      fontFamily: FONT.sans,
                      color: INK['70'],
                      background: 'white',
                      border: '1px solid var(--t-linen)',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveEditing}
                      className="text-[10px] px-3 py-1.5 rounded-full cursor-pointer"
                      style={{ background: 'var(--t-ink)', color: 'white', border: 'none', fontFamily: FONT.mono }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="text-[10px] px-3 py-1.5 rounded-full cursor-pointer"
                      style={{ background: INK['06'], color: INK['70'], border: 'none', fontFamily: FONT.mono }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h1
                    className="text-[22px] mb-1"
                    style={{ fontFamily: FONT.serif, fontStyle: 'italic', color: 'var(--t-ink)' }}
                  >
                    {shortlist.name}
                  </h1>
                  {shortlist.description && (
                    <p className="text-[11px] mb-2" style={{ color: INK['70'], fontFamily: FONT.sans }}>
                      {shortlist.description}
                    </p>
                  )}
                </>
              )}

              <div className="flex items-center gap-2 mt-1">
                <span style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['70'] }}>
                  {placesInShortlist.length} {placesInShortlist.length === 1 ? 'place' : 'places'}
                </span>
                {shortlist.cities.length > 0 && (
                  <>
                    <span style={{ color: INK['15'], fontSize: 10 }}>·</span>
                    <span style={{ fontFamily: FONT.sans, fontSize: 10, color: INK['70'] }}>
                      {shortlist.cities.slice(0, 3).join(', ')}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Smart collection badge */}
          {shortlist.isSmartCollection && (
            <div className="mt-3">
              <span
                className="text-[9px] px-2 py-1 rounded-full"
                style={{
                  fontFamily: FONT.mono,
                  background: 'rgba(42,122,86,0.08)',
                  color: 'var(--t-verde)',
                }}
              >
                Auto-updating · Curated Collection
              </span>
              {shortlist.query && (
                <p className="text-[10px] mt-2" style={{ color: INK['70'], fontFamily: FONT.mono }}>
                  Query: "{shortlist.query}"
                </p>
              )}
            </div>
          )}

          {/* Filter tags */}
          {shortlist.filterTags && shortlist.filterTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {shortlist.filterTags.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-1 rounded-full text-[9px]"
                  style={{
                    background: 'var(--t-verde)',
                    color: 'white',
                    fontFamily: FONT.mono,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Places list */}
        {placesInShortlist.length > 0 ? (
          <div className="flex flex-col gap-2">
            {placesInShortlist.map(place => (
              <ShortlistPlaceCard
                key={place.id}
                place={place}
                onTap={() => openDetail(place)}
                onRemove={!shortlist.isSmartCollection ? () => removePlaceFromShortlist(shortlist.id, place.id) : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <PerriandIcon name="discover" size={32} color={INK['15']} />
            <p className="text-[12px] mt-3" style={{ color: INK['70'] }}>
              No places in this shortlist
            </p>
            <p className="text-[11px] mt-1" style={{ color: INK['70'] }}>
              Add places from the Library to get started
            </p>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.3)' }} />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative rounded-2xl px-6 py-5 mx-5"
            style={{ maxWidth: 320, background: 'var(--t-cream)' }}
          >
            <p className="text-[14px] font-semibold mb-2" style={{ color: 'var(--t-ink)', fontFamily: FONT.serif }}>
              Delete "{shortlist.name}"?
            </p>
            <p className="text-[11px] mb-5" style={{ color: INK['70'] }}>
              This won't remove the places from your library.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  deleteShortlist(shortlist.id);
                  router.back();
                }}
                className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold cursor-pointer"
                style={{ background: 'var(--t-signal-red)', color: 'white', border: 'none' }}
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-[12px] cursor-pointer"
                style={{ background: INK['06'], color: INK['70'], border: 'none' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen Map Overlay */}
      {mapOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}
        >
          {/* Map header bar */}
          <div
            className="flex items-center gap-3 px-4 flex-shrink-0"
            style={{
              height: 56,
              background: 'rgba(245,240,230,0.92)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderBottom: '1px solid var(--t-linen)',
            }}
          >
            <button
              onClick={() => setMapOpen(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer flex-shrink-0"
              style={{
                background: 'rgba(255,255,255,0.7)',
                border: '1px solid var(--t-linen)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8L10 13" stroke="var(--t-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold truncate" style={{ fontFamily: FONT.serif, fontStyle: 'italic', color: 'var(--t-ink)' }}>
                {shortlist.name}
              </div>
              <div className="text-[10px]" style={{ fontFamily: FONT.mono, color: INK['70'] }}>
                {placesInShortlist.length} {placesInShortlist.length === 1 ? 'place' : 'places'}
                {shortlist.cities.length > 0 && ` · ${shortlist.cities.slice(0, 3).join(', ')}`}
              </div>
            </div>
          </div>

          {/* Map fills remaining space */}
          <div className="relative" style={{ height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
            <GoogleMapView
              markers={placesInShortlist.map(p => ({
                id: p.id,
                name: p.name,
                location: p.location,
                type: p.type,
                matchScore: p.matchScore,
                tasteNote: p.tasteNote,
                lat: p.google?.lat,
                lng: p.google?.lng,
              }))}
              height={typeof window !== 'undefined' ? window.innerHeight - 56 : 600}
              fallbackDestination={shortlist.cities[0]}
            />

            {/* Floating legend */}
            <div
              className="absolute bottom-5 left-4 right-4 flex items-center justify-between px-3.5 py-2.5 rounded-xl"
              style={{
                background: 'rgba(245,240,230,0.92)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid var(--t-linen)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              }}
            >
              <div className="flex items-center gap-2">
                {(() => {
                  const types = new Set(placesInShortlist.map(p => p.type));
                  return Array.from(types).slice(0, 4).map(type => (
                    <div key={type} className="flex items-center gap-1">
                      <PerriandIcon name={type as any} size={11} color={TYPE_COLORS[type as PlaceType] || INK['60']} />
                      <span style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['70'] }}>
                        {placesInShortlist.filter(p => p.type === type).length}
                      </span>
                    </div>
                  ));
                })()}
              </div>
              <span style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['50'] }}>
                Tap pins for details
              </span>
            </div>
          </div>
        </div>
      )}

      {/* PlaceDetailSheet, RatingSheet, BriefingView, AddToShortlistSheet
           are all rendered by PlaceDetailProvider — no duplication needed */}

      <TabBar />
    </div>
  );
}


// ═══════════════════════════════════════════
// Shortlist Place Card
// ═══════════════════════════════════════════

function ShortlistPlaceCard({ place, onTap, onRemove }: {
  place: ImportedPlace;
  onTap: () => void;
  onRemove?: () => void;
}) {
  const rating = place.rating;
  const reaction = rating ? REACTIONS.find(r => r.id === rating.reaction) : null;
  const typeIcon = place.type;

  return (
    <div
      onClick={onTap}
      className="p-3 rounded-xl cursor-pointer transition-all"
      style={{ background: 'white', border: '1px solid var(--t-linen)' }}
    >
      <div className="flex gap-3">
        {/* Thumbnail */}
        <div
          className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center"
          style={{ background: THUMB_GRADIENTS[place.type] || THUMB_GRADIENTS.restaurant }}
        >
          <PerriandIcon name={typeIcon as any} size={18} color={INK['60']} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <h3 className="text-[13px] font-semibold truncate" style={{ color: 'var(--t-ink)', fontFamily: FONT.sans }}>
              {place.name}
            </h3>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {reaction && (
                <PerriandIcon name={reaction.icon as any} size={14} color={reaction.color} />
              )}
              {onRemove && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(); }}
                  className="w-5 h-5 rounded-full flex items-center justify-center cursor-pointer"
                  style={{ background: INK['04'], border: 'none' }}
                >
                  <PerriandIcon name="close" size={8} color={INK['30']} />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span style={{ fontFamily: FONT.sans, fontSize: 10, color: INK['70'] }}>
              {place.type.charAt(0).toUpperCase() + place.type.slice(1)}
            </span>
            <span style={{ fontSize: 10, color: INK['70'] }}>· {place.location.split(',')[0]}</span>
            {place.google?.rating && (
              <span style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['70'] }}>
                ★ {place.google.rating}
              </span>
            )}
          </div>
          {place.tasteNote && (
            <p className="text-[10px] mt-1" style={{ color: INK['70'], fontStyle: 'italic', lineHeight: 1.3 }}>
              {place.tasteNote.length > 80 ? place.tasteNote.slice(0, 77) + '…' : place.tasteNote}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
