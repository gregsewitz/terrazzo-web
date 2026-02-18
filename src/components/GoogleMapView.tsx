'use client';

import { useMemo } from 'react';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';

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
  count?: number;
  starred?: number;
  isDashed?: boolean;
  onClick?: () => void;
}
interface GoogleMapViewProps {
  markers: MapMarker[];
  height?: number;
  fallbackDestination?: string; // used to center map when no markers have coordinates
  fallbackCoords?: { lat: number; lng: number }; // geocoded coords from Places API — highest priority fallback
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// Muted map style — matches Terrazzo aesthetic
const MAP_ID = 'terrazzo-map';

function MarkerDot({ marker }: { marker: MapMarker & { lat: number; lng: number } }) {
  const size = marker.count ? Math.min(24 + marker.count * 4, 48) : 22;
  const bgColor = marker.color || (marker.starred && marker.starred > 0 ? '#2a7a56' : '#1c1a17');

  return (
    <AdvancedMarker
      position={{ lat: marker.lat, lng: marker.lng }}
      onClick={marker.onClick}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: marker.onClick ? 'pointer' : 'default' }}>
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: marker.isDashed ? 'transparent' : bgColor,
            border: marker.isDashed ? `2px dashed ${bgColor}` : 'none',
            opacity: marker.isDashed ? 0.7 : 0.9,            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(28,26,23,0.2)',
            color: 'white',
            fontSize: 10,
            fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {marker.count || ''}
        </div>
        <div
          style={{
            fontSize: 9,
            fontWeight: 600,
            marginTop: 3,
            textAlign: 'center',
            maxWidth: 80,
            lineHeight: 1.2,
            fontFamily: "'Space Mono', monospace",
            color: '#1c1a17',
            textShadow: '0 0 3px white, 0 0 3px white',
          }}
        >
          {marker.name}
        </div>
        {marker.starred != null && marker.starred > 0 && (
          <div style={{ color: '#2a7a56', fontSize: 8 }}>{marker.starred} ♡</div>
        )}
      </div>
    </AdvancedMarker>
  );
}
export default function GoogleMapView({ markers, height = 360, fallbackDestination, fallbackCoords }: GoogleMapViewProps) {
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
      const angle = (count * 2.39996) ; // golden angle in radians for even spread
      const offset = 0.0012 * Math.ceil(count / 6); // ~120m radius, grows with density
      return {
        ...m,
        lat: m.lat + Math.cos(angle) * offset,
        lng: m.lng + Math.sin(angle) * offset,
      };
    });
  }, [markers]);

  // Calculate center and zoom from markers, falling back to destination coords
  const defaultCenter = useMemo(() => {
    if (resolved.length > 0) {
      const avgLat = resolved.reduce((s, m) => s + m.lat, 0) / resolved.length;
      const avgLng = resolved.reduce((s, m) => s + m.lng, 0) / resolved.length;
      return { lat: avgLat, lng: avgLng };
    }
    // Prefer geocoded coords from Places API
    if (fallbackCoords) return fallbackCoords;
    // Fall back to destination name lookup
    if (fallbackDestination) {
      const coords = getCityCoords(fallbackDestination);
      if (coords) return coords;
    }
    return { lat: 40, lng: 0 };
  }, [resolved, fallbackCoords, fallbackDestination]);

  const defaultZoom = useMemo(() => {
    if (resolved.length <= 1) return 12;
    const lats = resolved.map(m => m.lat);
    const lngs = resolved.map(m => m.lng);
    const latSpan = Math.max(...lats) - Math.min(...lats);
    const lngSpan = Math.max(...lngs) - Math.min(...lngs);
    const maxSpan = Math.max(latSpan, lngSpan);
    if (maxSpan > 40) return 2;
    if (maxSpan > 20) return 3;
    if (maxSpan > 10) return 4;
    if (maxSpan > 5) return 6;
    if (maxSpan > 1) return 8;
    if (maxSpan > 0.1) return 11;
    return 13;
  }, [resolved]);
  if (!API_KEY) {
    return (
      <div
        className="rounded-xl overflow-hidden flex items-center justify-center"
        style={{ height, border: '1px solid var(--t-linen)', background: 'var(--t-cream)', color: 'rgba(28,26,23,0.65)' }}
      >
        <div className="text-center text-xs" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Google Maps API key not configured
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ height, border: '1px solid var(--t-linen)' }}>
      <APIProvider apiKey={API_KEY}>
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={defaultZoom}
          gestureHandling="greedy"
          disableDefaultUI={false}
          zoomControl={true}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          mapId={MAP_ID}
          style={{ width: '100%', height: '100%' }}
        >
          {resolved.map(m => (
            <MarkerDot key={m.id} marker={m} />
          ))}
        </Map>
      </APIProvider>
    </div>
  );
}

export { getCityCoords, CITY_COORDS };