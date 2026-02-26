'use client';

import { motion } from 'framer-motion';
import { useTripStore } from '@/stores/tripStore';
import { useRouter } from 'next/navigation';
import TabBar from '@/components/TabBar';
import DesktopNav from '@/components/DesktopNav';
import ProfileAvatar from '@/components/ProfileAvatar';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import { DEST_COLORS } from '@/types';

/* ─── Animation constants ─── */
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } };
const cardVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT_EXPO } } };

export default function TripsPage() {
  const trips = useTripStore(s => s.trips);
  const router = useRouter();
  const isDesktop = useIsDesktop();

  /* ─── Desktop Trips layout ─── */
  if (isDesktop) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--t-cream)' }}>
        <DesktopNav />
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 48px 48px' }}>
          {/* Header */}
          <div className="flex items-end justify-between mb-8">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
                style={{
                  fontFamily: FONT.serif,
                  fontStyle: 'italic',
                  fontSize: 32,
                  color: 'var(--t-ink)',
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                Your Trips
              </motion.h1>
              <p style={{ fontFamily: FONT.mono, fontSize: 12, color: INK['60'], margin: '6px 0 0' }}>
                {trips.length} {trips.length === 1 ? 'trip' : 'trips'} in progress
              </p>
            </div>
            <motion.button
              onClick={() => router.push('/trips/new')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-1.5 px-6 py-3 rounded-full border-none cursor-pointer text-[13px] font-semibold btn-hover"
              style={{ background: 'var(--t-ink)', color: 'white', fontFamily: FONT.sans }}
            >
              <span className="text-sm">+</span> New Trip
            </motion.button>
          </div>

          {/* Trip cards grid */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="grid gap-5"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}
          >
            {trips.map(trip => {
              const destKey = trip.destinations?.[0];
              const destColor = destKey && DEST_COLORS[destKey] ? DEST_COLORS[destKey] : null;
              const dayCount = trip.days.length;
              const placedCount = trip.days.reduce((n, d) => n + d.slots.filter(s => s.places.length > 0).length, 0);

              return (
                <motion.button
                  key={trip.id}
                  variants={cardVariants}
                  onClick={() => router.push(`/trips/${trip.id}`)}
                  className="rounded-2xl border-none cursor-pointer text-left overflow-hidden card-hover"
                  style={{
                    background: 'white',
                    border: '1.5px solid var(--t-linen)',
                  }}
                >
                  {/* Color accent bar */}
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
                    style={{
                      height: 6,
                      background: destColor?.accent || 'var(--t-honey)',
                      borderRadius: '14px 14px 0 0',
                      originX: 0,
                    }}
                  />
                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: destColor ? `${destColor.accent}15` : 'rgba(200,146,58,0.1)' }}
                      >
                        <PerriandIcon name="plan" size={20} color={destColor?.accent || 'var(--t-honey)'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-[16px] font-semibold truncate mb-0.5"
                          style={{ fontFamily: "var(--font-dm-serif-display), serif", color: 'var(--t-ink)' }}
                        >
                          {trip.name}
                        </div>
                        <div className="text-[12px]" style={{ color: INK['70'] }}>
                          {trip.location}
                        </div>
                      </div>
                      {trip.status && (
                        <span
                          className="text-[9px] px-2 py-1 rounded-full flex-shrink-0 whitespace-nowrap flex items-center gap-1"
                          style={{
                            background: trip.status === 'planning' ? 'rgba(42,122,86,0.08)' : 'rgba(200,146,58,0.08)',
                            color: trip.status === 'planning' ? 'var(--t-verde)' : '#8a6a2a',
                            fontFamily: FONT.mono,
                          }}
                        >
                          <PerriandIcon
                            name={trip.status === 'planning' ? 'pin' : 'star'}
                            size={10}
                            color={trip.status === 'planning' ? 'var(--t-verde)' : 'var(--t-honey)'}
                          />
                          {trip.status === 'planning' ? 'Planning' : 'Dreaming'}
                        </span>
                      )}
                    </div>

                    {/* Stats row */}
                    <div
                      className="flex items-center gap-4 mt-4 pt-3"
                      style={{ borderTop: '1px solid var(--t-linen)' }}
                    >
                      <div className="flex items-center gap-1.5">
                        <PerriandIcon name="plan" size={12} color={INK['40']} />
                        <span style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['60'] }}>
                          {dayCount} {dayCount === 1 ? 'day' : 'days'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <PerriandIcon name="pin" size={12} color={INK['40']} />
                        <span style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['60'] }}>
                          {placedCount} {placedCount === 1 ? 'place' : 'places'}
                        </span>
                      </div>
                      {trip.startDate && (
                        <div className="flex items-center gap-1.5">
                          <span style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['50'] }}>
                            {trip.startDate}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}

            {/* Create CTA */}
            <motion.button
              variants={cardVariants}
              onClick={() => router.push('/trips/new')}
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border-none cursor-pointer transition-all hover:scale-[1.01]"
              style={{
                minHeight: 180,
                background: INK['02'],
                border: '1.5px dashed var(--t-travertine)',
                color: INK['90'],
              }}
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: INK['06'] }}
              >
                <span style={{ fontSize: 24, color: INK['40'] }}>+</span>
              </motion.div>
              <span className="text-[13px] font-medium" style={{ color: 'var(--t-ink)' }}>Start a New Trip</span>
              <span className="text-[11px]" style={{ color: INK['70'] }}>
                Tell us where and when — we'll find your perfect places
              </span>
            </motion.button>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ─── Mobile layout ─── */
  return (
    <div
      className="min-h-screen pb-16"
      style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}
    >
      <div className="px-4 pt-6">
        <div className="flex items-center justify-between mb-1">
          <h1
            className="text-2xl"
            style={{ fontFamily: "var(--font-dm-serif-display), serif", color: 'var(--t-ink)' }}
          >
            Your Trips
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/trips/new')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-none cursor-pointer text-[12px] font-medium transition-all hover:opacity-80"
              style={{ background: 'var(--t-ink)', color: 'white', fontFamily: FONT.sans }}
            >
              <span className="text-sm">+</span> New Trip
            </button>
            <ProfileAvatar />
          </div>
        </div>
        <p className="text-xs mb-6" style={{ color: INK['95'] }}>
          Plan and curate your bespoke travel itinerary
        </p>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="flex flex-col gap-3"
        >
          {trips.map(trip => (
            <motion.button
              key={trip.id}
              variants={cardVariants}
              onClick={() => router.push(`/trips/${trip.id}`)}
              className="flex items-center gap-3 p-4 rounded-xl border-none cursor-pointer text-left transition-all hover:scale-[1.01]"
              style={{ background: 'white', border: '1.5px solid var(--t-linen)' }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-lg"
                style={{ background: 'rgba(200,146,58,0.1)' }}
              >
                <PerriandIcon name="plan" size={20} color="var(--t-honey)" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold truncate" style={{ fontFamily: "var(--font-dm-serif-display), serif", color: 'var(--t-ink)' }}>
                    {trip.name}
                  </span>
                  {trip.status && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap flex items-center gap-1" style={{ background: trip.status === 'planning' ? 'rgba(42,122,86,0.08)' : 'rgba(200,146,58,0.08)', color: trip.status === 'planning' ? 'var(--t-verde)' : '#8a6a2a', fontFamily: FONT.mono }}>
                      <PerriandIcon name={trip.status === 'planning' ? 'pin' : 'star'} size={10} color={trip.status === 'planning' ? 'var(--t-verde)' : 'var(--t-honey)'} />
                      {trip.status === 'planning' ? 'Planning' : 'Dreaming'}
                    </span>
                  )}
                </div>
                <div className="text-[11px]" style={{ color: INK['95'] }}>
                  {trip.location} · {trip.days.length} days
                </div>
              </div>
              <span style={{ color: INK['95'] }}>→</span>
            </motion.button>
          ))}

          <motion.button
            variants={cardVariants}
            onClick={() => router.push('/trips/new')}
            className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-none cursor-pointer transition-all hover:scale-[1.01]"
            style={{ background: INK['02'], border: '1.5px dashed var(--t-travertine)', color: INK['90'] }}
          >
            <motion.span
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-2xl"
            >
              +
            </motion.span>
            <span className="text-[13px] font-medium" style={{ color: 'var(--t-ink)' }}>Start a New Trip</span>
            <span className="text-[11px]" style={{ color: INK['90'] }}>Tell us where and when — we'll find your perfect places</span>
          </motion.button>
        </motion.div>
      </div>
      <TabBar />
    </div>
  );
}
