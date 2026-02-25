'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { FONT, INK } from '@/constants/theme';

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

  // ─── Editorial landing page ───
  return (
    <div className="min-h-dvh flex flex-col lg:flex-row" style={{ background: 'var(--t-cream)' }}>

      {/* ═══ LEFT: Content ═══ */}
      <div
        className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-20 py-16 lg:py-0"
        style={{ minHeight: '60dvh' }}
      >
        <div style={{ maxWidth: 520 }}>
          {/* EST. 2026 */}
          <p
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              fontWeight: 400,
              letterSpacing: '0.25em',
              color: INK['40'],
              margin: '0 0 32px',
              textTransform: 'uppercase',
            }}
          >
            Est. 2026
          </p>

          {/* Terrazzo */}
          <h1
            style={{
              fontFamily: FONT.serif,
              fontSize: 'clamp(56px, 8vw, 96px)',
              fontWeight: 400,
              color: 'var(--t-ink)',
              lineHeight: 0.95,
              margin: '0 0 28px',
              letterSpacing: '-0.02em',
            }}
          >
            Terrazzo
          </h1>

          {/* Tagline */}
          <p
            style={{
              fontFamily: FONT.sans,
              fontSize: 16,
              color: INK['55'],
              lineHeight: 1.6,
              margin: '0 0 40px',
              maxWidth: 400,
            }}
          >
            Travel that understands you. We learn your taste and curate places that feel unmistakably yours.
          </p>

          {/* Waitlist form or success */}
          {status === 'success' ? (
            <div>
              <div
                className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl"
                style={{
                  background: 'rgba(42,122,86,0.06)',
                  border: '1px solid rgba(42,122,86,0.12)',
                }}
              >
                <span style={{ fontSize: 18 }}>&#10003;</span>
                <div>
                  <p style={{
                    fontFamily: FONT.sans,
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--t-ink)',
                    margin: 0,
                  }}>
                    You&apos;re on the list
                  </p>
                  <p style={{
                    fontFamily: FONT.sans,
                    fontSize: 12,
                    color: INK['50'],
                    margin: '2px 0 0',
                  }}>
                    We&apos;ll be in touch when it&apos;s your turn.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3" style={{ maxWidth: 420 }}>
              <input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  flex: 1,
                  padding: '14px 18px',
                  fontSize: 16,
                  borderRadius: 12,
                  background: 'white',
                  border: '1px solid var(--t-linen)',
                  color: 'var(--t-ink)',
                  fontFamily: FONT.sans,
                  outline: 'none',
                  boxSizing: 'border-box',
                  minWidth: 0,
                }}
              />
              <button
                type="submit"
                disabled={!email.trim() || status === 'sending'}
                style={{
                  padding: '14px 28px',
                  borderRadius: 100,
                  background: email.trim() ? 'var(--t-ink)' : INK['10'],
                  color: email.trim() ? 'white' : INK['30'],
                  border: 'none',
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
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
              fontSize: 12,
              color: 'var(--t-signal-red)',
              margin: '10px 0 0',
            }}>
              {errorMsg}
            </p>
          )}

          {/* Sign in + footer */}
          <div className="mt-12 flex items-center gap-6">
            <a
              href="/login"
              style={{
                fontFamily: FONT.sans,
                fontSize: 12,
                color: INK['40'],
                textDecoration: 'none',
              }}
            >
              Already have an invitation? <span style={{ color: 'var(--t-ink)', textDecoration: 'underline', textUnderlineOffset: 3 }}>Sign in</span>
            </a>
          </div>

          <p
            className="mt-16 lg:mt-24"
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              color: INK['30'],
              letterSpacing: '0.05em',
            }}
          >
            &copy; 2026 Terrazzo
          </p>
        </div>
      </div>

      {/* ═══ RIGHT: Hero image ═══ */}
      <div
        className="hidden lg:block lg:w-[48%] xl:w-[50%]"
        style={{
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
            objectPosition: 'center',
          }}
        />
      </div>

      {/* ═══ MOBILE: Hero image (top strip) ═══ */}
      <div
        className="block lg:hidden order-first"
        style={{
          height: '35dvh',
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
        {/* Gradient fade into cream */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 80,
            background: 'linear-gradient(to top, var(--t-cream), transparent)',
          }}
        />
      </div>

    </div>
  );
}
