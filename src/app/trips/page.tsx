'use client';

import { motion } from 'framer-motion';
import PageTransition from '@/components/PageTransition';
import { useTripStore } from '@/stores/tripStore';
import { useRouter } from 'next/navigation';
import TabBar from '@/components/TabBar';
import DesktopNav from '@/components/DesktopNav';
import ProfileAvatar from '@/components/ProfileAvatar';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { COLOR, FONT, INK, TEXT } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import { SafeFadeIn } from '@/components/animations/SafeFadeIn';
import BrandLoader from '@/components/BrandLoader';
import { useOnboardingStore } from '@/stores/onboardingStore';

export default function TripsPage() {
  const trips = useTripStore(s => s.trips);
  const dbHydrated = useOnboardingStore(s => s.dbHydrated);
  const router = useRouter();
  const isDesktop = useIsDesktop();

  // Wait for DB hydration before rendering
  if (!dbHydrated) {
    return <BrandLoader message="Loading your trips…" />;
  }

  /* ─── Desktop Trips layout ─── */
  if (isDesktop) {
    return (
      <PageTransition className="min-h-screen" style={{ background: 'var(--t-cream)' }}>
        <DesktopNav />
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 48px 48px' }}>
          {/* Header */}
          <div className="flex items-end justify-between mb-8">
            <div>
              <SafeFadeIn direction="up" distance={10} duration={0.5}>
                <h1
                  style={{
                    fontFamily: FONT.serif,
                    fontStyle: 'italic',
                    fontSize: 32,
                    color: TEXT.primary,
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  Your Trips
                </h1>
              </SafeFadeIn>
              <p style={{ fontFamily: FONT.mono, fontSize: 12, color: TEXT.secondary, margin: '6px 0 0' }}>
                {trips.length} {trips.length === 1 ? 'trip' : 'trips'} in progress
              </p>
            </div>
            <motion.button
              onClick={() => router.push('/trips/new')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-1.5 px-6 py-3 rounded-full border-none cursor-pointer text-[13px] font-semibold btn-hover"
              style={{ background: TEXT.primary, color: 'white', fontFamily: FONT.sans }}
            >
              <span className="text-sm">+</span> New Trip
            </motion.button>
          </div>

          {/* Trip cards grid */}
          <div
            className="grid gap-5"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}
          >
            {trips.map((trip, index) => {
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
                    className="rounded-2xl border-none cursor-pointer text-left overflow-hidden card-hover w-full"
                    style={{
                      background: 'white',
                      border: '1.5px solid var(--t-linen)',
                    }}
                  >
                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(0,42,85,0.06)' }}
                      >
                        <PerriandIcon name="plan" size={20} color={TEXT.primary} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-[16px] font-semibold truncate mb-0.5"
                          style={{ fontFamily: "var(--font-dm-serif-display), serif", color: TEXT.primary }}
                        >
                          {trip.name}
                        </div>
                        <div className="text-[12px]" style={{ color: TEXT.secondary }}>
                          {trip.location}
                        </div>
                      </div>
                      {trip.status && (
                        <span
                          className="text-[9px] px-2 py-1 rounded-full flex-shrink-0 whitespace-nowrap flex items-center gap-1"
                          style={{
                            background: trip.status === 'planning' ? 'rgba(58,128,136,0.10)' : 'rgba(238,113,109,0.08)',
                            color: trip.status === 'planning' ? 'var(--t-dark-teal)' : COLOR.coral,
                            fontFamily: FONT.mono,
                          }}
                        >
                          <PerriandIcon
                            name={trip.status === 'planning' ? 'pin' : 'star'}
                            size={10}
                            color={trip.status === 'planning' ? 'var(--t-dark-teal)' : COLOR.coral}
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
                        <PerriandIcon name="plan" size={12} color={TEXT.secondary} />
                        <span style={{ fontFamily: FONT.mono, fontSize: 10, color: TEXT.secondary }}>
                          {dayCount} {dayCount === 1 ? 'day' : 'days'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <PerriandIcon name="pin" size={12} color={TEXT.secondary} />
                        <span style={{ fontFamily: FONT.mono, fontSize: 10, color: TEXT.secondary }}>
                          {placedCount} {placedCount === 1 ? 'place' : 'places'}
                        </span>
                      </div>
                      {trip.startDate && (
                        <div className="flex items-center gap-1.5">
                          <span style={{ fontFamily: FONT.mono, fontSize: 10, color: TEXT.secondary }}>
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

            {/* Create CTA */}
            <SafeFadeIn
              direction="up"
              distance={20}
              duration={0.5}
              delay={0.1 + trips.length * 0.06}
            >
              <button
                onClick={() => router.push('/trips/new')}
                className="rounded-2xl border-none cursor-pointer text-left overflow-hidden card-hover w-full"
                style={{
                  background: INK['02'],
                  border: '1.5px dashed rgba(0,42,85,0.12)',
                }}
              >
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(238,113,109,0.08)' }}
                  >
                    <span style={{ fontSize: 22, fontWeight: 300, color: TEXT.accent }}>+</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[16px] font-semibold mb-0.5"
                      style={{ fontFamily: "var(--font-dm-serif-display), serif", color: TEXT.primary }}
                    >
                      Start a New Trip
                    </div>
                    <div className="text-[12px]" style={{ color: TEXT.secondary }}>
                      Tell us where and when
                    </div>
                  </div>
                </div>
              </div>
              </button>
            </SafeFadeIn>
          </div>
        </div>
      </PageTransition>
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
            style={{ fontFamily: "var(--font-dm-serif-display), serif", color: TEXT.primary }}
          >
            Your Trips
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/trips/new')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-none cursor-pointer text-[12px] font-medium transition-all hover:opacity-80"
              style={{ background: TEXT.primary, color: 'white', fontFamily: FONT.sans }}
            >
              <span className="text-sm">+</span> New Trip
            </button>
            <ProfileAvatar />
          </div>
        </div>
        <p className="text-xs mb-6" style={{ color: TEXT.primary }}>
          Plan and curate your bespoke travel itinerary
        </p>

        <div
          className="flex flex-col gap-3"
        >
          {trips.map((trip) => (
            <button
              key={trip.id}
              onClick={() => router.push(`/trips/${trip.id}`)}
              className="flex items-center gap-3 p-4 rounded-xl border-none cursor-pointer text-left transition-all hover:scale-[1.01]"
              style={{ background: 'white', border: '1.5px solid var(--t-linen)' }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-lg"
                style={{ background: 'rgba(0,42,85,0.06)' }}
              >
                <PerriandIcon name="plan" size={20} color={TEXT.primary} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold truncate" style={{ fontFamily: "var(--font-dm-serif-display), serif", color: TEXT.primary }}>
                    {trip.name}
                  </span>
                  {trip.status && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap flex items-center gap-1" style={{ background: trip.status === 'planning' ? 'rgba(58,128,136,0.10)' : 'rgba(238,113,109,0.08)', color: trip.status === 'planning' ? 'var(--t-dark-teal)' : COLOR.coral, fontFamily: FONT.mono }}>
                      <PerriandIcon name={trip.status === 'planning' ? 'pin' : 'star'} size={10} color={trip.status === 'planning' ? 'var(--t-dark-teal)' : COLOR.coral} />
                      {trip.status === 'planning' ? 'Planning' : 'Dreaming'}
                    </span>
                  )}
                </div>
                <div className="text-[11px]" style={{ color: TEXT.primary }}>
                  {trip.location} · {trip.days.length} days
                </div>
              </div>
              <span style={{ color: TEXT.primary }}>→</span>
            </button>
          ))}

        </div>
      </div>
      <TabBar />
    </div>
  );
}
