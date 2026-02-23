'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import type { ImportedPlace, PlaceType } from '@/types';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

/** Map Google Place types → our PlaceType */
function inferPlaceType(googleTypes: string[]): PlaceType {
  const t = new Set(googleTypes);
  if (t.has('restaurant') || t.has('food')) return 'restaurant';
  if (t.has('bar') || t.has('night_club')) return 'bar';
  if (t.has('cafe')) return 'cafe';
  if (t.has('lodging')) return 'hotel';
  if (t.has('museum') || t.has('art_gallery')) return 'museum';
  if (t.has('store') || t.has('shopping_mall')) return 'shop';
  if (t.has('neighborhood') || t.has('sublocality') || t.has('locality')) return 'neighborhood';
  return 'activity';
}

export interface PlaceSearchResult {
  name: string;
  placeId?: string;
  address?: string;
  lat?: number;
  lng?: number;
  type: PlaceType;
  isCustom?: boolean;
}

interface PlaceSearchInputProps {
  onSelect: (result: PlaceSearchResult) => void;
  onCancel: () => void;
  destination?: string;        // bias results toward trip destination
  suggestedType?: PlaceType;   // hint from slot affinity
  placeholder?: string;
  compact?: boolean;           // smaller variant for PicksRail
}

function PlaceSearchInputInner({
  onSelect,
  onCancel,
  destination,
  suggestedType,
  placeholder = 'Search for a place…',
  compact = false,
}: PlaceSearchInputProps) {
  const places = useMapsLibrary('places');

  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const switchingMode = useRef(false);

  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'search' | 'custom'>('search');
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Custom mode
  const [customName, setCustomName] = useState('');
  const [customType, setCustomType] = useState<PlaceType>(suggestedType || 'activity');

  // ─── Init ───
  useEffect(() => {
    if (!places) return;
    autocompleteService.current = new places.AutocompleteService();
    const div = document.createElement('div');
    placesService.current = new places.PlacesService(div);
  }, [places]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [mode]);

  // ─── Fetch predictions ───
  const fetchPredictions = useCallback(
    (input: string) => {
      if (!autocompleteService.current || input.trim().length < 2) {
        setPredictions([]);
        setShowDropdown(false);
        return;
      }
      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      debounceTimer.current = setTimeout(() => {
        const request: google.maps.places.AutocompletionRequest = {
          input: destination ? `${input} ${destination}` : input,
          types: ['establishment'],
        };

        autocompleteService.current!.getPlacePredictions(request, (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results?.length) {
            setPredictions(results);
            setShowDropdown(true);
            setActiveIndex(-1);
          } else {
            setPredictions([]);
            setShowDropdown(false);
          }
        });
      }, 250);
    },
    [destination],
  );

  // ─── Select prediction ───
  const selectPrediction = useCallback(
    (prediction: google.maps.places.AutocompletePrediction) => {
      const name = prediction.structured_formatting?.main_text || prediction.description;
      setQuery(name);
      setShowDropdown(false);
      setPredictions([]);

      if (placesService.current) {
        placesService.current.getDetails(
          {
            placeId: prediction.place_id,
            fields: ['geometry', 'formatted_address', 'name', 'types'],
          },
          (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place) {
              onSelect({
                name: place.name || name,
                placeId: prediction.place_id,
                address: place.formatted_address || undefined,
                lat: place.geometry?.location?.lat(),
                lng: place.geometry?.location?.lng(),
                type: place.types ? inferPlaceType(place.types) : suggestedType || 'activity',
              });
            } else {
              onSelect({
                name,
                placeId: prediction.place_id,
                type: suggestedType || 'activity',
              });
            }
          },
        );
      } else {
        onSelect({ name, placeId: prediction.place_id, type: suggestedType || 'activity' });
      }
    },
    [onSelect, suggestedType],
  );

  // ─── Mode switching ───
  const switchToCustom = () => {
    switchingMode.current = true;
    setCustomName(query);
    setShowDropdown(false);
    setMode('custom');
    setTimeout(() => { switchingMode.current = false; }, 150);
  };

  const switchToSearch = () => {
    switchingMode.current = true;
    setMode('search');
    setTimeout(() => { switchingMode.current = false; }, 150);
  };

  // ─── Keyboard ───
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
      onCancel();
      return;
    }
    if (!showDropdown || predictions.length === 0) {
      if (e.key === 'Enter' && query.trim()) {
        e.preventDefault();
        // Freeform: treat as custom with just a name
        onSelect({ name: query.trim(), type: suggestedType || 'activity' });
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, predictions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < predictions.length) {
        selectPrediction(predictions[activeIndex]);
      } else if (query.trim()) {
        onSelect({ name: query.trim(), type: suggestedType || 'activity' });
      }
    }
  };

  const TYPE_OPTIONS: { value: PlaceType; label: string }[] = [
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'bar', label: 'Bar' },
    { value: 'cafe', label: 'Café' },
    { value: 'museum', label: 'Museum' },
    { value: 'activity', label: 'Activity' },
    { value: 'shop', label: 'Shop' },
    { value: 'neighborhood', label: 'Neighborhood' },
  ];

  const fontSize = compact ? 11 : 12;

  // ═══ CUSTOM MODE ═══
  if (mode === 'custom') {
    return (
      <div className="flex flex-col gap-1.5" style={{ padding: compact ? '6px 8px' : '8px 12px' }}>
        <div className="flex items-center gap-1.5">
          <PerriandIcon name="add" size={compact ? 12 : 14} color="var(--t-verde)" />
          <input
            ref={inputRef}
            type="text"
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') onCancel();
              if (e.key === 'Enter' && customName.trim()) {
                onSelect({ name: customName.trim(), type: customType, isCustom: true });
              }
            }}
            placeholder="Place name…"
            style={{
              fontFamily: FONT.sans,
              fontSize,
              fontWeight: 600,
              color: 'var(--t-ink)',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--t-verde)',
              outline: 'none',
              padding: '0 2px 1px',
              flex: 1,
              minWidth: 0,
            }}
          />
        </div>
        {/* Type picker */}
        <div className="flex flex-wrap gap-1 ml-5">
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setCustomType(opt.value)}
              style={{
                fontFamily: FONT.mono,
                fontSize: 9,
                fontWeight: customType === opt.value ? 700 : 500,
                color: customType === opt.value ? 'white' : INK['50'],
                background: customType === opt.value ? 'var(--t-verde)' : INK['06'],
                border: 'none',
                borderRadius: 10,
                padding: '2px 7px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onMouseDown={e => { e.preventDefault(); switchToSearch(); }}
          className="text-left ml-5 cursor-pointer"
          style={{
            fontFamily: FONT.sans,
            fontSize: 9,
            color: 'var(--t-verde)',
            background: 'none',
            border: 'none',
            padding: 0,
            textDecoration: 'underline',
            textUnderlineOffset: 2,
          }}
        >
          Search Google Places instead
        </button>
      </div>
    );
  }

  // ═══ SEARCH MODE ═══
  return (
    <div className="relative" style={{ padding: compact ? '6px 8px' : '8px 12px' }}>
      <div className="flex items-center gap-1.5">
        <PerriandIcon name="add" size={compact ? 12 : 14} color="var(--t-verde)" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            fetchPredictions(e.target.value);
          }}
          onBlur={() => {
            setTimeout(() => {
              if (!switchingMode.current) {
                setShowDropdown(false);
              }
            }, 250);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{
            fontFamily: FONT.sans,
            fontSize,
            fontWeight: 500,
            color: 'var(--t-ink)',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--t-verde)',
            outline: 'none',
            padding: '0 2px 1px',
            flex: 1,
            minWidth: 0,
          }}
        />
      </div>

      {/* Autocomplete dropdown */}
      {showDropdown && predictions.length > 0 && (
        <div
          className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden shadow-lg z-50"
          style={{
            background: 'white',
            border: '1px solid var(--t-linen)',
            maxHeight: 260,
            overflowY: 'auto',
            top: '100%',
            marginLeft: compact ? 8 : 12,
            marginRight: compact ? 8 : 12,
          }}
        >
          {predictions.map((p, i) => (
            <button
              key={p.place_id}
              onMouseDown={e => {
                e.preventDefault();
                selectPrediction(p);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className="flex flex-col items-start w-full px-3 py-2 cursor-pointer text-left transition-colors"
              style={{
                background: i === activeIndex ? INK['04'] : 'transparent',
                border: 'none',
              }}
            >
              <span
                style={{ fontFamily: FONT.sans, fontSize: 12, fontWeight: 500, color: 'var(--t-ink)' }}
              >
                {p.structured_formatting?.main_text || p.description}
              </span>
              {p.structured_formatting?.secondary_text && (
                <span
                  className="truncate w-full"
                  style={{ fontFamily: FONT.sans, fontSize: 10, color: INK['50'] }}
                >
                  {p.structured_formatting.secondary_text}
                </span>
              )}
            </button>
          ))}

          {/* Custom place option at bottom */}
          <button
            onMouseDown={e => {
              e.preventDefault();
              switchToCustom();
            }}
            className="flex items-center gap-2 w-full px-3 py-2 cursor-pointer text-left"
            style={{
              background: 'transparent',
              border: 'none',
              borderTop: `1px solid var(--t-linen)`,
            }}
          >
            <PerriandIcon name="edit" size={11} color={INK['40']} />
            <span style={{ fontFamily: FONT.sans, fontSize: 11, color: INK['50'] }}>
              Add custom place
            </span>
          </button>
        </div>
      )}

      {/* Inline hint when empty */}
      {!showDropdown && query.length === 0 && (
        <button
          onMouseDown={e => { e.preventDefault(); switchToCustom(); }}
          className="text-left mt-1 ml-5 cursor-pointer"
          style={{
            fontFamily: FONT.sans,
            fontSize: 9,
            color: INK['40'],
            background: 'none',
            border: 'none',
            padding: 0,
          }}
        >
          or type a custom place
        </button>
      )}
    </div>
  );
}

// ─── Wrapper with APIProvider ───
export default function PlaceSearchInput(props: PlaceSearchInputProps) {
  if (!API_KEY) return <PlaceSearchInputInner {...props} />;
  return (
    <APIProvider apiKey={API_KEY} libraries={['places']}>
      <PlaceSearchInputInner {...props} />
    </APIProvider>
  );
}
