'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// ============================================================
// Types
// ============================================================
export interface Destination {
  name: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  formattedAddress?: string;
}

interface DestinationInputProps {
  destinations: Destination[];
  onChange: (destinations: Destination[]) => void;
  isDreaming?: boolean; // relaxed mode — allows freeform without autocomplete
}

// ============================================================
// Inner component (must be inside APIProvider)
// ============================================================
function DestinationInputInner({ destinations, onChange, isDreaming }: DestinationInputProps) {
  const places = useMapsLibrary('places');
  const [inputValue, setInputValue] = useState('');
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Initialize services when places library loads
  useEffect(() => {
    if (!places) return;
    autocompleteService.current = new places.AutocompleteService();
    // PlacesService needs a div (attribution requirement)
    const div = document.createElement('div');
    placesService.current = new places.PlacesService(div);
  }, [places]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch predictions with debounce
  const fetchPredictions = useCallback((input: string) => {
    if (!autocompleteService.current || input.trim().length < 2) {
      setPredictions([]);
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      autocompleteService.current!.getPlacePredictions(
        {
          input,
          types: ['(regions)'], // cities, regions, countries — not businesses
        },
        (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            setPredictions(results);
            setShowDropdown(true);
            setActiveIndex(-1);
          } else {
            setPredictions([]);
          }
        },
      );
    }, 250);
  }, []);

  // Get place details (lat/lng) after selection
  const getPlaceDetails = useCallback((placeId: string, name: string) => {
    if (!placesService.current) {
      // Fallback — add without coords
      addDestination({ name, placeId });
      return;
    }

    placesService.current.getDetails(
      { placeId, fields: ['geometry', 'formatted_address', 'name'] },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          addDestination({
            name: place.name || name,
            placeId,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            formattedAddress: place.formatted_address || undefined,
          });
        } else {
          addDestination({ name, placeId });
        }
      },
    );
  }, [destinations, onChange]); // eslint-disable-line react-hooks/exhaustive-deps

  const addDestination = useCallback((dest: Destination) => {
    // Deduplicate by name
    const exists = destinations.some(d => d.name.toLowerCase() === dest.name.toLowerCase());
    if (!exists) {
      onChange([...destinations, dest]);
    }
    setInputValue('');
    setPredictions([]);
    setShowDropdown(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [destinations, onChange]);

  const removeDestination = (index: number) => {
    onChange(destinations.filter((_, i) => i !== index));
  };

  const handleSelect = (prediction: google.maps.places.AutocompletePrediction) => {
    const mainText = prediction.structured_formatting.main_text;
    getPlaceDetails(prediction.place_id, mainText);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, predictions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && predictions[activeIndex]) {
        handleSelect(predictions[activeIndex]);
      } else if (inputValue.trim() && isDreaming) {
        // In dreaming mode, allow freeform entry
        addDestination({ name: inputValue.trim() });
      } else if (inputValue.trim() && predictions.length > 0) {
        // Auto-select first prediction
        handleSelect(predictions[0]);
      } else if (inputValue.trim()) {
        // No predictions available — add as freeform
        addDestination({ name: inputValue.trim() });
      }
    } else if (e.key === 'Backspace' && !inputValue && destinations.length > 0) {
      // Remove last destination on backspace in empty input
      removeDestination(destinations.length - 1);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    if (value.trim().length >= 2) {
      fetchPredictions(value);
    } else {
      setPredictions([]);
      setShowDropdown(false);
    }
  };

  return (
    <div className="relative">
      {/* Destination chips */}
      <div
        className="flex flex-wrap items-center gap-1.5 min-h-[40px] pb-2.5 border-0 border-b"
        style={{ borderColor: 'var(--t-linen)' }}
      >
        {destinations.map((dest, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px]"
            style={{
              background: dest.lat ? 'rgba(42,122,86,0.08)' : 'rgba(200,146,58,0.1)',
              color: dest.lat ? 'var(--t-verde)' : 'var(--t-honey)',
              fontFamily: FONT.sans,
              fontWeight: 500,
            }}
          >
            <PerriandIcon name={dest.lat ? 'location' : 'profile'} size={11} />
            {dest.name}
            <button
              onClick={() => removeDestination(i)}
              className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-transparent border-none cursor-pointer hover:opacity-70"
              style={{ color: 'inherit' }}
            >
              <PerriandIcon name="close" size={10} />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (predictions.length > 0) setShowDropdown(true); }}
          placeholder={destinations.length === 0
            ? (isDreaming ? 'Somewhere warm, Japan, anywhere...' : 'Search for a city or region...')
            : '+ Add another destination'
          }
          className="flex-1 min-w-[160px] text-[14px] bg-transparent border-none outline-none py-1"
          style={{
            fontFamily: FONT.sans,
            color: 'var(--t-ink)',
          }}
        />
      </div>

      {/* Helper text */}
      <div className="mt-1.5 text-[10px]" style={{ color: INK['90'] }}>
        {isDreaming
          ? 'Type anything — a city, a vibe, a region. Press Enter to add.'
          : destinations.length === 0
            ? 'Start typing to search. Press Enter to add.'
            : `${destinations.length} destination${destinations.length !== 1 ? 's' : ''} · press Enter to add more`
        }
      </div>

      {/* Autocomplete dropdown */}
      {showDropdown && predictions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 z-50 mt-1 rounded-xl overflow-hidden shadow-lg"
          style={{
            background: 'white',
            border: '1px solid var(--t-linen)',
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {predictions.map((prediction, i) => (
            <button
              key={prediction.place_id}
              onClick={() => handleSelect(prediction)}
              className="w-full flex items-start gap-2.5 px-3.5 py-2.5 border-none cursor-pointer text-left transition-colors"
              style={{
                background: i === activeIndex ? 'rgba(200,146,58,0.06)' : 'transparent',
                fontFamily: FONT.sans,
                borderBottom: i < predictions.length - 1 ? '1px solid rgba(237,230,216,0.5)' : 'none',
              }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <div style={{ color: INK['95'] }}>
                <PerriandIcon name="location" size={13} />
              </div>
              <div>
                <div className="text-[13px] font-medium" style={{ color: 'var(--t-ink)' }}>
                  {prediction.structured_formatting.main_text}
                </div>
                <div className="text-[11px]" style={{ color: INK['90'] }}>
                  {prediction.structured_formatting.secondary_text}
                </div>
              </div>
            </button>
          ))}

          {/* Freeform option */}
          {inputValue.trim() && (
            <button
              onClick={() => addDestination({ name: inputValue.trim() })}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 border-none cursor-pointer text-left"
              style={{
                background: activeIndex === predictions.length ? 'rgba(200,146,58,0.06)' : 'rgba(248,243,234,0.5)',
                fontFamily: FONT.sans,
                borderTop: '1px solid var(--t-linen)',
              }}
            >
              <div style={{ color: INK['95'] }}>
                <PerriandIcon name="profile" size={13} />
              </div>
              <div>
                <div className="text-[12px]" style={{ color: INK['95'] }}>
                  Just add "<span style={{ color: 'var(--t-ink)', fontWeight: 500 }}>{inputValue.trim()}</span>" as-is
                </div>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Wrapper with APIProvider
// ============================================================
export default function DestinationInput(props: DestinationInputProps) {
  if (!API_KEY) {
    // Fallback — plain text input when no API key
    return <DestinationInputFallback {...props} />;
  }

  return (
    <APIProvider apiKey={API_KEY} libraries={['places']}>
      <DestinationInputInner {...props} />
    </APIProvider>
  );
}

// ============================================================
// Fallback — simple freeform input when no API key
// ============================================================
function DestinationInputFallback({ destinations, onChange, isDreaming }: DestinationInputProps) {
  const [inputValue, setInputValue] = useState('');

  const addDestination = () => {
    if (!inputValue.trim()) return;
    const exists = destinations.some(d => d.name.toLowerCase() === inputValue.trim().toLowerCase());
    if (!exists) {
      onChange([...destinations, { name: inputValue.trim() }]);
    }
    setInputValue('');
  };

  return (
    <div>
      <div
        className="flex flex-wrap items-center gap-1.5 min-h-[40px] pb-2.5 border-0 border-b"
        style={{ borderColor: 'var(--t-linen)' }}
      >
        {destinations.map((dest, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px]"
            style={{ background: 'rgba(200,146,58,0.1)', color: 'var(--t-honey)' }}
          >
            {dest.name}
            <button
              onClick={() => onChange(destinations.filter((_, idx) => idx !== i))}
              className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-transparent border-none cursor-pointer text-[10px]"
              style={{ color: 'inherit' }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDestination(); } }}
          placeholder={destinations.length === 0 ? 'Type a destination and press Enter...' : '+ Add another'}
          className="flex-1 min-w-[160px] text-[14px] bg-transparent border-none outline-none py-1"
          style={{ fontFamily: FONT.sans, color: 'var(--t-ink)' }}
        />
      </div>
    </div>
  );
}
