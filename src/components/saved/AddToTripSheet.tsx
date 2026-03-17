'use client';

import { ImportedPlace, Trip } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, TEXT } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useBreakpoint';

interface AddToTripSheetProps {
  place: ImportedPlace;
  trips: Trip[];
  onClose: () => void;
  onAdd: (tripId: string) => void;
}

export default function AddToTripSheet({ place, trips, onClose, onAdd }: AddToTripSheetProps) {
  const isDesktop = useIsDesktop();
  return (
    <div
      className={isDesktop ? "fixed inset-0 z-50 flex items-center justify-center" : "fixed inset-0 z-50 flex items-end justify-center"}
      style={{ height: '100dvh' }}
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.3)', ...(isDesktop ? { opacity: 0, animation: 'fadeInBackdrop 200ms ease both' } : {}) }} />
      <div
        onClick={(e) => e.stopPropagation()}
        className={isDesktop ? "relative rounded-2xl px-7 pt-6 pb-8" : "relative w-full rounded-t-2xl px-5 pt-5 pb-8"}
        style={isDesktop ? {
          width: 440, background: 'var(--t-cream)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.12)',
          opacity: 0, animation: 'fadeInUp 250ms ease both',
        } : { maxWidth: 480, background: 'var(--t-cream)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[14px] font-semibold" style={{ color: TEXT.primary, fontFamily: FONT.serif }}>
              Add to trip
            </div>
            <div className="text-[11px]" style={{ color: TEXT.secondary }}>
              {place.name}
            </div>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="flex items-center justify-center"
            style={{ color: TEXT.secondary, background: 'none', border: 'none', cursor: 'pointer', width: 24, height: 24 }}
          >
            <PerriandIcon name="close" size={16} color={TEXT.secondary} />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {trips.map(trip => (
            <button
              key={trip.id}
              onClick={() => onAdd(trip.id)}
              className="flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all card-hover"
              style={{ background: 'white', border: '1px solid var(--t-linen)' }}
            >
              <div>
                <div className="text-[13px] font-semibold" style={{ color: TEXT.primary }}>
                  {trip.name}
                </div>
                <div className="text-[10px]" style={{ color: TEXT.secondary }}>
                  {trip.location} {trip.startDate && `· ${trip.startDate}`}
                </div>
              </div>
              <span className="text-[11px]" style={{ color: '#8a6a2a' }}>Add →</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
