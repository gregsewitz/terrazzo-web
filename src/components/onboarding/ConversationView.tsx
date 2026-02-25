'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useConversationPhase } from '@/hooks/useConversationPhase';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTTS } from '@/hooks/useTTS';
import type { OnboardingPhase } from '@/types';

interface ConversationViewProps {
  phase: OnboardingPhase;
  onComplete: () => void;
}

export default function ConversationView({ phase, onComplete }: ConversationViewProps) {
  const [inputText, setInputText] = useState('');
  const [voiceMode, setVoiceMode] = useState(true); // voice-first by default
  const [autoAdvancing, setAutoAdvancing] = useState(false); // true once we start the auto-advance countdown
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const spokenCountRef = useRef(0);
  const sendingRef = useRef(false); // guard against double-send from silence detection
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const {
    messages,
    isAnalyzing,
    isPhaseComplete,
    sendMessage,
  } = useConversationPhase({
    phaseId: phase.id,
    aiPrompt: phase.aiPrompt,
    followUps: phase.followUps,
  });

  // Auto-advance after phase completion — triggered when TTS finishes speaking the transition message
  const triggerAutoAdvance = useCallback(() => {
    if (autoAdvanceTimerRef.current) return; // already scheduled
    setAutoAdvancing(true);
    autoAdvanceTimerRef.current = setTimeout(() => {
      onComplete();
    }, 1800); // 1.8s pause after TTS ends (or after read-time) before auto-advancing
  }, [onComplete]);

  // Clean up auto-advance timer on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    };
  }, []);

  // Auto-start mic after TTS finishes speaking, OR auto-advance if phase is done
  const handleTTSDone = useCallback(() => {
    if (isPhaseComplete) {
      // Phase is done and TTS just finished speaking the transition — auto-advance
      triggerAutoAdvance();
      return;
    }
    if (voiceMode && !isAnalyzing) {
      // Small delay so the audio system settles before mic activates
      setTimeout(() => {
        startListeningRef.current?.();
      }, 300);
    }
  }, [voiceMode, isPhaseComplete, isAnalyzing, triggerAutoAdvance]);

  // Handle silence detection — auto-send the transcript
  const handleSilenceDetected = useCallback(async (text: string) => {
    if (sendingRef.current || isAnalyzing || isPhaseComplete) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    sendingRef.current = true;
    setInputText('');
    resetTranscriptRef.current?.();
    stopListeningRef.current?.();
    stopTTSRef.current?.();
    await sendMessage(trimmed);
    sendingRef.current = false;
  }, [isAnalyzing, isPhaseComplete, sendMessage]);

  const {
    isListening,
    transcript,
    isSupported: speechSupported,
    startListening,
    stopListening,
    resetTranscript,
    hasFailed: speechFailed,
  } = useSpeechRecognition({
    silenceTimeout: voiceMode ? 1500 : 0, // 1.5s silence auto-sends in voice mode
    onSilenceDetected: handleSilenceDetected,
  });

  // Store refs for callbacks (avoid stale closures)
  const startListeningRef = useRef(startListening);
  startListeningRef.current = startListening;
  const stopListeningRef = useRef(stopListening);
  stopListeningRef.current = stopListening;
  const resetTranscriptRef = useRef(resetTranscript);
  resetTranscriptRef.current = resetTranscript;

  const { isSpeaking, speak, stop: stopTTS, enabled: ttsEnabled, setEnabled: setTTSEnabled } = useTTS({
    voice: 'nova',
    onDone: handleTTSDone,
  });

  const stopTTSRef = useRef(stopTTS);
  stopTTSRef.current = stopTTS;

  // Speak new AI messages automatically
  useEffect(() => {
    if (!ttsEnabled) {
      // If TTS is off, handle auto-start mic or auto-advance with read-time delay
      const newMessages = messages.slice(spokenCountRef.current);
      const latestAI = [...newMessages].reverse().find((m) => m.role === 'ai');
      spokenCountRef.current = messages.length;
      if (latestAI) {
        if (isPhaseComplete) {
          // No TTS — use a read-time delay before auto-advancing (roughly 40ms per word)
          const readTime = Math.max(2000, latestAI.text.split(/\s+/).length * 40);
          setTimeout(() => triggerAutoAdvance(), readTime);
        } else if (voiceMode && !isAnalyzing) {
          setTimeout(() => startListeningRef.current?.(), 300);
        }
      }
      return;
    }
    const newMessages = messages.slice(spokenCountRef.current);
    const latestAI = [...newMessages].reverse().find((m) => m.role === 'ai');
    spokenCountRef.current = messages.length;
    if (latestAI) {
      speak(latestAI.text);
    }
  }, [messages, ttsEnabled, speak, voiceMode, isPhaseComplete, isAnalyzing, triggerAutoAdvance]);

  // Stop TTS when user starts talking
  useEffect(() => {
    if (isListening && isSpeaking) {
      stopTTS();
    }
  }, [isListening, isSpeaking, stopTTS]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isAnalyzing, transcript]);

  // Sync speech transcript to input
  useEffect(() => {
    if (transcript) setInputText(transcript);
  }, [transcript]);

  // Auto-switch to text mode if speech recognition fails (e.g. mobile Safari, permissions denied)
  useEffect(() => {
    if (speechFailed && voiceMode) {
      setVoiceMode(false);
    }
  }, [speechFailed, voiceMode]);

  // Auto-resize textarea (only in text mode)
  useEffect(() => {
    if (voiceMode) return;
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [inputText, voiceMode]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sendingRef.current) return;
    sendingRef.current = true;
    setInputText('');
    resetTranscript();
    if (isListening) stopListening();
    stopTTS();
    await sendMessage(text);
    sendingRef.current = false;
  }, [inputText, resetTranscript, isListening, stopListening, stopTTS, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleVoice = () => {
    if (isListening) {
      stopListening();
      if (inputText.trim()) handleSend();
    } else {
      setInputText('');
      resetTranscript();
      startListening();
    }
  };

  // Determine current state for the voice-mode UI
  const voiceState: 'speaking' | 'listening' | 'thinking' | 'idle' =
    isSpeaking ? 'speaking' :
    isListening ? 'listening' :
    isAnalyzing ? 'thinking' : 'idle';

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages — scrollable area between fixed header and fixed input */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-5 py-6 space-y-4 max-w-2xl mx-auto w-full">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`
              max-w-[85%] message-enter
              ${msg.role === 'ai' ? 'mr-auto' : 'ml-auto'}
            `}
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            {msg.role === 'ai' ? (
              <div className="space-y-1">
                <p className="text-[15px] leading-relaxed text-[var(--t-ink)]">
                  {msg.text}
                </p>
              </div>
            ) : (
              <div
                className="rounded-2xl rounded-br-sm px-4 py-3"
                style={{ backgroundColor: 'var(--t-travertine)' }}
              >
                <p className="text-[15px] leading-relaxed text-[var(--t-ink)]">
                  {msg.text}
                </p>
              </div>
            )}
          </div>
        ))}

        {/* Live transcript preview while listening — tap to edit */}
        {isListening && transcript && (
          <div className="ml-auto max-w-[85%]">
            <div
              className="rounded-2xl rounded-br-sm px-4 py-3 opacity-50 cursor-pointer"
              style={{ backgroundColor: 'var(--t-travertine)' }}
              onClick={() => {
                // Stop listening and switch to text mode so user can fix garbled transcript
                stopListening();
                setInputText(transcript);
                setVoiceMode(false);
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
              title="Tap to edit"
            >
              <p className="text-[15px] leading-relaxed text-[var(--t-ink)] italic">
                {transcript}
              </p>
              <p className="text-[10px] text-[var(--t-ink)]/25 mt-1">tap to edit</p>
            </div>
          </div>
        )}

        {isAnalyzing && (
          <div className="mr-auto flex items-center gap-1.5 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--t-honey)] animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--t-honey)] animate-pulse [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--t-honey)] animate-pulse [animation-delay:0.4s]" />
          </div>
        )}
      </div>

      {/* Input Area — anchored to bottom */}
      <div className="flex-shrink-0 border-t border-[var(--t-travertine)] px-4 py-3 bg-[var(--t-cream)] max-w-2xl mx-auto w-full">
        {isPhaseComplete ? (
          <button
            onClick={() => {
              if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
              onComplete();
            }}
            className="w-full py-3 rounded-xl text-[14px] font-medium text-white transition-all
              hover:opacity-90 active:scale-[0.98] relative overflow-hidden"
            style={{ backgroundColor: 'var(--t-ink)' }}
          >
            {autoAdvancing ? (
              <>
                <span className="relative z-10">Continuing...</span>
                <div
                  className="absolute inset-0 bg-[var(--t-honey)]/20 origin-left animate-[fillBar_2s_ease-out_forwards]"
                />
              </>
            ) : 'Continue'}
          </button>
        ) : voiceMode && speechSupported && !speechFailed ? (
          /* Voice-first mode — clean, centered UI */
          <div className="flex flex-col items-center gap-3">
            {/* Voice state indicator */}
            <div className="flex items-center justify-center gap-3 w-full">
              {/* TTS toggle (small) */}
              <button
                onClick={() => {
                  if (isSpeaking) stopTTS();
                  setTTSEnabled(!ttsEnabled);
                }}
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center transition-all border
                  ${ttsEnabled
                    ? 'border-[var(--t-honey)] text-[var(--t-honey)]'
                    : 'border-[var(--t-travertine)] text-[var(--t-ink)]/30'
                  }
                `}
                title={ttsEnabled ? 'Voice output on' : 'Voice output off'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  {ttsEnabled && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
                </svg>
              </button>

              {/* Main mic button — large and centered */}
              <button
                onClick={toggleVoice}
                disabled={isAnalyzing || isSpeaking}
                className={`
                  w-14 h-14 rounded-full flex items-center justify-center transition-all
                  ${voiceState === 'listening'
                    ? 'bg-[var(--t-signal-red)] text-white scale-110'
                    : voiceState === 'speaking'
                      ? 'bg-[var(--t-honey)] text-white'
                      : voiceState === 'thinking'
                        ? 'bg-[var(--t-travertine)] text-[var(--t-ink)]/40'
                        : 'bg-[var(--t-ink)] text-[var(--t-cream)] hover:scale-105'
                  }
                `}
              >
                {voiceState === 'speaking' ? (
                  /* Waveform icon */
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="4" y1="8" x2="4" y2="16" className="animate-pulse" />
                    <line x1="8" y1="5" x2="8" y2="19" className="animate-pulse [animation-delay:0.1s]" />
                    <line x1="12" y1="3" x2="12" y2="21" className="animate-pulse [animation-delay:0.2s]" />
                    <line x1="16" y1="5" x2="16" y2="19" className="animate-pulse [animation-delay:0.3s]" />
                    <line x1="20" y1="8" x2="20" y2="16" className="animate-pulse [animation-delay:0.4s]" />
                  </svg>
                ) : voiceState === 'thinking' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : (
                  /* Mic icon */
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                )}
              </button>

              {/* Switch to text mode */}
              <button
                onClick={() => {
                  setVoiceMode(false);
                  if (isListening) stopListening();
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all
                  border border-[var(--t-travertine)] text-[var(--t-ink)]/30 hover:text-[var(--t-ink)]/60"
                title="Switch to typing"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <line x1="6" y1="8" x2="6" y2="8" />
                  <line x1="10" y1="8" x2="10" y2="8" />
                  <line x1="14" y1="8" x2="14" y2="8" />
                  <line x1="18" y1="8" x2="18" y2="8" />
                  <line x1="8" y1="16" x2="16" y2="16" />
                </svg>
              </button>
            </div>

            {/* Status text */}
            <p className="text-[12px] font-mono text-[var(--t-ink)]/30">
              {voiceState === 'listening' && 'Listening... just talk naturally'}
              {voiceState === 'speaking' && 'Speaking...'}
              {voiceState === 'thinking' && 'Thinking...'}
              {voiceState === 'idle' && (isAnalyzing ? 'Processing...' : 'Tap to talk')}
            </p>
          </div>
        ) : (
          /* Text mode — with option to switch back to voice */
          <div className="flex items-end gap-2">
            {/* Voice mode button */}
            {speechSupported && !speechFailed && (
              <button
                onClick={() => {
                  setVoiceMode(true);
                  setInputText('');
                  resetTranscript();
                }}
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                  transition-all border border-[var(--t-travertine)] text-[var(--t-ink)]/40
                  hover:border-[var(--t-honey)] hover:text-[var(--t-honey)]"
                title="Switch to voice"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
            )}

            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your response..."
              rows={1}
              className="flex-1 resize-none bg-transparent text-[15px] leading-relaxed
                text-[var(--t-ink)] placeholder:text-[var(--t-ink)]/30
                outline-none py-2 overflow-y-auto"
              style={{ maxHeight: '200px' }}
              disabled={isAnalyzing}
              autoFocus
            />

            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isAnalyzing}
              className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                transition-all disabled:opacity-20"
              style={{ backgroundColor: 'var(--t-ink)', color: 'var(--t-cream)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
