'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { FONT, TEXT } from '@/constants/theme';

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const code = searchParams.get('code');

    // --- Check for error params (forwarded by GET /api/auth/callback or hash) ---
    const errorParam = searchParams.get('error') || searchParams.get('error_description');
    // Supabase implicit flow may also put errors in the URL hash
    const hashError = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.hash.replace('#', '?')).get('error_description')
        || new URLSearchParams(window.location.hash.replace('#', '?')).get('error')
      : null;

    const upstreamError = errorParam || hashError;
    if (upstreamError) {
      const msg = upstreamError.includes('expired')
        ? 'This sign-in link has expired. Please request a new one.'
        : upstreamError.includes('already') || upstreamError.includes('used')
          ? 'This sign-in link has already been used. Please request a new one.'
          : 'Authentication failed. Please try signing in again.';
      setError(msg);
      return;
    }

    async function ensurePrismaUser(accessToken: string) {
      try {
        const res = await fetch('/api/auth/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (res.ok) {
          const { redirectTo } = await res.json();
          router.replace(redirectTo || '/saved');
        } else {
          router.replace('/saved');
        }
      } catch {
        router.replace('/saved');
      }
    }

    // --- Legacy path: code-based exchange (PKCE) ---
    if (code) {
      (async () => {
        try {
          const { data, error: authError } = await supabase.auth.exchangeCodeForSession(code);

          if (authError || !data.session) {
            setError('Authentication failed. Please try signing in again.');
            return;
          }

          await ensurePrismaUser(data.session.access_token);
        } catch {
          setError('Something went wrong. Please try signing in again.');
        }
      })();
      return;
    }

    // --- Implicit flow: session is auto-detected from the URL hash ---
    // detectSessionInUrl: true on the Supabase client picks up the
    // #access_token=... fragment and fires onAuthStateChange before this
    // effect runs.  We listen for it and then ensure the Prisma user exists.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          subscription.unsubscribe();
          await ensurePrismaUser(session.access_token);
        }
      },
    );

    // Also check if the session was already set by the time this effect runs
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        subscription.unsubscribe();
        ensurePrismaUser(session.access_token);
      }
    });

    // Timeout — if nothing happens within 8 seconds, show an error
    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      setError('Authentication timed out. Please try signing in again.');
    }, 8000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [searchParams, router]);

  if (error) {
    return (
      <div
        className="min-h-dvh flex flex-col items-center justify-center px-6"
        style={{ background: 'var(--t-cream)' }}
      >
        <p className="text-[13px] mb-4" style={{ color: '#c44', fontFamily: FONT.sans }}>
          {error}
        </p>
        <button
          onClick={() => router.replace('/login')}
          className="text-[12px] font-semibold px-4 py-2 rounded-full cursor-pointer"
          style={{
            background: 'var(--t-ink)',
            color: 'white',
            border: 'none',
            fontFamily: FONT.sans,
          }}
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--t-cream)' }}
    >
      <img
        src="/brand/logo-pixellance-navy.svg"
        alt="Terrazzo"
        style={{ height: 28, width: 'auto', marginBottom: 12 }}
      />
      <p className="text-[13px]" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>
        Signing you in...
      </p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-dvh flex flex-col items-center justify-center px-6"
          style={{ background: 'var(--t-cream)' }}
        >
          <img
            src="/brand/logo-pixellance-navy.svg"
            alt="Terrazzo"
            style={{ height: 28, width: 'auto', marginBottom: 12 }}
          />
          <p className="text-[13px]" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>
            Signing you in...
          </p>
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
