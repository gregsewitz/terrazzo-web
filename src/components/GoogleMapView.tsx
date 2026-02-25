'use client';

import { useMemo, useState, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { PerriandIcon, PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import { TYPE_ICONS } from '@/constants/placeTypes';

// Well-known city coordinates for demo data
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'tokyo': { lat: 35.6762, lng: 139.6503 },
  'ginza': { lat: 35.6717, lng: 139.7649 },
  'minato': { lat: 35.6581, lng: 139.7514 },
  'azabudai': { lat: 35.6604, lng: 139.7384 },
  'setagaya': { lat: 35.6468, lng: 139.6532 },
  'otemachi': { lat: 35.6860, lng: 139.7640 },
  'taito': { lat: 35.7131, lng: 139.7800 },
  'jingumae': { lat: 35.6704, lng: 139.7079 },
  'minami-aoyama': { lat: 35.6638, lng: 139.7195 },
  'chuo': { lat: 35.6707, lng: 139.7714 },
  'hakone': { lat: 35.2326, lng: 139.1070 },
  'paris': { lat: 48.8566, lng: 2.3522 },
  'venice': { lat: 45.4408, lng: 12.3155 },
  'new york': { lat: 40.7128, lng: -74.0060 },
  'london': { lat: 51.5074, lng: -0.1278 },
  'cotswolds': { lat: 51.8330, lng: -1.6833 },
  'the cotswolds': { lat: 51.8330, lng: -1.6833 },
  'puglia': { lat: 40.7517, lng: 17.2257 },
  'kyoto': { lat: 35.0116, lng: 135.7681 },
  'osaka': { lat: 34.6937, lng: 135.5023 },
  'rome': { lat: 41.9028, lng: 12.4964 },
  'barcelona': { lat: 41.3874, lng: 2.1686 },
  'lisbon': { lat: 38.7223, lng: -9.1393 },
  'berlin': { lat: 52.5200, lng: 13.4050 },
  'stockholm': { lat: 59.3293, lng: 18.0686 },
  'copenhagen': { lat: 55.6761, lng: 12.5683 },
  'mexico city': { lat: 19.4326, lng: -99.1332 },
  'centro histórico': { lat: 19.4326, lng: -99.1332 },
  'palermo': { lat: 38.1157, lng: 13.3615 },
  'taormina': { lat: 37.8516, lng: 15.2881 },
  'sicily': { lat: 37.5994, lng: 14.0154 },
  'noto': { lat: 36.8915, lng: 15.0681 },
  'syracuse': { lat: 37.0755, lng: 15.2866 },
  'agrigento': { lat: 37.3111, lng: 13.5766 },
  'södermalm': { lat: 59.3150, lng: 18.0710 },
  'norrmalm': { lat: 59.3382, lng: 18.0644 },
  'djurgården': { lat: 59.3268, lng: 18.1145 },
  'stureplan': { lat: 59.3370, lng: 18.0740 },
  'lärkstaden': { lat: 59.3420, lng: 18.0810 },
  'mosebacke': { lat: 59.3180, lng: 18.0730 },
  'vesterbro': { lat: 55.6693, lng: 12.5520 },
  'refshalevej': { lat: 55.6917, lng: 12.6083 },
  'tordenskjoldsgade': { lat: 55.6785, lng: 12.5870 },
  'strandgade': { lat: 55.6740, lng: 12.5920 },
  'nybrogade': { lat: 55.6765, lng: 12.5760 },
  'havnegade': { lat: 55.6770, lng: 12.5950 },
  'humlebæk': { lat: 55.9640, lng: 12.5380 },
  'condesa': { lat: 19.4115, lng: -99.1735 },
  'roma norte': { lat: 19.4195, lng: -99.1614 },
  'coyoacán': { lat: 19.3500, lng: -99.1622 },
  'xochimilco': { lat: 19.2572, lng: -99.1036 },
  'polanco': { lat: 19.4342, lng: -99.1962 },
  'juárez': { lat: 19.4274, lng: -99.1559 },
  'chapultepec': { lat: 19.4204, lng: -99.1818 },
  'centro': { lat: 19.4328, lng: -99.1333 },
};

function getCityCoords(location: string): { lat: number; lng: number } | null {
  const loc = location.toLowerCase();
  // Prefer the longest (most specific) match — neighborhood over city
  let best: { coords: { lat: number; lng: number }; len: number } | null = null;
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (loc.includes(city) && (!best || city.length > best.len)) {
      best = { coords, len: city.length };
    }
  }
  return best?.coords ?? null;
}

export interface MapMarker {
  id: string;
  name: string;
  location: string;
  lat?: number;
  lng?: number;
  color?: string;
  type?: string;
  matchScore?: number;
  tasteNote?: string;
  count?: number;
  starred?: number;
  isDashed?: boolean;
  onClick?: () => void;
}
interface GoogleMapViewProps {
  markers: MapMarker[];
  height?: number | string;
  fallbackDestination?: string;
  fallbackCoords?: { lat: number; lng: number };
  onMarkerTap?: (markerId: string) => void;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// Muted map style — matches Terrazzo aesthetic
const MAP_ID = 'terrazzo-map';

function MarkerPin({ marker, isExpanded, onToggle }: {
  marker: MapMarker & { lat: number; lng: number };
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const icon = TYPE_ICONS[(marker.type || '') as keyof typeof TYPE_ICONS] || 'location';
  const isDashed = marker.isDashed;

  return (
    <AdvancedMarker
      position={{ lat: marker.lat, lng: marker.lng }}
      onClick={onToggle}
      zIndex={isExpanded ? 100 : 1}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
        {/* Expanded card */}
        {isExpanded ? (
          <div style={{
            background: isDashed ? '#f7f5f0' : 'white',
            borderRadius: 12,
            padding: '10px 12px',
            boxShadow: `0 4px 20px ${INK['18']}`,
            minWidth: 160,
            maxWidth: 200,
            border: isDashed ? `1.5px dashed ${INK['20']}` : `1px solid ${INK['08']}`,
          }}>
            {isDashed && (
              <div style={{
                fontSize: 8, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px',
                color: INK['70'], fontFamily: FONT.mono,
                marginBottom: 4,
              }}>Suggestion</div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 16 }}>
                <PerriandIcon name={icon} size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: isDashed ? INK['85'] : '#1c1a17',
                  fontFamily: FONT.sans,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{marker.name}</div>
                <div style={{ fontSize: 9, color: INK['70'], fontFamily: FONT.sans }}>
                  {marker.type ? marker.type.charAt(0).toUpperCase() + marker.type.slice(1) : ''}
                  {marker.location ? ` · ${marker.location.split(',')[0]}` : ''}
                </div>
              </div>
              {marker.matchScore && (
                <span style={{
                  fontSize: 9, fontWeight: 700, color: '#c8923a',
                  fontFamily: FONT.mono,
                  background: 'rgba(200,146,58,0.1)',
                  padding: '2px 5px', borderRadius: 4,
                }}>{marker.matchScore}%</span>
              )}
            </div>
            {marker.tasteNote && (
              <div style={{
                fontSize: 10, color: INK['70'], fontStyle: 'italic',
                fontFamily: FONT.sans, lineHeight: 1.4,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{marker.tasteNote}</div>
            )}
          </div>
        ) : (
          /* Compact mini card — name pill with type icon */
          <div style={{
            background: isDashed ? '#f0ebe2' : 'white',
            borderRadius: 20,
            padding: '4px 10px 4px 6px',
            boxShadow: isDashed ? `0 1px 4px ${INK['10']}` : `0 2px 8px ${INK['15']}`,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            border: isDashed ? `1.5px dashed ${INK['30']}` : `1px solid ${INK['08']}`,
            whiteSpace: 'nowrap',
          }}>
            <div style={{ fontSize: 12 }}>
              <PerriandIcon name={icon} size={12} />
            </div>
            <span style={{
              fontSize: 10, fontWeight: 600, color: isDashed ? INK['80'] : '#1c1a17',
              fontFamily: FONT.sans,
              maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{marker.name}</span>
          </div>
        )}
        {/* Pointer triangle */}
        <div style={{
          width: 0, height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: isExpanded ? `8px solid ${isDashed ? '#f7f5f0' : 'white'}` : `6px solid ${isDashed ? 'rgba(245,240,230,0.92)' : 'white'}`,
          marginTop: -1,
          filter: `drop-shadow(0 2px 2px ${INK['10']})`,
        }} />
      </div>
    </AdvancedMarker>
  );
}
// Inner component that uses useMap() to auto-fit bounds after mount
function MapFitter({ coords, fallbackCenter }: {
  coords: { lat: number; lng: number }[];
  fallbackCenter: { lat: number; lng: number };
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const fit = () => {
      if (coords.length === 0) {
        map.setCenter(fallbackCenter);
        map.setZoom(14);
        return;
      }

      if (coords.length === 1) {
        map.setCenter(coords[0]);
        map.setZoom(15);
        return;
      }

      // Use Google's fitBounds to perfectly frame all markers
      const bounds = new google.maps.LatLngBounds();
      coords.forEach(c => bounds.extend(c));
      map.fitBounds(bounds, { top: 50, bottom: 80, left: 40, right: 40 });

      // Cap max zoom so we don't zoom in too far on clustered markers
      const listener = map.addListener('idle', () => {
        const z = map.getZoom();
        if (z != null && z > 16) map.setZoom(16);
        google.maps.event.removeListener(listener);
      });
    };

    // Fit immediately, then again after layout settles (handles overlay/flex timing)
    fit();
    const timer = setTimeout(fit, 150);
    return () => clearTimeout(timer);
  }, [map, coords, fallbackCenter]);

  return null;
}

export default function GoogleMapView({ markers, height = 360, fallbackDestination, fallbackCoords, onMarkerTap }: GoogleMapViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Resolve coordinates with jitter for overlapping pins
  const resolved = useMemo(() => {
    const withCoords = markers
      .map(m => ({
        ...m,
        lat: m.lat ?? getCityCoords(m.location)?.lat,
        lng: m.lng ?? getCityCoords(m.location)?.lng,
      }))
      .filter((m): m is MapMarker & { lat: number; lng: number } => m.lat != null && m.lng != null);

    // Add jitter to markers sharing the same coordinates so they don't stack
    const seen: Record<string, number> = {};
    return withCoords.map(m => {
      const key = `${m.lat.toFixed(4)},${m.lng.toFixed(4)}`;
      const count = seen[key] || 0;
      seen[key] = count + 1;
      if (count === 0) return m;
      // Spread in a circle around the base point (~100m per step)
      const angle = (count * 2.39996); // golden angle in radians for even spread
      const offset = 0.0012 * Math.ceil(count / 6); // ~120m radius, grows with density
      return {
        ...m,
        lat: m.lat + Math.cos(angle) * offset,
        lng: m.lng + Math.sin(angle) * offset,
      };
    });
  }, [markers]);

  // Pre-jitter coords for fitBounds (avoids jitter inflating the bounds)
  const originalCoords = useMemo(() =>
    markers
      .map(m => ({
        lat: m.lat ?? getCityCoords(m.location)?.lat,
        lng: m.lng ?? getCityCoords(m.location)?.lng,
      }))
      .filter((m): m is { lat: number; lng: number } => m.lat != null && m.lng != null),
    [markers]
  );

  // Fallback center when no markers resolve
  const fallbackCenter = useMemo(() => {
    if (fallbackCoords) return fallbackCoords;
    if (fallbackDestination) {
      const coords = getCityCoords(fallbackDestination);
      if (coords) return coords;
    }
    return { lat: 40, lng: 0 };
  }, [fallbackCoords, fallbackDestination]);
  if (!API_KEY) {
    return (
      <div
        className="rounded-xl overflow-hidden flex items-center justify-center"
        style={{ height, border: '1px solid var(--t-linen)', background: 'var(--t-cream)', color: INK['90'] }}
      >
        <div className="text-center text-xs" style={{ fontFamily: FONT.sans }}>
          Google Maps API key not configured
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ height, border: '1px solid var(--t-linen)' }}>
      <APIProvider apiKey={API_KEY}>
        <Map
          defaultCenter={fallbackCenter}
          defaultZoom={13}
          gestureHandling="greedy"
          disableDefaultUI={false}
          zoomControl={true}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          mapId={MAP_ID}
          style={{ width: '100%', height: '100%' }}
        >
          <MapFitter coords={originalCoords} fallbackCenter={fallbackCenter} />
          {resolved.map(m => (
            <MarkerPin
              key={m.id}
              marker={m}
              isExpanded={expandedId === m.id}
              onToggle={() => setExpandedId(prev => prev === m.id ? null : m.id)}
            />
          ))}
        </Map>
      </APIProvider>
    </div>
  );
}

export { getCityCoords, CITY_COORDS };