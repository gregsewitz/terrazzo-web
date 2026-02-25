'use client';

import React from 'react';
import { Trip, ImportedPlace, GhostSourceType, SOURCE_STYLES, SLOT_ICONS, DEST_COLORS } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';

interface OverviewItineraryProps {
  trip: Trip;
  onTapDay: (dayNum: number) => void;
  onTapDetail: (item: ImportedPlace) => void;
}

function OverviewItineraryInner({ trip, onTapDay, onTapDetail }: OverviewItineraryProps) {
  const totalPlaces = trip.days.reduce((acc, d) => acc + d.slots.reduce((a, s) => a + s.places.length, 0), 0);
  const totalSlots = trip.days.reduce((acc, d) => acc + d.slots.length, 0);

  return (
    <div className="px-3 py-3 pb-48" style={{ background: 'var(--t-cream)' }}>
      {/* Summary */}
      <div className="flex items-baseline justify-between mb-2.5 px-1">
        <span style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['85'] }}>
          {totalPlaces} place{totalPlaces !== 1 ? 's' : ''} planned
        </span>
        <span style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['75'] }}>
          {totalSlots - totalPlaces} slot{(totalSlots - totalPlaces) !== 1 ? 's' : ''} open
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {trip.days.map(d => {
          const dColor = DEST_COLORS[d.destination || ''] || { bg: '#f5f0e6', accent: '#8a7a6a', text: '#5a4a3a' };
          const shortDay = d.dayOfWeek?.slice(0, 3) || '';
          const allPlaced = d.slots.flatMap(s => s.places.map(p => ({ place: p, slot: s })));

          return (
            <div key={d.dayNumber}>
              {/* Day header — tappable to jump to planner */}
              <div
                className="flex items-center justify-between px-3 py-1.5 rounded-t-lg cursor-pointer"
                style={{ background: dColor.bg }}
                onClick={() => onTapDay(d.dayNumber)}
              >
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: FONT.sans, fontSize: 12, fontWeight: 700, color: dColor.text }}>
                    {shortDay} {d.date}
                  </span>
                  <span style={{ fontFamily: FONT.sans, fontSize: 11, fontWeight: 500, color: dColor.accent }}>
                    {d.destination}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {(d.hotelInfo || d.hotel) && (
                    <span className="flex items-center gap-1" style={{ fontFamily: FONT.sans, fontSize: 10, color: dColor.accent, opacity: 0.85 }}>
                      <PerriandIcon name="hotel" size={11} color={dColor.accent} />
                      {d.hotelInfo?.name || d.hotel}
                    </span>
                  )}
                  <span style={{ fontFamily: FONT.mono, fontSize: 9, color: dColor.accent, opacity: 0.8 }}>
                    {allPlaced.length}/{d.slots.length}
                  </span>
                </div>
              </div>

              {/* Place rows */}
              <div className="rounded-b-lg overflow-hidden" style={{ border: `1px solid ${dColor.accent}15`, borderTop: 'none' }}>
                {allPlaced.length === 0 ? (
                  <div
                    className="px-3 py-3 text-center cursor-pointer"
                    style={{ background: 'white' }}
                    onClick={() => onTapDay(d.dayNumber)}
                  >
                    <span style={{ fontFamily: FONT.sans, fontSize: 11, color: INK['80'] }}>
                      No places yet — tap to plan
                    </span>
                  </div>
                ) : (
                  allPlaced.map(({ place, slot }, idx) => {
                    const srcStyle = SOURCE_STYLES[place.ghostSource as GhostSourceType] || SOURCE_STYLES.manual;
                    const isReservation = place.ghostSource === 'email';
                    const subtitle = place.friendAttribution?.note || place.terrazzoReasoning?.rationale || place.tasteNote || '';
                    const truncSub = subtitle.length > 65 ? subtitle.slice(0, 62) + '…' : subtitle;

                    return (
                      <div
                        key={place.id}
                        onClick={() => onTapDetail(place)}
                        className="flex items-start gap-2.5 px-3 py-2 cursor-pointer"
                        style={{ background: 'white', borderTop: idx > 0 ? '1px solid var(--t-linen)' : undefined }}
                      >
                        <div style={{ width: isReservation ? 3 : 2, height: 30, borderRadius: 2, background: isReservation ? srcStyle.color : 'var(--t-verde)', flexShrink: 0, marginTop: 2 }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <PerriandIcon name={SLOT_ICONS[slot.id] as any || 'pin'} size={12} color="var(--t-ink)" />
                            <span style={{ fontFamily: FONT.sans, fontSize: 13, fontWeight: 600, color: 'var(--t-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                              {place.name}
                            </span>
                            <span className="flex-shrink-0 px-1.5 py-0.5 rounded flex items-center gap-0.5" style={{ fontSize: 9, fontWeight: 600, background: srcStyle.bg, color: srcStyle.color, fontFamily: FONT.mono }}>
                              <PerriandIcon name={srcStyle.icon} size={10} color={srcStyle.color} />
                              {place.source?.name || srcStyle.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['80'], whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {slot.time}
                            </span>
                            {truncSub && (
                              <span style={{ fontFamily: FONT.sans, fontSize: 10, fontStyle: 'italic', color: INK['85'], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {truncSub}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const OverviewItinerary = React.memo(OverviewItineraryInner);
OverviewItinerary.displayName = 'OverviewItinerary';
export default OverviewItinerary;
