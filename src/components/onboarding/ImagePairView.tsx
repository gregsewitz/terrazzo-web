'use client';

import { useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useOnboardingStore } from '@/stores/onboardingStore';
import type { TasteSignal, ImagePairQuestion } from '@/types';
import { T } from '@/types';
import { FONT, INK } from '@/constants/theme';

interface ImagePairViewProps {
  onComplete: () => void;
  questions: ImagePairQuestion[];
}

/**
 * ImagePairView — A/B photo comparison stepper.
 *
 * Shows two photos side by side with a prompt. User taps the image that
 * resonates more. Brief pause with highlight → next pair.
 *
 * Signal emission: chosen side emits at confidence 0.90.
 * Validator questions (isValidator: true) emit at 0.85.
 */
export default function ImagePairView({ onComplete, questions }: ImagePairViewProps) {
  const addSignals = useOnboardingStore((s) => s.addSignals);
  const updateCertainties = useOnboardingStore((s) => s.updateCertainties);
  const setCurrentPhaseProgress = useOnboardingStore((s) => s.setCurrentPhaseProgress);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, 'a' | 'b'>>({});
  const [selectedForCurrent, setSelectedForCurrent] = useState<'a' | 'b' | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [completed, setCompleted] = useState(false);

  const currentQuestion = useMemo(() => questions[currentIdx], [questions, currentIdx]);
  const totalQuestions = questions.length;

  const emitAllSignals = useCallback(() => {
    const signals: TasteSignal[] = [];
    const certaintyUpdates: Record<string, number> = {};

    for (const [qId, side] of Object.entries(answers)) {
      const question = questions.find((q) => q.id === qId);
      if (!question) continue;

      const conf = question.isValidator ? 0.85 : 0.90;
      const signalTags = side === 'a' ? question.aSignals : question.bSignals;
      for (const tag of signalTags) {
        signals.push({ tag, cat: question.domain, confidence: conf });
      }
      certaintyUpdates[question.domain] = (certaintyUpdates[question.domain] || 0) + 10;
    }

    if (signals.length > 0) addSignals(signals);
    if (Object.keys(certaintyUpdates).length > 0) updateCertainties(certaintyUpdates);
  }, [answers, questions, addSignals, updateCertainties]);

  const handleSelect = useCallback((side: 'a' | 'b') => {
    if (transitioning || completed) return;

    setSelectedForCurrent(side);
    setTransitioning(true);

    const updatedAnswers = { ...answers, [currentQuestion.id]: side };
    setAnswers(updatedAnswers);

    const nextIdx = currentIdx + 1;
    const progress = nextIdx / totalQuestions;
    setCurrentPhaseProgress(progress);

    setTimeout(() => {
      if (nextIdx >= totalQuestions) {
        // All answered — emit signals
        setCompleted(true);
        // Need to emit with the final answers
        const finalSignals: TasteSignal[] = [];
        const finalCertainty: Record<string, number> = {};
        for (const [qId, s] of Object.entries(updatedAnswers)) {
          const q = questions.find((qq) => qq.id === qId);
          if (!q) continue;
          const conf = q.isValidator ? 0.85 : 0.90;
          const tags = s === 'a' ? q.aSignals : q.bSignals;
          for (const tag of tags) {
            finalSignals.push({ tag, cat: q.domain, confidence: conf });
          }
          finalCertainty[q.domain] = (finalCertainty[q.domain] || 0) + 10;
        }
        if (finalSignals.length > 0) addSignals(finalSignals);
        if (Object.keys(finalCertainty).length > 0) updateCertainties(finalCertainty);

        setTimeout(() => onComplete(), 400);
      } else {
        setCurrentIdx(nextIdx);
        setSelectedForCurrent(null);
        setTransitioning(false);
      }
    }, 600);
  }, [transitioning, completed, answers, currentQuestion, currentIdx, totalQuestions, questions, addSignals, updateCertainties, setCurrentPhaseProgress, onComplete]);

  if (!currentQuestion) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      padding: '24px 16px',
      gap: 20,
      maxWidth: 520,
      margin: '0 auto',
      width: '100%',
    }}>
      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 6 }}>
        {questions.map((_, i) => (
          <div
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: i < currentIdx ? T.honey : i === currentIdx ? T.ink : 'rgba(26,45,74,0.15)',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>

      {/* Prompt */}
      <p style={{
        fontFamily: FONT.serif,
        fontSize: 22,
        color: T.ink,
        textAlign: 'center',
        margin: 0,
        lineHeight: 1.3,
      }}>
        {currentQuestion.prompt}
      </p>

      {/* Image pair */}
      <div style={{
        display: 'flex',
        gap: 12,
        width: '100%',
        opacity: transitioning ? 0.7 : 1,
        transition: 'opacity 0.3s',
      }}>
        {(['a', 'b'] as const).map((side) => {
          const data = currentQuestion[side];
          const isSelected = selectedForCurrent === side;
          const isOther = selectedForCurrent !== null && !isSelected;

          return (
            <button
              key={side}
              onClick={() => handleSelect(side)}
              disabled={transitioning || completed}
              style={{
                flex: 1,
                position: 'relative',
                cursor: transitioning ? 'default' : 'pointer',
                border: 'none',
                background: 'none',
                padding: 0,
                borderRadius: 12,
                overflow: 'hidden',
                outline: isSelected ? `3px solid ${T.honey}` : '3px solid transparent',
                outlineOffset: -3,
                opacity: isOther ? 0.5 : 1,
                transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                transition: 'all 0.3s ease',
                aspectRatio: '1/1',
              }}
            >
              <Image
                src={data.imageUrl}
                alt={data.label}
                fill
                sizes="(max-width: 520px) 45vw, 240px"
                style={{ objectFit: 'cover' }}
                priority={currentIdx === 0}
              />
              {/* Label overlay at bottom */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '32px 12px 12px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.55))',
                color: '#fff',
                fontFamily: FONT.sans,
                fontSize: 13,
                fontWeight: 500,
                textAlign: 'center',
                letterSpacing: '0.01em',
              }}>
                {data.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Hint text */}
      <p style={{
        fontFamily: FONT.sans,
        fontSize: 13,
        color: T.ink,
        textAlign: 'center',
        margin: 0,
      }}>
        Tap the one that draws you in
      </p>
    </div>
  );
}
