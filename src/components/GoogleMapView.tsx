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
  'london': { lat: 51.5074, lng: -0.1278 },  'puglia': { lat: 40.7517, lng: 17.2257 },
  'kyoto': { lat: 35.0116, lng: 135.7681 },
  'osaka': { lat: 34.6937, lng: 135.5023 },
  'rome': { lat: 41.9028, lng: 12.4964 },
  'barcelona': { lat: 41.3874, lng: 2.1686 },
  'lisbon': { lat: 38.7223, lng: -9.1393 },
  'berlin': { lat: 52.5200, lng: 13.4050 },
};

function getCityCoords(location: string): { lat: number; lng: number } | null {
  const loc = location.toLowerCase();
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (loc.includes(city)) return coords;
  }
  return null;
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
export default function GoogleMapView({ markers, height = 360 }: GoogleMapViewProps) {
  // Resolve coordinates
  const resolved = useMemo(() => {
    return markers
      .map(m => ({
        ...m,
        lat: m.lat ?? getCityCoords(m.location)?.lat,
        lng: m.lng ?? getCityCoords(m.location)?.lng,
      }))
      .filter((m): m is MapMarker & { lat: number; lng: number } => m.lat != null && m.lng != null);
  }, [markers]);

  // Calculate center and zoom from markers
  const defaultCenter = useMemo(() => {
    if (resolved.length === 0) return { lat: 40, lng: 0 };
    const avgLat = resolved.reduce((s, m) => s + m.lat, 0) / resolved.length;
    const avgLng = resolved.reduce((s, m) => s + m.lng, 0) / resolved.length;
    return { lat: avgLat, lng: avgLng };
  }, [resolved]);

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
        style={{ height, border: '1px solid var(--t-linen)', background: 'var(--t-cream)', color: 'rgba(28,26,23,0.4)' }}
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