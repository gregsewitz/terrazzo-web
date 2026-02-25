'use client';

import { useState, memo, useCallback } from 'react';
import { Trip, TripDay, SOURCE_STYLES, HotelInfo, TransportEvent, ImportedPlace } from '@/types';
import GoogleMapView from '@/components/GoogleMapView';
import type { MapMarker } from '@/components/GoogleMapView';
import { TransportBanner, TransportInput, getTransportsAfterSlot, getTransportsBeforeSlots } from './TransportBanner';
import HotelInput from './HotelInput';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import { filterGhostsByDestination } from '@/utils/ghostFiltering';

export interface DayContextBarProps {
  day: TripDay;
  trip: Trip;
  currentDay: number;
  destColor: { accent: string; bg: string; text: string };
  onTapDetail: (item: ImportedPlace) => void;
  setDayHotelInfo: (day: number, info: HotelInfo | null) => void;
  setMultipleDaysHotelInfo: (days: number[], info: HotelInfo) => void;
  addTransport: (day: number, t: Omit<TransportEvent, 'id'>) => void;
  removeTransport: (day: number, id: string) => void;
  updateTransport: (day: number, id: string, updates: Partial<TransportEvent>) => void;
  addingTransport: boolean;
  setAddingTransport: (value: boolean) => void;
  editingTransportId: string | null;
  setEditingTransportId: (id: string | null) => void;
}

const DayContextBar = memo(({
  day,
  trip,
  currentDay,
  destColor,
  onTapDetail,
  setDayHotelInfo,
  setMultipleDaysHotelInfo,
  addTransport,
  removeTransport,
  updateTransport,
  addingTransport,
  setAddingTransport,
  editingTransportId,
  setEditingTransportId,
}: DayContextBarProps) => {
  const [editingHotel, setEditingHotel] = useState(false);
  const [dayMapOpen, setDayMapOpen] = useState(false);

  const handleHotelSave = useCallback((hotelInfo: HotelInfo | null) => {
    if (!trip) return;
    const dayObj = trip.days.find(d => d.dayNumber === currentDay);
    if (!dayObj) return;

    setEditingHotel(false);

    // Auto-apply to ALL same-destination days
    if (dayObj.destination) {
      const dest = dayObj.destination;
      const sameDest = trip.days
        .filter(d => d.destination === dest)
        .map(d => d.dayNumber);

      if (hotelInfo) {
        setMultipleDaysHotelInfo(sameDest, hotelInfo);
      } else {
        // Clearing: just clear current day
        setDayHotelInfo(currentDay, null);
      }
    } else {
      setDayHotelInfo(currentDay, hotelInfo);
    }
  }, [trip, currentDay, setDayHotelInfo, setMultipleDaysHotelInfo]);

  // Build map markers
  const placedItems = day.slots.flatMap(s => s.places);
  const ghostItems = filterGhostsByDestination(day.slots, day.destination || '');
  const geo = trip.geoDestinations?.find(
    g => g.name.toLowerCase() === (day.destination || '').toLowerCase()
  );
  const mapMarkers: MapMarker[] = [
    ...placedItems.map((p, i) => ({
      id: `placed-${i}`,
      name: p.name,
      location: p.location || day.destination || '',
      type: p.type,
      matchScore: p.matchScore,
      tasteNote: p.tasteNote,
      color: SOURCE_STYLES.manual.color,
    })),
    ...ghostItems.map((g, i) => ({
      id: `ghost-${i}`,
      name: g.name,
      location: g.location || day.destination || '',
      type: g.type,
      matchScore: g.matchScore,
      tasteNote: g.tasteNote,
      color: SOURCE_STYLES[(g.ghostSource || 'terrazzo') as keyof typeof SOURCE_STYLES]?.color || SOURCE_STYLES.terrazzo.color,
      isDashed: true,
    })),
  ];

  return (
    <>
      <div
        className="flex items-center justify-between px-3.5 py-1.5"
        style={{
          background: destColor.bg,
          borderBottom: dayMapOpen ? 'none' : `1px solid ${destColor.accent}18`,
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {editingHotel ? (
            <HotelInput
              value={day.hotelInfo}
              legacyValue={day.hotel}
              onSave={handleHotelSave}
              onCancel={() => setEditingHotel(false)}
              accentColor={destColor.accent}
              textColor={destColor.text}
              destination={day.destination}
            />
          ) : day.hotel || day.hotelInfo ? (
            <button
              onClick={() => setEditingHotel(true)}
              className="flex flex-col items-start gap-0"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <span className="flex items-center gap-1" style={{
                fontFamily: FONT.sans,
                fontSize: 11,
                fontWeight: 600,
                color: destColor.text,
                whiteSpace: 'nowrap',
              }}>
                <PerriandIcon name="hotel" size={12} color={destColor.text} />
                {day.hotelInfo?.name || day.hotel}
                {day.hotelInfo?.isCustom && (
                  <span style={{ fontSize: 9, fontWeight: 400, color: destColor.accent, opacity: 0.85 }}>
                    (custom)
                  </span>
                )}
              </span>
              {day.hotelInfo?.address && (
                <span style={{
                  fontFamily: FONT.sans,
                  fontSize: 9,
                  color: INK['55'],
                  marginLeft: 16,
                  whiteSpace: 'nowrap',
                  maxWidth: 180,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: 'block',
                }}>
                  {day.hotelInfo.address}
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={() => setEditingHotel(true)}
              className="flex items-center gap-1"
              style={{
                fontFamily: FONT.sans,
                fontSize: 11,
                fontWeight: 500,
                color: `${destColor.accent}cc`,
                whiteSpace: 'nowrap',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <PerriandIcon name="hotel" size={12} color={`${destColor.accent}cc`} />
              + Hotel
            </button>
          )}

          {/* Separator */}
          {(day.hotel || day.hotelInfo) && !editingHotel && (
            <span style={{ color: INK['15'], fontSize: 10 }}>·</span>
          )}

          {/* + Transport button */}
          {!addingTransport && !editingHotel && (
            <button
              onClick={() => setAddingTransport(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{
                fontFamily: FONT.sans,
                fontSize: 10,
                fontWeight: 600,
                color: destColor.text,
                whiteSpace: 'nowrap',
                background: `${destColor.accent}22`,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <PerriandIcon name="transport" size={12} color={destColor.accent} />
              + Transportation
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {placedItems.length >= 2 && (
            <button
              onClick={() => {
                // Build multi-stop Google Maps directions URL from placed items in slot order
                const waypoints = placedItems.map(p => {
                  const g = p.google as Record<string, unknown> & { lat?: number; lng?: number } | undefined;
                  if (g?.lat && g?.lng) return `${g.lat},${g.lng}`;
                  return encodeURIComponent(`${p.name} ${p.location}`);
                });
                const url = `https://www.google.com/maps/dir/${waypoints.join('/')}`;
                window.open(url, '_blank');
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{
                background: `${destColor.accent}15`,
                color: destColor.accent,
                border: 'none',
                cursor: 'pointer',
                fontFamily: FONT.sans,
                fontSize: 10,
                fontWeight: 600,
                transition: 'all 0.2s ease',
              }}
            >
              <PerriandIcon name="discover" size={12} color={destColor.accent} />
              Directions
            </button>
          )}
        </div>
      </div>

      {/* Transport input form (new transport) */}
      {addingTransport && (
        <TransportInput
          fromDefault={day.destination}
          onSave={(t) => {
            addTransport(currentDay, t);
            setAddingTransport(false);
          }}
          onCancel={() => setAddingTransport(false)}
        />
      )}

      {/* Early departures — transports before the first slot */}
      {!addingTransport && getTransportsBeforeSlots(day.transport).map(t => (
        editingTransportId === t.id ? (
          <TransportInput
            key={t.id}
            initial={t}
            fromDefault={day.destination}
            onSave={(updates) => {
              updateTransport(currentDay, t.id, updates);
              setEditingTransportId(null);
            }}
            onCancel={() => setEditingTransportId(null)}
          />
        ) : (
          <TransportBanner
            key={t.id}
            transport={t}
            onEdit={() => setEditingTransportId(t.id)}
            onRemove={() => removeTransport(currentDay, t.id)}
          />
        )
      ))}

      {/* Inline map panel */}
      {dayMapOpen && (
        <div style={{ borderBottom: `1px solid ${destColor.accent}18` }}>
          <GoogleMapView
            key={`map-day-${day.dayNumber}-${day.destination}`}
            markers={mapMarkers}
            height={300}
            fallbackDestination={day.destination}
            fallbackCoords={geo?.lat != null && geo?.lng != null ? { lat: geo.lat, lng: geo.lng } : undefined}
          />
          {/* Map legend */}
          <div className="flex items-center gap-3 px-3.5 py-1.5" style={{ background: INK['02'] }}>
            {placedItems.length > 0 && (
              <div className="flex items-center gap-1">
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: SOURCE_STYLES.manual.color }} />
                <span style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['85'] }}>
                  {placedItems.length} planned
                </span>
              </div>
            )}
            {ghostItems.length > 0 && (
              <div className="flex items-center gap-1">
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: SOURCE_STYLES.terrazzo.color, opacity: 0.5 }} />
                <span style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['80'] }}>
                  {ghostItems.length} suggested
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
});

DayContextBar.displayName = 'DayContextBar';

export default DayContextBar;
