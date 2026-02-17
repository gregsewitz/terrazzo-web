'use client';

import { useState, useMemo } from 'react';
import { SOURCE_STYLES } from '@/types';
import GoogleMapView from '@/components/GoogleMapView';
import type { MapMarker } from '@/components/GoogleMapView';

interface MapViewProps {
  dayNumber: number;
  destination?: string;
  placedItems: Array<{ name: string; type: string; location?: string }>;
  ghostItems: Array<{ name: string; ghostSource?: string; location?: string }>;
}

export default function MapView({
  dayNumber,
  destination = 'Destination',
  placedItems,
  ghostItems,
}: MapViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const mapHeight = isExpanded ? 400 : 220;
  const markers: MapMarker[] = useMemo(() => {
    const placed: MapMarker[] = placedItems.map((item, idx) => ({
      id: `placed-${idx}`,
      name: item.name,
      location: item.location || destination,
      color: SOURCE_STYLES.manual.color,
    }));
    const ghosts: MapMarker[] = ghostItems.map((item, idx) => ({
      id: `ghost-${idx}`,
      name: item.name,
      location: item.location || destination,
      color: SOURCE_STYLES[(item.ghostSource || 'ai') as keyof typeof SOURCE_STYLES]?.color || SOURCE_STYLES.ai.color,
      isDashed: true,
    }));
    return [...placed, ...ghosts];
  }, [placedItems, ghostItems, destination]);

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-0">
        <div
          className="text-sm font-bold uppercase tracking-wider"
          style={{ fontFamily: "'Space Mono', monospace", color: 'var(--t-ink)' }}
        >
          Day {dayNumber} · {destination}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-7 h-7 flex items-center justify-center rounded-full border-none cursor-pointer transition-transform"
          style={{
            background: 'rgba(28,26,23,0.06)',
            color: 'var(--t-ink)',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          ∧
        </button>
      </div>

      <GoogleMapView markers={markers} height={mapHeight} />
    </div>
  );
}