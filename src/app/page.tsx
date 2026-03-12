'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { FONT, INK, COLORS } from '@/constants/theme';

// Hero images — one chosen at random per visit
const HERO_IMAGES = [
  '/onboarding/designers/AmanTokyo/AmanTokyo1.jpg',
  '/onboarding/designers/CommodorePerryEstate/CommodorePerryEstate1.jpg',
  '/onboarding/designers/TheNoMad/TheNoMad1.jpg',
  '/onboarding/designers/RosewoodChancery/RosewoodChancery2.jpg',
  '/onboarding/designers/LeGrandMazarin/LeGrandMazarin1.jpg',
  '/onboarding/designers/ClivedenHouse/ClivedenHouse1.jpg',
];

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Pick a random hero image on mount
  const heroImage = useMemo(
    () => HERO_IMAGES[Math.floor(Math.random() * HERO_IMAGES.length)],
    []
  );

  // ─── Authenticated users: redirect straight to app ───
  const [hydrated, setHydrated] = useState(false);
  const isComplete = useOnboardingStore((s) => s.isComplete);

  useEffect(() => {
    if (useOnboardingStore.persist.hasHydrated()) {
      setHydrated(true);
    } else {
      const unsub = useOnboardingStore.persist.onFinishHydration(() => {
        setHydrated(true);
        unsub();
      });
    }
  }, []);

  useEffect(() => {
    if (authLoading || !hydrated) return;
    if (isAuthenticated) {
      router.replace(isComplete ? '/trips' : '/onboarding');
    }
  }, [authLoading, hydrated, isAuthenticated, isComplete, router]);

  // ─── Waitlist form state ───
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('sending');
    setErrorMsg('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setErrorMsg(data.error || 'Something went wrong.');
      } else {
        setStatus('success');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Could not connect. Please try again.');
    }
  };

  // While checking auth, show brief loading
  if (authLoading || isAuthenticated) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--t-cream)' }}>
        <h1 style={{ fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 32, color: 'var(--t-ink)' }} className="animate-pulse">
          Terrazzo
        </h1>
      </div>
    );
  }

  // ─── Kinetic Dreamer Editorial Landing ───
  return (
    <div className="min-h-dvh flex flex-col lg:flex-row" style={{ background: 'var(--t-cream)' }}>

      {/* ═══ LEFT: Content ═══ */}
      <div
        className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-20 py-16 lg:py-0 relative"
        style={{ minHeight: '60dvh' }}
      >
        {/* Geometric accent - coral circle */}
        <div 
          className="absolute hidden lg:block"
          style={{
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: COLORS.coral,
            opacity: 0.15,
            top: '10%',
            right: '5%',
            zIndex: 0,
          }}
        />
        
        <div style={{ maxWidth: 560, position: 'relative', zIndex: 1 }}>
          {/* EST. 2026 - editorial label */}
          <p
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              fontWeight: 400,
              letterSpacing: '0.25em',
              color: COLORS.coral,
              margin: '0 0 24px',
              textTransform: 'uppercase',
            }}
          >
            Est. 2026
          </p>

          {/* TERRAZZO - Bold condensed display, Italian Futurist style */}
          <h1
            style={{
              fontFamily: FONT.display,
              fontSize: 'clamp(72px, 12vw, 140px)',
              fontWeight: 400,
              color: COLORS.navy,
              lineHeight: 0.85,
              margin: '0 0 24px',
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
            }}
          >
            Terrazzo
          </h1>

          {/* Tagline - editorial warmth */}
          <p
            style={{
              fontFamily: FONT.sans,
              fontSize: 18,
              color: INK['70'],
              lineHeight: 1.65,
              margin: '0 0 48px',
              maxWidth: 420,
            }}
          >
            Travel that understands you. We learn your taste and curate places that feel unmistakably yours.
          </p>

          {/* Waitlist form or success */}
          {status === 'success' ? (
            <div>
              <div
                className="inline-flex items-center gap-4 px-6 py-5 rounded-none"
                style={{
                  background: COLORS.mint,
                  border: 'none',
                }}
              >
                <span style={{ fontSize: 20, color: COLORS.navy }}>&#10003;</span>
                <div>
                  <p style={{
                    fontFamily: FONT.display,
                    fontSize: 18,
                    fontWeight: 400,
                    color: COLORS.navy,
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    You&apos;re on the list
                  </p>
                  <p style={{
                    fontFamily: FONT.sans,
                    fontSize: 13,
                    color: COLORS.navy,
                    margin: '4px 0 0',
                    opacity: 0.8,
                  }}>
                    We&apos;ll be in touch when it&apos;s your turn.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4" style={{ maxWidth: 460 }}>
              <input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  flex: 1,
                  padding: '16px 20px',
                  fontSize: 16,
                  borderRadius: 0,
                  background: 'white',
                  border: `2px solid ${COLORS.navy}`,
                  color: COLORS.navy,
                  fontFamily: FONT.sans,
                  outline: 'none',
                  boxSizing: 'border-box',
                  minWidth: 0,
                }}
              />
              <button
                type="submit"
                disabled={!email.trim() || status === 'sending'}
                className="btn-hover"
                style={{
                  padding: '16px 32px',
                  borderRadius: 0,
                  background: email.trim() ? COLORS.coral : INK['10'],
                  color: email.trim() ? 'white' : INK['30'],
                  border: 'none',
                  fontFamily: FONT.display,
                  fontSize: 16,
                  fontWeight: 400,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  cursor: email.trim() ? 'pointer' : 'default',
                  opacity: status === 'sending' ? 0.6 : 1,
                  transition: 'all 200ms ease',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {status === 'sending' ? 'Sending...' : 'Request Access'}
              </button>
            </form>
          )}

          {status === 'error' && (
            <p style={{
              fontFamily: FONT.sans,
              fontSize: 13,
              color: COLORS.coral,
              margin: '12px 0 0',
              fontWeight: 500,
            }}>
              {errorMsg}
            </p>
          )}

          {/* Sign in + footer */}
          <div className="mt-14 flex items-center gap-6">
            <a
              href="/login"
              className="link-hover"
              style={{
                fontFamily: FONT.sans,
                fontSize: 13,
                color: INK['60'],
                textDecoration: 'none',
              }}
            >
              Already have an invitation? <span style={{ color: COLORS.navy, textDecoration: 'underline', textUnderlineOffset: 4, fontWeight: 600 }}>Sign in</span>
            </a>
          </div>

          <p
            className="mt-20 lg:mt-28"
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              color: INK['40'],
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            &copy; 2026 Terrazzo — Kinetic Dreamer
          </p>
        </div>
      </div>

      {/* ═══ RIGHT: Hero image with geometric overlay ═══ */}
      <div
        className="hidden lg:block lg:w-[48%] xl:w-[52%]"
        style={{
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Main hero image */}
        <img
          src={heroImage}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />
        
        {/* Geometric overlay - Kinetic Dreamer style */}
        <div 
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '40%',
            height: '35%',
            background: COLORS.navy,
            opacity: 0.9,
          }}
        />
        <div 
          style={{
            position: 'absolute',
            bottom: '35%',
            left: 0,
            width: '20%',
            height: '20%',
            background: COLORS.coral,
            opacity: 0.85,
          }}
        />
        <div 
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: COLORS.ochre,
            opacity: 0.7,
            transform: 'translate(30%, -30%)',
          }}
        />
        
        {/* Editorial accent text */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: 32,
            zIndex: 10,
          }}
        >
          <p
            style={{
              fontFamily: FONT.display,
              fontSize: 14,
              color: 'white',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              margin: 0,
              opacity: 0.9,
            }}
          >
            Discover Your Journey
          </p>
        </div>
      </div>

      {/* ═══ MOBILE: Hero image (top strip) with geometric accent ═══ */}
      <div
        className="block lg:hidden order-first"
        style={{
          height: '38dvh',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <img
          src={heroImage}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 30%',
          }}
        />
        
        {/* Geometric accent - mobile */}
        <div 
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '30%',
            height: '40%',
            background: COLORS.coral,
            opacity: 0.85,
          }}
        />
        
        {/* Gradient fade into cream */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 100,
            background: 'linear-gradient(to top, var(--t-cream), transparent)',
          }}
        />
      </div>

    </div>
  );
}
