'use client';

import { useState, useEffect, useCallback } from 'react';
import { T } from '@/types';
import { FONT, INK, COLOR } from '@/constants/theme';
import { apiFetch } from '@/lib/api-client';

interface EmailConnectViewProps {
  onComplete: () => void;
}

interface EmailStatus {
  connected: boolean;
  email?: string;
}

export default function EmailConnectView({ onComplete }: EmailConnectViewProps) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'connected'>('checking');
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);

  // Check if already connected (returning from OAuth or previously connected)
  useEffect(() => {
    async function checkStatus() {
      try {
        const result = await apiFetch<EmailStatus>('/api/email/status');
        if (result?.connected) {
          setStatus('connected');
          setConnectedEmail(result.email || null);
        } else {
          setStatus('idle');
        }
      } catch {
        setStatus('idle');
      }
    }
    checkStatus();
  }, []);

  // Also poll when returning from OAuth redirect
  useEffect(() => {
    if (status !== 'idle') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('email_connected') === '1') {
      setStatus('connected');
      // Re-check to get the email address
      apiFetch<EmailStatus>('/api/email/status').then((result) => {
        if (result?.email) setConnectedEmail(result.email);
      }).catch((err: unknown) => console.warn('[EmailConnect] action failed:', err));
    }
  }, [status]);

  const handleConnect = useCallback(() => {
    // Redirect to Nylas OAuth — pass return URL so callback sends us back
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `/api/auth/nylas/connect?return_to=${returnUrl}`;
  }, []);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const handleContinue = useCallback(() => {
    // Kick off the email scan in the background so it runs during Acts 2 & 3
    apiFetch('/api/email/scan', { method: 'POST' }).catch((err) =>
      console.error('[email-connect] Failed to start background scan:', err)
    );
    onComplete();
  }, [onComplete]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        flex: 1,
        overflow: 'auto',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>

        {/* Icon */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'rgba(0,42,85,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            animation: 'fadeInUp 0.4s ease 0s both',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={COLOR.navy} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M22 7l-10 7L2 7" />
          </svg>
        </div>

        {/* Headline */}
        <h2
          style={{
            fontFamily: FONT.serif,
            fontSize: 22,
            fontWeight: 400,
            color: COLOR.navy,
            lineHeight: 1.3,
            marginBottom: 12,
            animation: 'fadeInUp 0.4s ease 0.05s both',
          }}
        >
          {status === 'connected' ? 'Email connected' : 'Connect your email'}
        </h2>

        {/* Body */}
        <p
          style={{
            fontFamily: FONT.sans,
            fontSize: 14,
            color: COLOR.navy,
            lineHeight: 1.6,
            marginBottom: 32,
            animation: 'fadeInUp 0.4s ease 0.1s both',
          }}
        >
          {status === 'connected' ? (
            <>
              {connectedEmail && (
                <span style={{ fontWeight: 500, color: COLOR.navy }}>{connectedEmail}</span>
              )}
              {connectedEmail ? ' is connected. ' : ''}
              We&apos;ll scan for hotel and restaurant confirmations in the background so we can ask you about real places you&apos;ve been.
            </>
          ) : (
            <>
              We can scan your booking confirmations to find hotels and restaurants you&apos;ve actually visited — so later we&apos;ll ask about real places, not random ones.
              <br /><br />
              <span style={{ fontSize: 12, color: COLOR.navy }}>
                Read-only access. We only look for booking confirmations — nothing else.
              </span>
            </>
          )}
        </p>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            alignItems: 'center',
            animation: 'fadeInUp 0.4s ease 0.15s both',
          }}
        >
          {status === 'checking' && (
            <div
              style={{
                width: 24,
                height: 24,
                border: `2px solid ${COLOR.peach}`,
                borderTopColor: COLOR.navy,
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          )}

          {status === 'idle' && (
            <>
              <button
                onClick={handleConnect}
                className="btn-hover"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '14px 32px',
                  background: COLOR.navy,
                  color: COLOR.cream,
                  border: 'none',
                  borderRadius: 100,
                  fontSize: 15,
                  fontWeight: 500,
                  fontFamily: FONT.sans,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  letterSpacing: '0.01em',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M20 18h-2V9.25L12 13 6 9.25V18H4V6h1.2l6.8 4.25L18.8 6H20v12z" fill="currentColor"/>
                  <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                </svg>
                Connect Gmail
              </button>
              <button
                onClick={handleSkip}
                className="btn-hover"
                style={{
                  padding: '10px 24px',
                  background: 'transparent',
                  color: COLOR.navy,
                  border: 'none',
                  borderRadius: 100,
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: FONT.sans,
                  cursor: 'pointer',
                  transition: 'color 0.2s ease',
                }}
              >
                Skip for now
              </button>
            </>
          )}

          {status === 'connected' && (
            <button
              onClick={handleContinue}
              className="btn-hover"
              style={{
                padding: '14px 36px',
                background: COLOR.navy,
                color: COLOR.cream,
                border: 'none',
                borderRadius: 100,
                fontSize: 15,
                fontWeight: 500,
                fontFamily: FONT.sans,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                letterSpacing: '0.01em',
              }}
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
