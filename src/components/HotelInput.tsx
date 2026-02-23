'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import type { HotelInfo } from '@/types';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

interface HotelInputProps {
  value?: HotelInfo;
  legacyValue?: string;           // backwards compat with plain string
  onSave: (hotel: HotelInfo | null) => void;
  onCancel: () => void;
  accentColor?: string;
  textColor?: string;
  destination?: string;           // bias results toward trip destination
}

// ─── Inner component (must be inside APIProvider) ───
function HotelInputInner({
  value,
  legacyValue,
  onSave,
  onCancel,
  accentColor = 'var(--t-verde)',
  textColor = 'var(--t-ink)',
  destination,
}: HotelInputProps) {
  const places = useMapsLibrary('places');

  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Track whether we're switching modes — prevents blur from saving/closing
  const switchingMode = useRef(false);

  // ─── State ───
  const initialName = value?.name || legacyValue || '';
  const [query, setQuery] = useState(initialName);
  const [mode, setMode] = useState<'search' | 'custom'>(value?.isCustom ? 'custom' : 'search');
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Custom mode fields
  const [customName, setCustomName] = useState(value?.isCustom ? value.name : '');
  const [customAddress, setCustomAddress] = useState(value?.isCustom ? value.address || '' : '');

  // ─── Init Google Places services ───
  useEffect(() => {
    if (!places) return;
    autocompleteService.current = new places.AutocompleteService();
    const div = document.createElement('div');
    placesService.current = new places.PlacesService(div);
  }, [places]);

  // Auto-focus on mount and mode switch
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [mode]);

  // ─── Fetch autocomplete predictions ───
  const fetchPredictions = useCallback(
    (input: string) => {
      if (!autocompleteService.current || input.trim().length < 2) {
        setPredictions([]);
        setShowDropdown(false);
        return;
      }

      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      debounceTimer.current = setTimeout(() => {
        // Use 'establishment' type — 'lodging' is not valid for Autocomplete API
        const request: google.maps.places.AutocompletionRequest = {
          input: destination ? `${input} hotel ${destination}` : input,
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

  // ─── Select a prediction ───
  const selectPrediction = useCallback(
    (prediction: google.maps.places.AutocompletePrediction) => {
      const name =
        prediction.structured_formatting?.main_text || prediction.description;
      setQuery(name);
      setShowDropdown(false);
      setPredictions([]);

      // Get full place details
      if (placesService.current) {
        placesService.current.getDetails(
          {
            placeId: prediction.place_id,
            fields: ['geometry', 'formatted_address', 'name'],
          },
          (place, status) => {
            if (
              status === google.maps.places.PlacesServiceStatus.OK &&
              place?.geometry?.location
            ) {
              onSave({
                name: place.name || name,
                placeId: prediction.place_id,
                address: place.formatted_address || undefined,
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
              });
            } else {
              onSave({
                name,
                placeId: prediction.place_id,
              });
            }
          },
        );
      } else {
        onSave({ name, placeId: prediction.place_id });
      }
    },
    [onSave],
  );

  // ─── Save custom accommodation ───
  const handleCustomSave = () => {
    if (switchingMode.current) return;
    if (!customName.trim()) {
      onCancel();
      return;
    }
    onSave({
      name: customName.trim(),
      address: customAddress.trim() || undefined,
      isCustom: true,
    });
  };

  // ─── Save freeform text (no autocomplete selection) ───
  const handleFreeformSave = () => {
    if (switchingMode.current) return;
    if (!query.trim()) {
      onCancel();
      return;
    }
    // If they typed but didn't select, save as plain name
    onSave({ name: query.trim() });
  };

  // ─── Switch mode helper (prevents blur race) ───
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

  // ─── Keyboard handling ───
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
      onCancel();
      return;
    }

    if (!showDropdown || predictions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleFreeformSave();
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
      } else {
        handleFreeformSave();
      }
    }
  };

  // ═══ CUSTOM MODE (Airbnb/Villa) ═══
  if (mode === 'custom') {
    return (
      <div ref={containerRef} className="flex flex-col gap-1.5" style={{ minWidth: 200 }}>
        <div className="flex items-center gap-1.5">
          <PerriandIcon name="hotel" size={12} color={accentColor} />
          <input
            ref={inputRef}
            type="text"
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') onCancel();
              if (e.key === 'Enter') handleCustomSave();
            }}
            placeholder="e.g. Airbnb in Shibuya…"
            style={{
              fontFamily: FONT.sans,
              fontSize: 11,
              fontWeight: 600,
              color: textColor,
              background: 'transparent',
              border: 'none',
              borderBottom: `1px solid ${accentColor}`,
              outline: 'none',
              padding: '0 2px 1px',
              width: 140,
            }}
          />
        </div>
        <div className="flex items-center gap-1.5 ml-4">
          <input
            type="text"
            value={customAddress}
            onChange={e => setCustomAddress(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') onCancel();
              if (e.key === 'Enter') handleCustomSave();
            }}
            onBlur={handleCustomSave}
            placeholder="Address (optional)"
            style={{
              fontFamily: FONT.sans,
              fontSize: 10,
              color: INK['60'],
              background: 'transparent',
              border: 'none',
              borderBottom: `1px dashed ${INK['20']}`,
              outline: 'none',
              padding: '0 2px 1px',
              width: 140,
            }}
          />
        </div>
        <button
          onMouseDown={e => { e.preventDefault(); switchToSearch(); }}
          className="text-left ml-4 cursor-pointer"
          style={{
            fontFamily: FONT.sans,
            fontSize: 9,
            color: accentColor,
            background: 'none',
            border: 'none',
            padding: 0,
            textDecoration: 'underline',
            textUnderlineOffset: 2,
          }}
        >
          Search hotels instead
        </button>
      </div>
    );
  }

  // ═══ SEARCH MODE (Google Places Autocomplete) ═══
  return (
    <div ref={containerRef} className="relative" style={{ minWidth: 200 }}>
      <div className="flex items-center gap-1">
        <PerriandIcon name="hotel" size={12} color={accentColor} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            fetchPredictions(e.target.value);
          }}
          onBlur={() => {
            // Delay to allow click on dropdown or mode switch
            setTimeout(() => {
              if (!switchingMode.current) handleFreeformSave();
            }, 250);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search hotel…"
          style={{
            fontFamily: FONT.sans,
            fontSize: 11,
            fontWeight: 600,
            color: textColor,
            background: 'transparent',
            border: 'none',
            borderBottom: `1px solid ${accentColor}`,
            outline: 'none',
            padding: '0 2px 1px',
            width: 140,
          }}
        />
      </div>

      {/* Autocomplete dropdown */}
      {showDropdown && predictions.length > 0 && (
        <div
          className="absolute left-0 top-full mt-1 rounded-lg overflow-hidden shadow-lg z-50"
          style={{
            background: 'white',
            border: '1px solid var(--t-linen)',
            width: 280,
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {predictions.map((p, i) => (
            <button
              key={p.place_id}
              onMouseDown={e => {
                e.preventDefault(); // prevent blur
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
                className="text-[12px] font-medium"
                style={{ color: 'var(--t-ink)', fontFamily: FONT.sans }}
              >
                {p.structured_formatting?.main_text || p.description}
              </span>
              {p.structured_formatting?.secondary_text && (
                <span
                  className="text-[10px] truncate w-full"
                  style={{ color: INK['50'], fontFamily: FONT.sans }}
                >
                  {p.structured_formatting.secondary_text}
                </span>
              )}
            </button>
          ))}

          {/* Custom accommodation option */}
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
            <PerriandIcon name="add" size={11} color={INK['40']} />
            <span
              className="text-[11px]"
              style={{ color: INK['50'], fontFamily: FONT.sans }}
            >
              Airbnb / Villa / Other
            </span>
          </button>
        </div>
      )}

      {/* Quick toggle to custom mode */}
      {!showDropdown && query.length === 0 && (
        <button
          onMouseDown={e => { e.preventDefault(); switchToCustom(); }}
          className="text-left mt-1 cursor-pointer"
          style={{
            fontFamily: FONT.sans,
            fontSize: 9,
            color: INK['40'],
            background: 'none',
            border: 'none',
            padding: 0,
          }}
        >
          or add Airbnb / Villa
        </button>
      )}
    </div>
  );
}

// ─── Wrapper with APIProvider ───
export default function HotelInput(props: HotelInputProps) {
  if (!API_KEY) {
    // Fallback: plain text input if no API key
    return <HotelInputInner {...props} />;
  }

  return (
    <APIProvider apiKey={API_KEY} libraries={['places']}>
      <HotelInputInner {...props} />
    </APIProvider>
  );
}
