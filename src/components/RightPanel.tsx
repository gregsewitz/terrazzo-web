'use client';

import { useMemo, useState } from 'react';
import { useTripStore } from '@/stores/tripStore';
import GoogleMapView from '@/components/GoogleMapView';
import type { MapMarker } from '@/components/GoogleMapView';
import ActivityFeed from '@/components/ActivityFeed';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import Scratchpad from '@/components/Scratchpad';
import { FONT, INK } from '@/constants/theme';
import { DEST_COLORS } from '@/types';
import type { Activity } from '@/stores/collaborationStore';

type RightPanelTab = 'notes' | 'logistics' | 'activity';

interface RightPanelProps {
  activities: Activity[];
}

export default function RightPanel({ activities }: RightPanelProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<RightPanelTab>('notes');

  const trips = useTripStore(s => s.trips);
  const currentTripId = useTripStore(s => s.currentTripId);
  const trip = useMemo(() => trips.find(t => t.id === currentTripId), [trips, currentTripId]);

  // Build map markers from all days
  const { markers, fallbackDest, fallbackCoords } = useMemo(() => {
    if (!trip) return { markers: [] as MapMarker[], fallbackDest: '', fallbackCoords: undefined };

    const allMarkers: MapMarker[] = [];
    trip.days.forEach(day => {
      const destColor = DEST_COLORS[day.destination || ''] || { accent: '#8a7a6a' };
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

  const TABS: { id: RightPanelTab; label: string; icon: string }[] = [
    { id: 'notes', label: 'Notes', icon: 'manual' },
    { id: 'logistics', label: 'Logistics', icon: 'hotel' },
    { id: 'activity', label: 'Activity', icon: 'chatBubble' },
  ];

  // ═══ COLLAPSED STATE ═══
  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center h-full cursor-pointer"
        style={{
          width: 44,
          flexShrink: 0,
          background: 'var(--t-cream)',
          borderLeft: '1px solid var(--t-linen)',
          transition: 'width 200ms ease',
        }}
        onClick={() => setCollapsed(false)}
      >
        {/* Expand chevron */}
        <div
          className="flex items-center justify-center mt-3 mb-2"
          style={{ width: 28, height: 28, borderRadius: '50%', background: INK['04'] }}
        >
          <span style={{ fontSize: 12, color: INK['50'] }}>‹</span>
        </div>
        {/* Rotated label */}
        <div
          style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            fontFamily: FONT.mono,
            fontSize: 9,
            fontWeight: 600,
            color: INK['40'],
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          }}
        >
          Map & Notes
        </div>
        {/* Map pin indicator */}
        {markers.length > 0 && (
          <div
            className="flex items-center justify-center mt-3"
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: 'rgba(42,122,86,0.08)',
            }}
          >
            <span style={{ fontFamily: FONT.mono, fontSize: 8, fontWeight: 700, color: 'var(--t-verde)' }}>
              {markers.length}
            </span>
          </div>
        )}
      </div>
    );
  }

  // ═══ EXPANDED STATE ═══
  return (
    <div
      className="flex flex-col h-full"
      style={{
        width: 320,
        flexShrink: 0,
        background: 'var(--t-cream)',
        borderLeft: '1px solid var(--t-linen)',
        transition: 'width 200ms ease',
      }}
    >
      {/* Collapse button */}
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--t-linen)' }}
      >
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 9,
            fontWeight: 700,
            color: INK['40'],
            textTransform: 'uppercase',
            letterSpacing: 1.5,
          }}
        >
          Map & Notes
        </span>
        <button
          onClick={() => setCollapsed(true)}
          className="flex items-center justify-center cursor-pointer nav-hover"
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: INK['04'],
            border: 'none',
          }}
        >
          <span style={{ fontSize: 11, color: INK['50'] }}>›</span>
        </button>
      </div>

      {/* Map section */}
      <div className="flex-shrink-0" style={{ borderBottom: '1px solid var(--t-linen)' }}>
        <GoogleMapView
          markers={markers}
          height={220}
          fallbackDestination={fallbackDest}
          fallbackCoords={fallbackCoords}
        />
        {markers.length > 0 && (
          <div
            className="flex items-center gap-3 px-3 py-1.5"
            style={{ background: INK['02'] }}
          >
            <div className="flex items-center gap-1">
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--t-verde)' }} />
              <span style={{ fontFamily: FONT.mono, fontSize: 8, color: INK['60'] }}>
                {markers.length} place{markers.length !== 1 ? 's' : ''} planned
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div
        className="flex px-3 pt-2 pb-0 gap-0 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--t-linen)' }}
      >
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-3 pb-1.5 cursor-pointer transition-all"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--t-ink)' : '2px solid transparent',
              fontFamily: FONT.sans,
              fontSize: 11,
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? 'var(--t-ink)' : INK['45'],
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        {activeTab === 'notes' && (
          <Scratchpad compact />
        )}

        {activeTab === 'logistics' && (
          <div className="p-3">
            <div className="flex flex-col gap-2.5">
              {trip?.days.map(day => {
                const destColor = DEST_COLORS[day.destination || ''] || { bg: '#f5f0e6', accent: '#8a7a6a', text: '#5a4a3a' };
                return (
                  <div
                    key={day.dayNumber}
                    className="rounded-lg overflow-hidden"
                    style={{ border: '1px solid var(--t-linen)' }}
                  >
                    <div
                      className="px-3 py-1.5 flex items-center justify-between"
                      style={{ background: destColor.bg }}
                    >
                      <span style={{ fontFamily: FONT.sans, fontSize: 11, fontWeight: 600, color: destColor.text }}>
                        Day {day.dayNumber} — {day.destination || 'TBD'}
                      </span>
                      {(day.hotelInfo || day.hotel) && (
                        <div className="flex items-center gap-1">
                          <PerriandIcon name="hotel" size={10} color={destColor.accent} />
                          <span style={{ fontFamily: FONT.sans, fontSize: 10, color: destColor.accent }}>
                            {day.hotelInfo?.name || day.hotel}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="px-3 py-2" style={{ background: 'white' }}>
                      {day.slots.filter(s => s.places.length > 0).map(slot => (
                        <div key={slot.id} className="flex items-center gap-2 py-1">
                          <span style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['40'], width: 50 }}>
                            {slot.time || slot.label}
                          </span>
                          <span style={{ fontFamily: FONT.sans, fontSize: 11, color: 'var(--t-ink)' }}>
                            {slot.places[0]?.name}
                          </span>
                        </div>
                      ))}
                      {day.slots.filter(s => s.places.length > 0).length === 0 && (
                        <span style={{ fontFamily: FONT.sans, fontSize: 10, color: INK['30'] }}>
                          No reservations yet
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <ActivityFeed activities={activities} />
        )}
      </div>
    </div>
  );
}
