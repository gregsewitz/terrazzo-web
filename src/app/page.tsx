'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { FONT, COLOR } from '@/constants/theme';

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

  if (authLoading || isAuthenticated) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: COLOR.coral }}>
        <img src="/brand/logo-pixellance-cream.svg" alt="Terrazzo" style={{ height: 40, opacity: 0.6 }} className="animate-pulse" />
      </div>
    );
  }

  // ─── Landing page ───
  return (
    <div className="min-h-dvh relative overflow-hidden" style={{ background: COLOR.coral }}>

      {/* ═══ SVG clip-path: exact staircase from Figma export (node 2:49) ═══ */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <clipPath id="hero-staircase" clipPathUnits="objectBoundingBox">
            <path d="
              M 0.0954,0.0283
              H 0.1899
              C 0.2192,0.0283 0.2430,0.0442 0.2430,0.0637
              V 0.1107
              C 0.2430,0.1303 0.2668,0.1462 0.2961,0.1462
              H 0.7039
              C 0.7332,0.1462 0.7570,0.1303 0.7570,0.1107
              V 0.0637
              C 0.7570,0.0442 0.7808,0.0283 0.8101,0.0283
              H 0.9046
              C 0.9339,0.0283 0.9577,0.0442 0.9577,0.0637
              V 0.5476
              C 0.9577,0.5672 0.9339,0.5831 0.9046,0.5831
              H 0.6396
              C 0.6103,0.5831 0.5865,0.5990 0.5865,0.6186
              V 0.8280
              C 0.5865,0.8476 0.5627,0.8635 0.5334,0.8635
              H 0.2674
              C 0.2381,0.8635 0.2143,0.8794 0.2143,0.8990
              V 0.9361
              C 0.2143,0.9557 0.1905,0.9716 0.1612,0.9716
              H 0.0954
              C 0.0661,0.9716 0.0423,0.9557 0.0423,0.9361
              V 0.0637
              C 0.0423,0.0442 0.0661,0.0283 0.0954,0.0283
              Z
            " />
          </clipPath>
        </defs>
      </svg>

      {/* ═══ TERRAZZO wordmark — spans across the top "bridge" area ═══
           The clip-path has a bridge zone between the two top notch tabs
           (x: 0.2430–0.7039 of hero, y: 0.0283–0.1462) where the hero
           image shows through. This coral div covers that bridge and holds
           the logo left-aligned, sitting flush with the top-left notch. */}
      <div
        className="absolute z-20 hidden lg:flex items-center"
        style={{
          top: '10.5%',
          left: '28%',
          width: '31.5%',
          height: '10.2%',
          background: COLOR.coral,
          paddingLeft: 4,
        }}
      >
        <img
          src="/brand/logo-pixellance-cream.svg"
          alt="Terrazzo"
          style={{
            height: 'clamp(44px, 8vh, 68px)',
            width: 'auto',
          }}
        />
      </div>

      {/* ═══ Hero image with staircase clip-path ═══
           50% wider than Figma original: 30.4% → 46%, centered at ~50% */}
      <div
        className="absolute hidden lg:block"
        style={{
          left: '27%',
          top: '8.1%',
          width: '46%',
          height: '86.2%',
          clipPath: 'url(#hero-staircase)',
        }}
      >
        <img
          src={heroImage}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />
      </div>

      {/* ═══ Top-right zigzag — centered on hero's visible right edge ═══
           Hero visible right edge = 27% + 0.9577×46% = 71%.
           Zigzag width ≈ 3.2% at 30% height. Center on edge → left = 69.4% */}
      <img
        src="/brand/pattern-zigzag-navy.svg"
        alt=""
        className="absolute pointer-events-none select-none hidden lg:block z-10"
        style={{
          left: '69.4%',
          top: 0,
          height: '30%',
          width: 'auto',
        }}
      />

      {/* ═══ Bottom-left zigzag — centered on hero's visible left edge ═══
           Hero visible left edge = 27% + 0.0423×46% = 28.95%.
           Zigzag width ≈ 3.2%. Center on edge → left = 27.3% */}
      <img
        src="/brand/pattern-zigzag-navy.svg"
        alt=""
        className="absolute pointer-events-none select-none hidden lg:block z-10"
        style={{
          left: '27.3%',
          top: '70%',
          height: '30%',
          width: 'auto',
        }}
      />

      {/* ═══ Mobile: centered logo above hero image ═══ */}
      <div className="block lg:hidden flex flex-col items-center">
        <img
          src="/brand/logo-pixellance-cream.svg"
          alt="Terrazzo"
          style={{
            height: 'clamp(36px, 6vh, 52px)',
            width: 'auto',
            marginTop: 'clamp(40px, 7vh, 72px)',
            marginBottom: 16,
          }}
        />
        <div
          className="relative mx-auto"
          style={{
            width: '88%',
            height: '45dvh',
            borderRadius: '24px 24px 60px 24px',
            overflow: 'hidden',
          }}
        >
          <img
            src={heroImage}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 30%',
            }}
          />
        </div>
      </div>

      {/* ═══ Desktop content: tagline + waitlist form ═══
           Figma: x=777.33, y=454.67 on 1440×760 → left: 54%, top: 60%.
           Sits just right of hero's stepped edge (hero narrows at 53% viewport). */}
      <div
        className="hidden lg:flex flex-col absolute z-20"
        style={{
          left: '56%',
          top: '62%',
          maxWidth: 300,
        }}
      >
        <p
          style={{
            fontFamily: FONT.mono,
            fontSize: 'clamp(14px, 1.2vw, 17px)',
            color: COLOR.cream,
            lineHeight: 1.75,
            margin: '0 0 16px',
          }}
        >
          Travel that understands you. We learn your taste and curate places
          that feel unmistakably yours.
        </p>

        {status === 'success' ? (
          <SuccessMessage />
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2" style={{ maxWidth: 340 }}>
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="landing-email-input"
              style={{
                flex: 1,
                padding: '12px 16px',
                fontSize: 14,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: 'white',
                fontFamily: FONT.sans,
                outline: 'none',
                minWidth: 0,
                backdropFilter: 'blur(10px)',
              }}
            />
            <button
              type="submit"
              disabled={!email.trim() || status === 'sending'}
              style={{
                padding: '12px 22px',
                borderRadius: 100,
                background: email.trim() ? 'white' : 'rgba(255,255,255,0.15)',
                color: email.trim() ? COLOR.coral : 'rgba(255,255,255,0.4)',
                border: 'none',
                fontFamily: FONT.mono,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
                cursor: email.trim() ? 'pointer' : 'default',
                opacity: status === 'sending' ? 0.6 : 1,
                transition: 'all 200ms ease',
                whiteSpace: 'nowrap' as const,
                flexShrink: 0,
              }}
            >
              {status === 'sending' ? '...' : 'Request Access'}
            </button>
          </form>
        )}

        {status === 'error' && (
          <p style={{ fontFamily: FONT.sans, fontSize: 11, color: 'rgba(255,255,255,0.75)', margin: '8px 0 0' }}>
            {errorMsg}
          </p>
        )}

        <div style={{ marginTop: 10 }}>
          <a
            href="/login"
            style={{ fontFamily: FONT.sans, fontSize: 12, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}
          >
            Already have an invitation?{' '}
            <span style={{ color: 'white', textDecoration: 'underline', textUnderlineOffset: 3 }}>Sign in</span>
          </a>
        </div>

        <p style={{ fontFamily: FONT.mono, fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em', marginTop: 16 }}>
          &copy; 2026 Terrazzo
        </p>
      </div>

      {/* ═══ Mobile content ═══ */}
      <div className="block lg:hidden px-6 py-8">
        <p style={{ fontFamily: FONT.mono, fontSize: 15, color: COLOR.cream, lineHeight: 1.75, margin: '0 0 24px', maxWidth: 360 }}>
          Travel that understands you. We learn your taste and curate places that feel unmistakably yours.
        </p>

        {status === 'success' ? (
          <SuccessMessage />
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3" style={{ maxWidth: 380 }}>
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="landing-email-input"
              style={{
                flex: 1, padding: '14px 18px', fontSize: 16, borderRadius: 12,
                background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)',
                color: 'white', fontFamily: FONT.sans, outline: 'none', minWidth: 0,
                backdropFilter: 'blur(10px)',
              }}
            />
            <button
              type="submit"
              disabled={!email.trim() || status === 'sending'}
              style={{
                padding: '14px 28px', borderRadius: 100,
                background: email.trim() ? 'white' : 'rgba(255,255,255,0.15)',
                color: email.trim() ? COLOR.coral : 'rgba(255,255,255,0.4)',
                border: 'none', fontFamily: FONT.mono, fontSize: 11, fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase' as const,
                cursor: email.trim() ? 'pointer' : 'default',
                opacity: status === 'sending' ? 0.6 : 1, transition: 'all 200ms ease',
                whiteSpace: 'nowrap' as const, flexShrink: 0,
              }}
            >
              {status === 'sending' ? '...' : 'Request Access'}
            </button>
          </form>
        )}

        {status === 'error' && (
          <p style={{ fontFamily: FONT.sans, fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: '8px 0 0' }}>{errorMsg}</p>
        )}

        <div style={{ marginTop: 16 }}>
          <a href="/login" style={{ fontFamily: FONT.sans, fontSize: 12, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
            Already have an invitation?{' '}
            <span style={{ color: 'white', textDecoration: 'underline', textUnderlineOffset: 3 }}>Sign in</span>
          </a>
        </div>

        <p style={{ fontFamily: FONT.mono, fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em', marginTop: 32 }}>
          &copy; 2026 Terrazzo
        </p>
      </div>
    </div>
  );
}

function SuccessMessage() {
  return (
    <div
      className="inline-flex items-center gap-3 px-5 py-3 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
    >
      <span style={{ fontSize: 16, color: 'white' }}>&#10003;</span>
      <div>
        <p style={{ fontFamily: FONT.sans, fontSize: 13, fontWeight: 600, color: 'white', margin: 0 }}>
          You&apos;re on the list
        </p>
        <p style={{ fontFamily: FONT.sans, fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0' }}>
          We&apos;ll be in touch when it&apos;s your turn.
        </p>
      </div>
    </div>
  );
}
