'use client';

import { useState, useCallback, useMemo } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import type { TasteSignal, SceneQuestion } from '@/types';
import { COLOR, FONT, INK, TEXT } from '@/constants/theme';

interface SceneChoiceViewProps {
  onComplete: () => void;
  questions: SceneQuestion[];
}

/**
 * SceneChoiceView — multi-question stepper where each question is single-select from 4 options.
 *
 * Flow: Show one question at a time. User taps an option → brief pause → next question.
 * After all questions answered, emit accumulated signals and call onComplete.
 *
 * Signal emission: selected options emit at confidence 0.88.
 * Validator questions (isValidator: true) emit at 0.85 for cross-referencing.
 */
export default function SceneChoiceView({ onComplete, questions }: SceneChoiceViewProps) {
  const addSignals = useOnboardingStore((s) => s.addSignals);
  const updateCertainties = useOnboardingStore((s) => s.updateCertainties);
  const setCurrentPhaseProgress = useOnboardingStore((s) => s.setCurrentPhaseProgress);

  // Track which question we're on and all answers
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // questionId → optionId
  const [selectedForCurrent, setSelectedForCurrent] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [completed, setCompleted] = useState(false);

  const currentQuestion = useMemo(() => questions[currentIdx], [questions, currentIdx]);
  const totalQuestions = questions.length;

  const emitAllSignals = useCallback(() => {
    const signals: TasteSignal[] = [];
    const certaintyUpdates: Record<string, number> = {};

    for (const [qId, optId] of Object.entries(answers)) {
      const question = questions.find((q) => q.id === qId);
      if (!question) continue;
      const option = question.options.find((o) => o.id === optId);
      if (!option) continue;

      const conf = question.isValidator ? 0.85 : 0.88;
      for (const tag of option.signals) {
        signals.push({ tag, cat: option.domain, confidence: conf });
      }
      certaintyUpdates[option.domain] = (certaintyUpdates[option.domain] || 0) + 8;
    }

    if (signals.length > 0) addSignals(signals);
    if (Object.keys(certaintyUpdates).length > 0) updateCertainties(certaintyUpdates);
  }, [answers, questions, addSignals, updateCertainties]);

  const handleSelect = useCallback((optionId: string) => {
    if (transitioning || completed) return;
    setSelectedForCurrent(optionId);
    setTransitioning(true);

    const newAnswers = { ...answers, [currentQuestion.id]: optionId };
    setAnswers(newAnswers);

    const nextIdx = currentIdx + 1;
    setCurrentPhaseProgress(nextIdx / totalQuestions);

    // Brief pause to show selection, then advance
    setTimeout(() => {
      if (nextIdx >= totalQuestions) {
        // All questions answered — emit signals and complete
        setCompleted(true);
        // Emit from the final answer set
        const signals: TasteSignal[] = [];
        const certaintyUpdates: Record<string, number> = {};
        for (const [qId, oId] of Object.entries(newAnswers)) {
          const question = questions.find((q) => q.id === qId);
          if (!question) continue;
          const option = question.options.find((o) => o.id === oId);
          if (!option) continue;
          const conf = question.isValidator ? 0.85 : 0.88;
          for (const tag of option.signals) {
            signals.push({ tag, cat: option.domain, confidence: conf });
          }
          certaintyUpdates[option.domain] = (certaintyUpdates[option.domain] || 0) + 8;
        }
        if (signals.length > 0) addSignals(signals);
        if (Object.keys(certaintyUpdates).length > 0) updateCertainties(certaintyUpdates);
        setCurrentPhaseProgress(1);
        setTimeout(onComplete, 500);
      } else {
        setCurrentIdx(nextIdx);
        setSelectedForCurrent(null);
        setTransitioning(false);
      }
    }, 400);
  }, [transitioning, completed, answers, currentQuestion, currentIdx, totalQuestions, questions, addSignals, updateCertainties, setCurrentPhaseProgress, onComplete]);

  if (!currentQuestion) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 20px 40px',
        flex: 1,
        overflow: 'auto',
      }}
    >
      <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Progress dots */}
        <div style={{
          display: 'flex',
          gap: 6,
          justifyContent: 'center',
          marginBottom: 16,
        }}>
          {questions.map((_, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: i < currentIdx ? COLOR.darkTeal
                  : i === currentIdx ? TEXT.primary
                  : 'rgba(28, 26, 23, 0.12)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* Question prompt */}
        <p style={{
          color: TEXT.primary,
          fontSize: 18,
          fontFamily: FONT.serif,
          margin: '0 0 24px',
          textAlign: 'center',
          lineHeight: 1.4,
          animation: 'fadeInUp 0.3s ease both',
        }}
        key={currentQuestion.id} // force re-render animation
        >
          {currentQuestion.prompt}
        </p>

        {/* Options */}
        {currentQuestion.options.map((opt, i) => {
          const isSelected = selectedForCurrent === opt.id;

          return (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              disabled={transitioning || completed}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '16px 18px',
                background: isSelected
                  ? 'rgba(58, 128, 136, 0.08)'
                  : 'rgba(28, 26, 23, 0.02)',
                borderRadius: 14,
                border: isSelected
                  ? '1.5px solid rgba(58, 128, 136, 0.3)'
                  : '1px solid rgba(28, 26, 23, 0.06)',
                cursor: (transitioning || completed) ? 'default' : 'pointer',
                opacity: completed ? 0.6 : 1,
                transition: 'all 0.25s ease',
                animation: `fadeInUp 0.3s ease ${i * 0.06}s both`,
                textAlign: 'left',
                width: '100%',
              }}
            >
              {/* Selection indicator */}
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: isSelected ? COLOR.darkTeal : 'rgba(28, 26, 23, 0.04)',
                transition: 'all 0.25s ease',
              }}>
                {isSelected && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7l3 3 5-6" stroke={COLOR.cream} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>

              <p style={{
                fontSize: 15,
                fontFamily: FONT.serif,
                color: TEXT.primary,
                margin: 0,
                lineHeight: 1.35,
              }}>
                {opt.label}
              </p>
            </button>
          );
        })}

        {/* Question counter */}
        <p style={{
          fontSize: 11,
          fontFamily: FONT.mono,
          color: TEXT.primary,
          textAlign: 'center',
          margin: '20px 0 0',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          {currentIdx + 1} / {totalQuestions}
        </p>
      </div>
    </div>
  );
}
