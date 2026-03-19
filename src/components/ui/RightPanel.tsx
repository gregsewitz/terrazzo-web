'use client';

import { useMemo, useState } from 'react';
import { useTripStore } from '@/stores/tripStore';
import GoogleMapView from '@/components/maps/GoogleMapView';
import type { MapMarker } from '@/components/maps/GoogleMapView';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import DreamBoard from '@/components/profile/DreamBoard';
import { FONT, INK, TEXT } from '@/constants/theme';
import { generateDestColor } from '@/lib/destination-helpers';

export default function RightPanel() {
  const [collapsed, setCollapsed] = useState(true);

  const trips = useTripStore(s => s.trips);
  const currentTripId = useTripStore(s => s.currentTripId);
  const trip = useMemo(() => trips.find(t => t.id === currentTripId), [trips, currentTripId]);

  // Build map markers from all days
  const { markers, fallbackDest, fallbackCoords } = useMemo(() => {
    if (!trip) return { markers: [] as MapMarker[], fallbackDest: '', fallbackCoords: undefined };

    const allMarkers: MapMarker[] = [];
    trip.days.forEach(day => {
      const destColor = generateDestColor(day.destination || '');
      day.slots.forEach(slot => {
        slot.places.forEach(p => {
          allMarkers.push({
            id: p.id,
            name: p.name,
            location: p.location || day.destination || '',
            type: p.type,
            matchScore: p.matchScore,
            color: destColor.accent,
          });
        });
      });
    });

    const firstDest = trip.days[0]?.destination || trip.location?.split(',')[0]?.trim() || '';
    const geo = trip.geoDestinations?.find(
      g => g.name.toLowerCase() === firstDest.toLowerCase()
    );
    const coords = geo?.lat && geo?.lng ? { lat: geo.lat, lng: geo.lng } : undefined;

    return { markers: allMarkers, fallbackDest: firstDest, fallbackCoords: coords };
  }, [trip]);

  // Dream board entry count for the collapsed indicator
  const entryCount = useMemo(() => {
    const entries = trip?.dreamBoard || trip?.scratchpad || [];
    return entries.filter((e: { type: string }) => e.type !== 'divider').length;
  }, [trip?.dreamBoard, trip?.scratchpad]);

  // ═══ COLLAPSED STATE ═══
  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center h-full cursor-pointer"
        style={{
          width: 48,
          flexShrink: 0,
          background: 'white',
          borderLeft: `1px solid ${INK['06']}`,
          boxShadow: '-2px 0 8px rgba(0,42,85,0.04)',
          transition: 'width 200ms ease, box-shadow 200ms ease',
        }}
        onClick={() => setCollapsed(false)}
      >
        {/* Expand chevron */}
        <div
          className="flex items-center justify-center mt-3 mb-3"
          style={{ width: 28, height: 28, borderRadius: '50%', background: INK['04'] }}
        >
          <PerriandIcon name="arrow-left" size={11} color={TEXT.secondary} />
        </div>

        {/* Rotated label */}
        <div
          style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            fontFamily: FONT.serif,
            fontSize: 11,
            fontWeight: 500,
            fontStyle: 'italic',
            color: TEXT.secondary,
          }}
        >
          Dream Board
        </div>

        {/* Entry count + map pin indicator */}
        <div className="flex flex-col items-center gap-2 mt-4">
          {entryCount > 0 && (
            <div
              className="flex items-center justify-center"
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: INK['06'],
              }}
            >
              <span style={{ fontFamily: FONT.mono, fontSize: 9, fontWeight: 600, color: TEXT.secondary }}>
                {entryCount}
              </span>
            </div>
          )}
          {markers.length > 0 && (
            <div
              className="flex items-center justify-center"
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'rgba(58,128,136,0.1)',
              }}
            >
              <PerriandIcon name="location" size={10} color="var(--t-dark-teal)" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══ EXPANDED STATE ═══
  return (
    <div
      className="flex flex-col h-full"
      style={{
        width: 360,
        flexShrink: 0,
        background: 'white',
        borderLeft: `1px solid ${INK['06']}`,
        transition: 'width 200ms ease',
      }}
    >
      {/* Header — collapse button */}
      <div
        className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
        style={{ borderBottom: `1px solid ${INK['06']}` }}
      >
        <div className="flex items-center gap-2">
          <PerriandIcon name="edit" size={12} color={INK['35']} />
          <span
            style={{
              fontFamily: FONT.serif,
              fontSize: 13,
              fontWeight: 500,
              fontStyle: 'italic',
              color: TEXT.primary,
            }}
          >
            Dream Board
          </span>
        </div>
        <button
          aria-label="Collapse panel"
          onClick={() => setCollapsed(true)}
          className="flex items-center justify-center cursor-pointer"
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: INK['04'],
            border: 'none',
          }}
        >
          <PerriandIcon name="arrow-right" size={11} color={TEXT.secondary} />
        </button>
      </div>

      {/* Map section */}
      <div className="flex-shrink-0" style={{ borderBottom: `1px solid ${INK['06']}` }}>
        <GoogleMapView
          markers={markers}
          height={200}
          fallbackDestination={fallbackDest}
          fallbackCoords={fallbackCoords}
        />
        {markers.length > 0 && (
          <div
            className="flex items-center gap-2 px-4 py-1.5"
            style={{ background: INK['04'] }}
          >
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--t-dark-teal)' }} />
            <span style={{ fontFamily: FONT.mono, fontSize: 9, color: TEXT.secondary }}>
              {markers.length} place{markers.length !== 1 ? 's' : ''} planned
            </span>
          </div>
        )}
      </div>

      {/* Dream Board — takes all remaining space */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        <DreamBoard compact />
      </div>
    </div>
  );
}
