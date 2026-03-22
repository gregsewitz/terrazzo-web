'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { FONT, COLOR } from '@/constants/theme';

export default function LoginPage() {
  const { signIn, isAuthenticated } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // If already authenticated, redirect
  if (isAuthenticated) {
    router.replace('/saved');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('sending');
    setErrorMsg('');

    const { error } = await signIn(email.trim());
    if (error) {
      setStatus('error');
      // Friendly messaging for common errors
      if (error.toLowerCase().includes('rate') || error.toLowerCase().includes('limit')) {
        setErrorMsg('Too many sign-in attempts. Please wait a few minutes before trying again.');
      } else if (error.toLowerCase().includes('invalid') && error.toLowerCase().includes('email')) {
        setErrorMsg('Please enter a valid email address.');
      } else {
        setErrorMsg(error);
      }
    } else {
      setStatus('sent');
    }
  };

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-6"
      style={{ background: COLOR.coral }}
    >
      {/* Logo */}
      <img
        src="/brand/logo-pixellance-cream.svg"
        alt="Terrazzo"
        style={{ height: 'clamp(36px, 6vh, 52px)', width: 'auto', marginBottom: 32 }}
      />

      {/* Centered card wrapper */}
      <div
        className="w-full max-w-[400px] rounded-2xl p-8"
        style={{
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.2)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {status === 'sent' ? (
          /* Success state */
          <div className="text-center">
            <div className="text-[28px] mb-4" style={{ color: 'white' }}>&#x2709;&#xFE0F;</div>
            <h2
              className="text-[18px] font-semibold mb-2"
              style={{ fontFamily: FONT.sans, color: 'white' }}
            >
              Check your email
            </h2>
            <p
              className="text-[13px] mb-6"
              style={{ color: 'rgba(255,255,255,0.7)', fontFamily: FONT.sans }}
            >
              We sent a magic link to <strong style={{ color: 'white' }}>{email}</strong>. Click the link to sign in.
            </p>
            <button
              onClick={() => { setStatus('idle'); setEmail(''); }}
              className="text-[12px] cursor-pointer"
              style={{
                color: 'white',
                background: 'none',
                border: 'none',
                fontFamily: FONT.sans,
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          /* Form state */
          <form onSubmit={handleSubmit}>
            <p
              className="text-[13px] mb-6 text-center"
              style={{ color: 'rgba(255,255,255,0.7)', fontFamily: FONT.sans }}
            >
              Sign in with your email to continue
            </p>

            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              className="w-full rounded-xl py-3 px-4 mb-3 landing-email-input"
              style={{
                fontSize: 16,
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: 'white',
                fontFamily: FONT.sans,
                outline: 'none',
                boxSizing: 'border-box',
                backdropFilter: 'blur(10px)',
              }}
            />

            {status === 'error' && (
              <p className="text-[11px] mb-2" style={{ color: 'rgba(255,255,255,0.75)', fontFamily: FONT.sans }}>
                {errorMsg || 'Something went wrong. Please try again.'}
              </p>
            )}

            <button
              type="submit"
              disabled={!email.trim() || status === 'sending'}
              className="w-full py-3 rounded-full text-[14px] font-semibold cursor-pointer"
              style={{
                background: email.trim() ? 'white' : 'rgba(255,255,255,0.15)',
                color: email.trim() ? COLOR.coral : 'rgba(255,255,255,0.4)',
                border: 'none',
                fontFamily: FONT.sans,
                opacity: status === 'sending' ? 0.6 : 1,
                transition: 'all 200ms ease',
              }}
            >
              {status === 'sending' ? 'Sending...' : 'Send magic link'}
            </button>

            <p
              className="text-[10px] text-center mt-4"
              style={{ color: 'rgba(255,255,255,0.4)', fontFamily: FONT.sans }}
            >
              No password needed. We&apos;ll email you a sign-in link.
            </p>
          </form>
        )}
      </div>

      {/* Back to landing */}
      <a
        href="/"
        style={{
          fontFamily: FONT.sans,
          fontSize: 12,
          color: 'rgba(255,255,255,0.5)',
          textDecoration: 'none',
          marginTop: 20,
        }}
      >
        &larr; Back to home
      </a>

      <p style={{ fontFamily: FONT.mono, fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em', marginTop: 16 }}>
        &copy; 2026 Terrazzo
      </p>
    </div>
  );
}
