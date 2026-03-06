'use client';

import { useState, useCallback } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import type { TravelContext } from '@/types';
import { T } from '@/types';
import { FONT, INK } from '@/constants/theme';

// ─── Companion chip options ───

const COMPANION_OPTIONS: { id: TravelContext; label: string; emoji: string }[] = [
  { id: 'solo', label: 'Solo', emoji: '🧳' },
  { id: 'partner', label: 'Partner', emoji: '💑' },
  { id: 'friends', label: 'Friends', emoji: '👯' },
  { id: 'family', label: 'Family', emoji: '👨‍👩‍👧' },
];

interface QuickBioFormViewProps {
  onComplete: () => void;
}

export default function QuickBioFormView({ onComplete }: QuickBioFormViewProps) {
  const setLifeContext = useOnboardingStore((s) => s.setLifeContext);
  const setCurrentPhaseProgress = useOnboardingStore((s) => s.setCurrentPhaseProgress);

  const [firstName, setFirstName] = useState('');
  const [homeCity, setHomeCity] = useState('');
  const [companions, setCompanions] = useState<TravelContext[]>([]);
  const [partnerName, setPartnerName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const showPartnerField = companions.includes('partner');
  const isValid = firstName.trim().length > 0;

  // Track form progress
  const updateProgress = useCallback((fn: string, hc: string, comp: TravelContext[]) => {
    let filled = 0;
    if (fn.trim()) filled++;
    if (hc.trim()) filled++;
    if (comp.length > 0) filled++;
    setCurrentPhaseProgress(filled / 3);
  }, [setCurrentPhaseProgress]);

  const toggleCompanion = useCallback((id: TravelContext) => {
    setCompanions((prev) => {
      const next = prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id];
      updateProgress(firstName, homeCity, next);
      return next;
    });
  }, [firstName, homeCity, updateProgress]);

  const handleSubmit = useCallback(() => {
    if (submitted || !isValid) return;
    setSubmitted(true);

    setLifeContext({
      firstName: firstName.trim(),
      homeCity: homeCity.trim() || undefined,
      primaryCompanions: companions,
      partnerName: showPartnerField && partnerName.trim() ? partnerName.trim() : undefined,
    });

    setCurrentPhaseProgress(1);
    setTimeout(onComplete, 350);
  }, [submitted, isValid, firstName, homeCity, companions, partnerName, showPartnerField, setLifeContext, setCurrentPhaseProgress, onComplete]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 20px 40px',
        flex: 1,
        overflow: 'auto',
      }}
    >
      <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* First Name */}
        <div style={{ animation: 'fadeInUp 0.4s ease 0s both' }}>
          <label style={labelStyle}>First name</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              updateProgress(e.target.value, homeCity, companions);
            }}
            placeholder="What should we call you?"
            disabled={submitted}
            autoFocus
            style={inputStyle(submitted)}
          />
        </div>

        {/* Home City */}
        <div style={{ animation: 'fadeInUp 0.4s ease 0.06s both' }}>
          <label style={labelStyle}>Home base</label>
          <input
            type="text"
            value={homeCity}
            onChange={(e) => {
              setHomeCity(e.target.value);
              updateProgress(firstName, e.target.value, companions);
            }}
            placeholder="City you live in"
            disabled={submitted}
            style={inputStyle(submitted)}
          />
        </div>

        {/* Companions */}
        <div style={{ animation: 'fadeInUp 0.4s ease 0.12s both' }}>
          <label style={labelStyle}>Who do you usually travel with?</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {COMPANION_OPTIONS.map((opt) => {
              const active = companions.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleCompanion(opt.id)}
                  disabled={submitted}
                  className="btn-hover"
                  style={{
                    padding: '10px 18px',
                    borderRadius: 100,
                    border: `1.5px solid ${active ? T.ink : 'rgba(28,26,23,0.1)'}`,
                    background: active ? T.ink : 'transparent',
                    color: active ? T.cream : T.ink,
                    fontSize: 14,
                    fontWeight: 500,
                    fontFamily: FONT.sans,
                    cursor: submitted ? 'default' : 'pointer',
                    transition: 'all 0.2s ease',
                    letterSpacing: '0.01em',
                    opacity: submitted ? 0.6 : 1,
                  }}
                >
                  <span style={{ marginRight: 6 }}>{opt.emoji}</span>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Partner Name (conditional) */}
        {showPartnerField && (
          <div style={{ animation: 'fadeInUp 0.3s ease 0s both' }}>
            <label style={labelStyle}>Partner&apos;s name</label>
            <input
              type="text"
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              placeholder="So we can keep things personal"
              disabled={submitted}
              style={inputStyle(submitted)}
            />
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitted || !isValid}
          className="btn-hover"
          style={{
            marginTop: 8,
            padding: '15px 40px',
            background: submitted ? T.travertine : isValid ? T.ink : 'rgba(28,26,23,0.15)',
            color: submitted ? INK['50'] : isValid ? T.cream : INK['40'],
            border: 'none',
            borderRadius: 100,
            fontSize: 15,
            fontWeight: 500,
            fontFamily: FONT.sans,
            cursor: submitted || !isValid ? 'default' : 'pointer',
            transition: 'all 0.25s ease',
            opacity: submitted ? 0.6 : 1,
            alignSelf: 'center',
            letterSpacing: '0.02em',
            animation: 'fadeInUp 0.4s ease 0.18s both',
          }}
        >
          {submitted ? 'Got it ✓' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

// ─── Shared styles ───

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: INK['45'],
  fontFamily: FONT.mono,
  marginBottom: 8,
};

const inputStyle = (disabled: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '14px 18px',
  fontSize: 16,
  fontFamily: FONT.sans,
  color: T.ink,
  background: 'rgba(28,26,23,0.02)',
  border: '1px solid rgba(28,26,23,0.08)',
  borderRadius: 12,
  outline: 'none',
  transition: 'border-color 0.2s ease',
  opacity: disabled ? 0.6 : 1,
  letterSpacing: '0.01em',
  boxSizing: 'border-box',
});
