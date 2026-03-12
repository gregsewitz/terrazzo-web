'use client';

import { motion } from 'framer-motion';
import PageTransition from '@/components/PageTransition';
import { useTripStore } from '@/stores/tripStore';
import { useRouter } from 'next/navigation';
import TabBar from '@/components/TabBar';
import DesktopNav from '@/components/DesktopNav';
import ProfileAvatar from '@/components/ProfileAvatar';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK, COLORS } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import { DEST_COLORS } from '@/types';
import { SafeFadeIn } from '@/components/animations/SafeFadeIn';

/* ─── Animation constants (desktop only) ─── */
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function TripsPage() {
  const trips = useTripStore(s => s.trips);
  const router = useRouter();
  const isDesktop = useIsDesktop();

  /* ─── Desktop Trips layout ─── */
  if (isDesktop) {
    return (
      <PageTransition className="min-h-screen" style={{ background: 'var(--t-cream)' }}>
        <DesktopNav />
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 48px 48px' }}>
          {/* Header - Kinetic Dreamer editorial style */}
          <div className="flex items-end justify-between mb-10">
            <div>
              <SafeFadeIn direction="up" distance={10} duration={0.5}>
                <h1
                  style={{
                    fontFamily: FONT.display,
                    fontSize: 48,
                    color: COLORS.navy,
                    margin: 0,
                    lineHeight: 0.9,
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                  }}
                >
                  Your Trips
                </h1>
              </SafeFadeIn>
              <p style={{ fontFamily: FONT.mono, fontSize: 11, color: INK['60'], margin: '10px 0 0', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {trips.length} {trips.length === 1 ? 'trip' : 'trips'} in progress
              </p>
            </div>
            <motion.button
              onClick={() => router.push('/trips/new')}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-7 py-3.5 border-none cursor-pointer text-[14px] font-medium btn-hover"
              style={{ background: COLORS.coral, color: 'white', fontFamily: FONT.display, letterSpacing: '0.1em', textTransform: 'uppercase', borderRadius: 0 }}
            >
              <span className="text-lg">+</span> New Trip
            </motion.button>
          </div>

          {/* Trip cards grid - Large image cards with generous spacing */}
          <div
            className="grid gap-6"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}
          >
            {trips.map((trip, index) => {
              const destKey = trip.destinations?.[0];
              const destColor = destKey && DEST_COLORS[destKey] ? DEST_COLORS[destKey] : null;
              const dayCount = trip.days.length;
              const placedCount = trip.days.reduce((n, d) => n + d.slots.filter(s => s.places.length > 0).length, 0);

              return (
                <SafeFadeIn
                  key={trip.id}
                  direction="up"
                  distance={20}
                  duration={0.5}
                  delay={0.1 + index * 0.06}
                >
                  <button
                    onClick={() => router.push(`/trips/${trip.id}`)}
                    className="border-none cursor-pointer text-left overflow-hidden card-hover w-full"
                    style={{
                      background: 'white',
                      border: `2px solid ${COLORS.navy}`,
                      borderRadius: 0,
                    }}
                  >
                  {/* Color accent bar - bold geometric */}
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
                    style={{
                      height: 8,
                      background: destColor?.accent || COLORS.coral,
                      originX: 0,
                    }}
                  />
                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      <div
                        className="w-14 h-14 flex items-center justify-center flex-shrink-0"
                        style={{ background: destColor ? `${destColor.accent}20` : `${COLORS.peach}`, borderRadius: 0 }}
                      >
                        <PerriandIcon name="plan" size={24} color={destColor?.accent || COLORS.coral} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-[18px] truncate mb-1"
                          style={{ fontFamily: FONT.display, color: COLORS.navy, letterSpacing: '0.02em', textTransform: 'uppercase' }}
                        >
                          {trip.name}
                        </div>
                        <div className="text-[13px]" style={{ color: INK['70'], fontFamily: FONT.sans }}>
                          {trip.location}
                        </div>
                      </div>
                      {trip.status && (
                        <span
                          className="text-[10px] px-3 py-1.5 flex-shrink-0 whitespace-nowrap flex items-center gap-1.5"
                          style={{
                            background: trip.status === 'planning' ? COLORS.mint : COLORS.ochre,
                            color: COLORS.navy,
                            fontFamily: FONT.mono,
                            borderRadius: 0,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                          }}
                        >
                          <PerriandIcon
                            name={trip.status === 'planning' ? 'pin' : 'star'}
                            size={10}
                            color={COLORS.navy}
                          />
                          {trip.status === 'planning' ? 'Planning' : 'Dreaming'}
                        </span>
                      )}
                    </div>

                    {/* Stats row */}
                    <div
                      className="flex items-center gap-5 mt-5 pt-4"
                      style={{ borderTop: `1px solid ${INK['10']}` }}
                    >
                      <div className="flex items-center gap-2">
                        <PerriandIcon name="plan" size={14} color={INK['40']} />
                        <span style={{ fontFamily: FONT.mono, fontSize: 11, color: INK['60'], letterSpacing: '0.03em' }}>
                          {dayCount} {dayCount === 1 ? 'day' : 'days'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <PerriandIcon name="pin" size={14} color={INK['40']} />
                        <span style={{ fontFamily: FONT.mono, fontSize: 11, color: INK['60'], letterSpacing: '0.03em' }}>
                          {placedCount} {placedCount === 1 ? 'place' : 'places'}
                        </span>
                      </div>
                      {trip.startDate && (
                        <div className="flex items-center gap-2">
                          <span style={{ fontFamily: FONT.mono, fontSize: 11, color: INK['50'] }}>
                            {trip.startDate}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  </button>
                </SafeFadeIn>
              );
            })}

            {/* Create CTA - Bold geometric */}
            <SafeFadeIn
              direction="up"
              distance={20}
              duration={0.5}
              delay={0.1 + trips.length * 0.06}
            >
              <button
                onClick={() => router.push('/trips/new')}
                className="flex flex-col items-center justify-center gap-4 border-none cursor-pointer transition-all hover:scale-[1.01] w-full"
                style={{
                  minHeight: 200,
                  background: COLORS.peach,
                  border: `2px dashed ${COLORS.coral}`,
                  borderRadius: 0,
                  color: COLORS.navy,
                }}
              >
              <div
                className="w-14 h-14 flex items-center justify-center"
                style={{ background: COLORS.coral, borderRadius: 0 }}
              >
                <span style={{ fontSize: 28, color: 'white' }}>+</span>
              </div>
              <span style={{ fontFamily: FONT.display, fontSize: 18, color: COLORS.navy, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Start a New Trip</span>
              <span className="text-[12px]" style={{ color: INK['70'], fontFamily: FONT.sans }}>
                Tell us where and when — we'll find your perfect places
              </span>
              </button>
            </SafeFadeIn>
          </div>
        </div>
      </PageTransition>
    );
  }

  /* ─── Mobile layout - Kinetic Dreamer ─── */
  return (
    <div
      className="min-h-screen pb-16"
      style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}
    >
      <div className="px-4 pt-6">
        <div className="flex items-center justify-between mb-2">
          <h1
            style={{ fontFamily: FONT.display, fontSize: 28, color: COLORS.navy, letterSpacing: '0.02em', textTransform: 'uppercase' }}
          >
            Your Trips
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/trips/new')}
              className="flex items-center gap-1.5 px-4 py-2 border-none cursor-pointer text-[11px] font-medium transition-all hover:opacity-80"
              style={{ background: COLORS.coral, color: 'white', fontFamily: FONT.display, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: 0 }}
            >
              <span className="text-sm">+</span> New
            </button>
            <ProfileAvatar />
          </div>
        </div>
        <p className="text-xs mb-6" style={{ color: INK['70'], fontFamily: FONT.mono, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
          Plan and curate your bespoke itinerary
        </p>

        <div
          className="flex flex-col gap-4"
        >
          {trips.map(trip => (
            <button
              key={trip.id}
              onClick={() => router.push(`/trips/${trip.id}`)}
              className="flex items-center gap-4 p-4 border-none cursor-pointer text-left transition-all hover:scale-[1.01]"
              style={{ background: 'white', border: `2px solid ${COLORS.navy}`, borderRadius: 0 }}
            >
              <div
                className="w-12 h-12 flex items-center justify-center text-lg"
                style={{ background: COLORS.peach, borderRadius: 0 }}
              >
                <PerriandIcon name="plan" size={20} color={COLORS.coral} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate" style={{ fontFamily: FONT.display, fontSize: 16, color: COLORS.navy, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                    {trip.name}
                  </span>
                  {trip.status && (
                    <span className="text-[9px] px-2 py-1 flex-shrink-0 whitespace-nowrap flex items-center gap-1" style={{ background: trip.status === 'planning' ? COLORS.mint : COLORS.ochre, color: COLORS.navy, fontFamily: FONT.mono, borderRadius: 0 }}>
                      <PerriandIcon name={trip.status === 'planning' ? 'pin' : 'star'} size={10} color={COLORS.navy} />
                      {trip.status === 'planning' ? 'Planning' : 'Dreaming'}
                    </span>
                  )}
                </div>
                <div className="text-[11px] mt-1" style={{ color: INK['70'], fontFamily: FONT.sans }}>
                  {trip.location} · {trip.days.length} days
                </div>
              </div>
              <span style={{ color: COLORS.coral, fontSize: 18 }}>→</span>
            </button>
          ))}

        </div>
      </div>
      <TabBar />
    </div>
  );
}
