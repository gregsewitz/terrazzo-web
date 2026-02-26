'use client';

import { useMemo } from 'react';
import { FONT, INK } from '@/constants/theme';
import { PerriandIcon, isPerriandIconName } from '@/components/icons/PerriandIcons';
import { SectionHeader, PlaceRow, searchLibraryByDestination, getRecentSaves } from './AddBarShared';
import type { ImportedPlace, Collection } from '@/types';
import type { AddBarMode, AddBarState } from '@/stores/addBarStore';

type TripContext = NonNullable<AddBarState['tripContext']>;

interface AddBarSearchProps {
  query: string;
  libraryResults: ImportedPlace[];
  googleResults: Array<{
    placeId: string;
    name: string;
    type?: string;
    address?: string;
    lat?: number;
    lng?: number;
    photoUrl?: string;
  }>;
  myPlaces: ImportedPlace[];
  collections: Collection[];
  tripContext: TripContext | null;
  onSavePlace: (place: ImportedPlace) => void;
  onSearch: (overrideText?: string) => void;
  setQuery: (q: string) => void;
  setLibraryResults: (r: ImportedPlace[]) => void;
  setMode: (m: AddBarMode) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export default function AddBarSearch({
  query, libraryResults, googleResults, myPlaces, collections,
  tripContext, onSavePlace, onSearch, setQuery, setLibraryResults, setMode, inputRef,
}: AddBarSearchProps) {

  const destinationMatches = useMemo(() => {
    if (!tripContext?.destination) return [];
    return searchLibraryByDestination(myPlaces, tripContext.destination);
  }, [tripContext, myPlaces]);

  const recentSaves = useMemo(() => getRecentSaves(myPlaces), [myPlaces]);

  const tripCollections = useMemo(() => {
    if (!tripContext?.destination) return [];
    const dest = tripContext.destination.toLowerCase();
    return collections
      .map(sl => {
        const matchingPlaces = sl.placeIds
          .map(id => myPlaces.find(p => p.id === id))
          .filter((p): p is ImportedPlace => !!p && p.location.toLowerCase().includes(dest));
        return { ...sl, matchingPlaces, matchCount: matchingPlaces.length };
      })
      .filter(sl => sl.matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount);
  }, [tripContext, collections, myPlaces]);

  return (
    <>
      {/* Typing: show library results first, then Google hint */}
      {query.trim().length > 0 && (
        <>
          {libraryResults.length > 0 && (
            <SectionHeader label="In your library" />
          )}
          {libraryResults.map(place => (
            <PlaceRow
              key={place.id}
              place={place}
              inLibrary
              collections={collections.filter(sl => sl.placeIds.includes(place.id))}
              onTap={() => onSavePlace(place)}
            />
          ))}

          {/* Google results */}
          <SectionHeader label="From Google" />
          {googleResults.length > 0 ? (
            googleResults.map(result => {
              const asPlace = {
                id: `google-${result.placeId}`,
                name: result.name,
                type: result.type || 'activity',
                location: result.address || '',
                source: { type: 'google-maps' as const, name: 'Google Places' },
                matchScore: 0,
                matchBreakdown: { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0 },
                tasteNote: '',
                status: 'available' as const,
                google: {
                  placeId: result.placeId,
                  address: result.address,
                  lat: result.lat,
                  lng: result.lng,
                  photoUrl: result.photoUrl,
                },
              } as ImportedPlace;
              return (
                <PlaceRow
                  key={result.placeId}
                  place={asPlace}
                  onTap={() => onSavePlace(asPlace)}
                  action="save"
                />
              );
            })
          ) : (
            <button
              onClick={() => onSearch()}
              className="flex items-center gap-2.5 w-full px-3 py-3 rounded-xl cursor-pointer transition-all"
              style={{
                background: 'white',
                border: '1px solid var(--t-linen)',
                textAlign: 'left',
              }}
            >
              <PerriandIcon name="add" size={14} color="var(--t-verde)" />
              <span style={{ fontFamily: FONT.sans, fontSize: 13, color: 'var(--t-ink)' }}>
                Search Google for &ldquo;{query}&rdquo;
              </span>
            </button>
          )}
        </>
      )}

      {/* Empty state: trip-context or global */}
      {query.trim().length === 0 && (
        <>
          {tripContext ? (
            <>
              {/* Collections with destination places */}
              {tripCollections.length > 0 && (
                <>
                  <SectionHeader label={`Collections with ${tripContext.destination || ''} places`} />
                  <div className="flex flex-col gap-1.5 mb-2">
                    {tripCollections.map(sl => (
                      <button
                        key={sl.id}
                        onClick={() => {
                          setLibraryResults(sl.matchingPlaces);
                          setMode('search');
                        }}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl cursor-pointer transition-all text-left"
                        style={{
                          background: 'white',
                          border: '1px solid var(--t-linen)',
                        }}
                      >
                        <span style={{ fontSize: 16, width: 22, textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          {sl.emoji && isPerriandIconName(sl.emoji)
                            ? <PerriandIcon name={sl.emoji} size={18} color={INK['50']} />
                            : sl.emoji}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p style={{ fontFamily: FONT.sans, fontSize: 13, fontWeight: 600, color: 'var(--t-ink)', margin: 0 }}>
                            {sl.name}
                          </p>
                          <p style={{ fontFamily: FONT.mono, fontSize: 9, color: 'var(--t-verde)', margin: '1px 0 0' }}>
                            {sl.matchCount} {sl.matchCount === 1 ? 'place' : 'places'} in {tripContext.destination}
                          </p>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: 0.3 }}>
                          <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Destination matches from library */}
              {destinationMatches.length > 0 && (
                <>
                  <SectionHeader label={`All ${tripContext.destination || ''} places in Library`} />
                  {destinationMatches.slice(0, 6).map(place => (
                    <PlaceRow
                      key={place.id}
                      place={place}
                      inLibrary
                      collections={collections.filter(sl => sl.placeIds.includes(place.id))}
                      onTap={() => onSavePlace(place)}
                    />
                  ))}
                  {destinationMatches.length > 6 && (
                    <p style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['40'], textAlign: 'center', margin: '8px 0 0' }}>
                      + {destinationMatches.length - 6} more — type to search
                    </p>
                  )}
                </>
              )}

              {/* Fallback */}
              <div
                className="mt-4 p-4 rounded-xl"
                style={{
                  background: 'rgba(200,146,58,0.05)',
                  border: '1px solid rgba(200,146,58,0.12)',
                }}
              >
                <p style={{ fontFamily: FONT.sans, fontSize: 13, fontWeight: 600, color: 'var(--t-ink)', margin: '0 0 8px' }}>
                  Don&apos;t have what you need?
                </p>
                <button
                  onClick={() => {
                    setQuery(tripContext.destination || '');
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl cursor-pointer transition-all"
                  style={{
                    background: 'white',
                    border: '1px solid var(--t-linen)',
                    textAlign: 'left',
                  }}
                >
                  <PerriandIcon name="discover" size={15} color={INK['50']} />
                  <span style={{ fontFamily: FONT.sans, fontSize: 13, color: 'var(--t-ink)' }}>
                    Search Google for {tripContext.destination || ''} places
                  </span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Recent saves */}
              {recentSaves.length > 0 ? (
                <>
                  <SectionHeader label="Recently saved" />
                  {recentSaves.map(place => (
                    <PlaceRow
                      key={place.id}
                      place={place}
                      inLibrary
                      collections={collections.filter(sl => sl.placeIds.includes(place.id))}
                      onTap={() => onSavePlace(place)}
                      compact
                    />
                  ))}
                </>
              ) : (
                <div className="pt-6 pb-2 text-center">
                  <p style={{ fontFamily: FONT.sans, fontSize: 13, color: INK['40'], margin: 0, lineHeight: 1.5 }}>
                    Search for a place, paste a link,<br />or drop in a list from a friend
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
