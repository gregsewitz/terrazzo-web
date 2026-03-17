'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useConversationPhase } from '@/hooks/useConversationPhase';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTTS } from '@/hooks/useTTS';
import { useVoiceActivity } from '@/hooks/useVoiceActivity';
import AnchorVerificationCard from './AnchorVerificationCard';
import type { OnboardingPhase } from '@/types';

interface ConversationViewProps {
  phase: OnboardingPhase;
  onComplete: () => void;
}

/**
 * Conversational state machine states:
 *
 *   ai-speaking  → TTS is playing the AI response
 *   listening    → Mic is open, waiting for user to speak
 *   processing   → User finished speaking, sending to API + waiting for AI response
 *   idle         → Fallback state (shouldn't linger here in voice mode)
 *
 * Flow: ai-speaking → listening → (user speaks) → processing → ai-speaking → ...
 *
 * Barge-in: If the user starts speaking while AI is talking (detected via VAD),
 * we duck the TTS audio (smooth fade-out) and transition directly to listening.
 */
type ConversationState = 'ai-speaking' | 'listening' | 'processing' | 'idle';

// Silence timeout values (ms) — how long to wait after user stops speaking before auto-sending
const SILENCE_QUICK = 1200;   // Quick response expected (yes/no, name, one-liner)
const SILENCE_REFLECTIVE = 2500; // Reflective response expected (story, detailed answer)
const SILENCE_DEFAULT = 1800;    // Default when we don't have a hint

export default function ConversationView({ phase, onComplete }: ConversationViewProps) {
  const [inputText, setInputText] = useState('');
  const [voiceMode, setVoiceMode] = useState(true); // voice-first by default
  const [autoAdvancing, setAutoAdvancing] = useState(false);
  const [micPermissionNeeded, setMicPermissionNeeded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const spokenCountRef = useRef(0);
  const sendingRef = useRef(false);
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true); // tracks if component is still mounted
  const isSpeakingRef = useRef(false); // mirrors isSpeaking for async callbacks
  const streamHandledRef = useRef(false); // true when streaming pipeline is handling TTS for current response

  // Conversational state
  const [convState, setConvState] = useState<ConversationState>('idle');
  const convStateRef = useRef<ConversationState>('idle');
  const updateConvState = useCallback((state: ConversationState) => {
    convStateRef.current = state;
    setConvState(state);
  }, []);

  // Expected response type — controls silence timeout duration
  const expectedResponseTypeRef = useRef<'quick' | 'reflective'>('reflective');

  // Refs for TTS queue integration (set after useTTS initializes)
  const queueSentenceRef = useRef<((s: string) => void) | null>(null);
  const finishQueueRef = useRef<(() => void) | null>(null);
  const ttsEnabledRef = useRef(true);

  // VAD initialized flag
  const vadInitializedRef = useRef(false);

  const {
    messages,
    isAnalyzing,
    isPhaseComplete,
    anchorsForReview,
    confirmAnchor,
    dismissAnchor,
    reResolvePlace,
    sendMessage,
  } = useConversationPhase({
    phaseId: phase.id,
    aiPrompt: phase.aiPrompt,
    followUps: phase.followUps,
    // Progressive TTS: queue each sentence as it arrives from streaming LLM
    onSentence: (sentence) => {
      if (ttsEnabledRef.current && queueSentenceRef.current) {
        // Safety filter: skip anything that looks like leaked JSON/internal commands
        if (/^\s*"?(phaseComplete|userRequestedSkip|correctedTranscript|followUp|expectedResponseType)\s*"?\s*:/i.test(sentence)) return;
        if (/^\s*\{?\s*"/.test(sentence) && /[{}]/.test(sentence)) return;
        if (/^(true|false|\d+)\s*[,}]?\s*$/.test(sentence.trim())) return;
        streamHandledRef.current = true;
        queueSentenceRef.current(sentence);
      }
    },
    onResponseComplete: () => {
      if (ttsEnabledRef.current && finishQueueRef.current) {
        finishQueueRef.current();
      }
    },
    onExpectedResponseType: (type) => {
      expectedResponseTypeRef.current = type;
      // Dynamically update the silence timeout for the next listening session
      const timeout = type === 'quick' ? SILENCE_QUICK : SILENCE_REFLECTIVE;
      setSilenceTimeoutRef.current?.(timeout);
    },
  });

  // Track mounted state for safe async operations
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Auto-advance after phase completion — triggered when TTS finishes speaking the transition message
  const triggerAutoAdvance = useCallback(() => {
    if (autoAdvanceTimerRef.current) return;
    setAutoAdvancing(true);
    autoAdvanceTimerRef.current = setTimeout(function check() {
      if (!mountedRef.current) return;
      if (isSpeakingRef.current) {
        autoAdvanceTimerRef.current = setTimeout(check, 500);
        return;
      }
      autoAdvanceTimerRef.current = null;
      onComplete();
    }, 1800);
  }, [onComplete]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    };
  }, []);

  // After TTS finishes speaking: auto-advance if phase is done,
  // otherwise transition to listening state
  const handleTTSDone = useCallback(() => {
    if (isPhaseComplete && anchorsForReview.length === 0) {
      triggerAutoAdvance();
      return;
    }

    // Transition to listening — auto-open mic for hands-free flow
    if (voiceMode && !isPhaseComplete) {
      // Apply the adaptive silence timeout BEFORE starting to listen,
      // so the correct timeout is used from the very first word.
      const timeout = expectedResponseTypeRef.current === 'quick' ? SILENCE_QUICK : SILENCE_REFLECTIVE;
      setSilenceTimeoutRef.current?.(timeout);
      updateConvState('listening');
      startListeningRef.current?.();
    } else {
      updateConvState('idle');
    }
  }, [isPhaseComplete, anchorsForReview.length, triggerAutoAdvance, voiceMode, updateConvState]);

  // Handle sending speech transcript
  const handleSendTranscript = useCallback(async (text: string) => {
    if (sendingRef.current || isAnalyzing || isPhaseComplete) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    sendingRef.current = true;
    updateConvState('processing');
    setInputText('');
    streamHandledRef.current = false;
    resetTranscriptRef.current?.();
    stopListeningRef.current?.();
    stopTTSRef.current?.();
    await sendMessage(trimmed);
    if (mountedRef.current) sendingRef.current = false;
  }, [isAnalyzing, isPhaseComplete, sendMessage, updateConvState]);

  const {
    isListening,
    transcript,
    isSupported: speechSupported,
    startListening,
    stopListening,
    resetTranscript,
    hasFailed: speechFailed,
    setSilenceTimeout,
  } = useSpeechRecognition({
    silenceTimeout: SILENCE_DEFAULT,
    onSilenceDetected: handleSendTranscript,
    autoRestart: voiceMode, // Auto-restart in voice mode for hands-free experience
  });

  // Store refs for callbacks (avoid stale closures)
  const startListeningRef = useRef(startListening);
  startListeningRef.current = startListening;
  const stopListeningRef = useRef(stopListening);
  stopListeningRef.current = stopListening;
  const resetTranscriptRef = useRef(resetTranscript);
  resetTranscriptRef.current = resetTranscript;
  const setSilenceTimeoutRef = useRef(setSilenceTimeout);
  setSilenceTimeoutRef.current = setSilenceTimeout;

  const { isSpeaking, speak, queueSentence, finishQueue, stop: stopTTS, duck: duckTTS, enabled: ttsEnabled, setEnabled: setTTSEnabled } = useTTS({
    voice: 'nova',
    onDone: handleTTSDone,
  });

  // Wire up refs so the streaming onSentence callback can access TTS queue
  queueSentenceRef.current = queueSentence;
  finishQueueRef.current = finishQueue;
  ttsEnabledRef.current = ttsEnabled;

  const stopTTSRef = useRef(stopTTS);
  stopTTSRef.current = stopTTS;
  const duckTTSRef = useRef(duckTTS);
  duckTTSRef.current = duckTTS;
  isSpeakingRef.current = isSpeaking;

  // ── Voice Activity Detection (VAD) for barge-in ──
  // When the user starts speaking while the AI is talking, duck the TTS.
  // Uses refs throughout to avoid stale closure issues — this callback is registered
  // once when VAD initializes and must always see current state.
  const handleBargeIn = useCallback(() => {
    if (isSpeakingRef.current && convStateRef.current === 'ai-speaking') {
      // Smooth duck instead of hard stop — feels natural
      duckTTSRef.current?.();
      updateConvState('listening');
      // Always start listening on barge-in — speech recognition may not be active yet
      startListeningRef.current?.();
    }
  }, [updateConvState]);

  // VAD enabled state is tracked via ref to avoid re-creating the hook on every isSpeaking change.
  // The useVoiceActivity hook reads `enabled` via its own ref internally,
  // so passing a stable `true` here and controlling detection via the hook's polling loop is fine.
  const vadEnabledRef = useRef(false);
  vadEnabledRef.current = voiceMode && isSpeaking;

  const {
    isSupported: vadSupported,
    permissionDenied: vadPermissionDenied,
    init: initVAD,
    destroy: destroyVAD,
  } = useVoiceActivity({
    threshold: 30, // Slightly above default to avoid false positives from speakers
    silenceDelay: 200,
    onVoiceStart: handleBargeIn,
    enabled: voiceMode, // Keep VAD polling active in voice mode; it only fires callback when volume exceeds threshold
  });

  // Initialize VAD on first user interaction (needs gesture for getUserMedia)
  const initVADOnGesture = useCallback(async () => {
    if (vadInitializedRef.current || !vadSupported || vadPermissionDenied) return;
    const success = await initVAD();
    vadInitializedRef.current = success;
    if (!success) {
      // VAD not available — barge-in won't work, but that's OK
      // User can still tap to interrupt
      console.warn('[ConversationView] VAD init failed — barge-in disabled');
    }
  }, [vadSupported, vadPermissionDenied, initVAD]);

  // Clean up VAD on unmount
  useEffect(() => {
    return () => {
      destroyVAD();
    };
  }, [destroyVAD]);

  // Stop TTS on unmount
  useEffect(() => {
    return () => {
      stopTTSRef.current?.();
    };
  }, []);

  // Speak new AI messages
  useEffect(() => {
    const newMessages = messages.slice(spokenCountRef.current);
    const latestAI = [...newMessages].reverse().find((m) => m.role === 'ai');
    const prevCount = spokenCountRef.current;
    spokenCountRef.current = messages.length;

    if (!latestAI) return;

    if (!ttsEnabled) {
      if (isPhaseComplete && anchorsForReview.length === 0) {
        const readTime = Math.max(2000, latestAI.text.split(/\s+/).length * 40);
        setTimeout(() => {
          if (mountedRef.current) triggerAutoAdvance();
        }, readTime);
      } else if (voiceMode && !isPhaseComplete) {
        // No TTS — go straight to listening
        updateConvState('listening');
        startListeningRef.current?.();
      }
      return;
    }

    // Transition to ai-speaking state
    updateConvState('ai-speaking');

    const isOpeningPrompt = prevCount === 0 && messages.length === 1;
    if (isOpeningPrompt) {
      speak(latestAI.text);
    } else if (!streamHandledRef.current) {
      const fallbackTimer = setTimeout(() => {
        if (!streamHandledRef.current && !isSpeakingRef.current && mountedRef.current) {
          speak(latestAI.text);
        }
      }, 500);
      return () => clearTimeout(fallbackTimer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, ttsEnabled, speak, isPhaseComplete, anchorsForReview.length, triggerAutoAdvance, voiceMode, updateConvState]);

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

  // Auto-switch to text mode if speech recognition fails
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

  // Text mode send
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sendingRef.current) return;
    sendingRef.current = true;
    setInputText('');
    streamHandledRef.current = false;
    resetTranscript();
    if (isListening) stopListening();
    stopTTS();
    await sendMessage(text);
    if (mountedRef.current) sendingRef.current = false;
  }, [inputText, resetTranscript, isListening, stopListening, stopTTS, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- Tap-to-interrupt (during AI speech) ---
  const handleTapInterrupt = useCallback(() => {
    if (isSpeaking) {
      duckTTS();
      updateConvState('listening');
      startListening();
    }
  }, [isSpeaking, duckTTS, updateConvState, startListening]);

  // --- Tap-to-speak (when idle, not yet listening) ---
  const handleTapToSpeak = useCallback(() => {
    if (isAnalyzing || isPhaseComplete) return;
    // Initialize VAD on first tap
    initVADOnGesture();

    if (isSpeaking) stopTTS();
    updateConvState('listening');
    resetTranscript();
    startListening();
  }, [isAnalyzing, isPhaseComplete, isSpeaking, stopTTS, updateConvState, resetTranscript, startListening, initVADOnGesture]);

  // Mic permission prompt — show once on first voice interaction
  useEffect(() => {
    if (voiceMode && speechSupported && !speechFailed && !micPermissionNeeded) {
      // Check if we need mic permission by trying to start (will show permission dialog)
      setMicPermissionNeeded(true);
    }
  }, [voiceMode, speechSupported, speechFailed, micPermissionNeeded]);

  // We need a ref to get the latest transcript at send time
  const latestTranscriptForSendRef = useRef('');
  useEffect(() => {
    latestTranscriptForSendRef.current = transcript;
  }, [transcript]);

  // Derive voice state for UI rendering
  const voiceState: 'speaking' | 'listening' | 'thinking' | 'idle' =
    convState === 'ai-speaking' ? 'speaking' :
    isListening ? 'listening' :
    (isAnalyzing || convState === 'processing') ? 'thinking' : 'idle';

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
                <p className="text-[15px] leading-relaxed text-[var(--t-navy)]">
                  {msg.text}
                </p>
              </div>
            ) : (
              <div
                className="rounded-2xl rounded-br-sm px-4 py-3"
                style={{ backgroundColor: 'var(--t-peach)' }}
              >
                <p className="text-[15px] leading-relaxed text-[var(--t-navy)]">
                  {msg.text}
                </p>
              </div>
            )}
          </div>
        ))}

        {/* Live transcript preview while listening */}
        {isListening && transcript && (
          <div className="ml-auto max-w-[85%]">
            <div
              className="rounded-2xl rounded-br-sm px-4 py-3 opacity-50"
              style={{ backgroundColor: 'var(--t-travertine)' }}
            >
              <p className="text-[15px] leading-relaxed text-[var(--t-navy)] italic">
                {transcript}
              </p>
            </div>
          </div>
        )}

        {isAnalyzing && (
          <div className="mr-auto flex items-center gap-1.5 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--t-ochre)] animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--t-ochre)] animate-pulse [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--t-ochre)] animate-pulse [animation-delay:0.4s]" />
          </div>
        )}

        {/* End-of-phase anchor verification */}
        {isPhaseComplete && anchorsForReview.length > 0 && (
          <div className="mr-auto max-w-[85%] space-y-2 message-enter">
            <p className="text-[15px] leading-relaxed text-[var(--t-navy)]">
              Before we move on — you mentioned {anchorsForReview.length === 1 ? 'a place' : 'a few places'}. Just want to make sure I caught {anchorsForReview.length === 1 ? 'it' : 'them'} right.
            </p>
            {anchorsForReview.map((anchor) => (
              <AnchorVerificationCard
                key={anchor.googlePlaceId}
                anchor={anchor}
                onConfirm={() => confirmAnchor(anchor.googlePlaceId)}
                onDismiss={() => dismissAnchor(anchor.googlePlaceId)}
                onClarify={(name) => reResolvePlace(name, anchor.sentiment)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Input Area — anchored to bottom */}
      <div className="flex-shrink-0 border-t border-[var(--t-peach)] px-4 py-3 bg-[var(--t-cream)] max-w-2xl mx-auto w-full">
        {isPhaseComplete ? (
          <button
            onClick={() => {
              if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
              stopTTS();
              onComplete();
            }}
            className="w-full py-3 rounded-xl text-[14px] font-medium text-white transition-all
              hover:opacity-90 active:scale-[0.98] relative overflow-hidden"
            style={{ backgroundColor: 'var(--t-navy)' }}
          >
            {autoAdvancing ? (
              <>
                <span className="relative z-10">Continuing...</span>
                <div
                  className="absolute inset-0 bg-[var(--t-ochre)]/20 origin-left animate-[fillBar_2s_ease-out_forwards]"
                />
              </>
            ) : 'Continue'}
          </button>
        ) : voiceMode && speechSupported && !speechFailed ? (
          /* Voice mode — conversational state machine UI */
          <div className="flex flex-col items-center gap-3">
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
                    ? 'border-[var(--t-ochre)] text-[var(--t-ochre)]'
                    : 'border-[var(--t-peach)] text-[var(--t-navy)]/30'
                  }
                `}
                title={ttsEnabled ? 'Voice output on' : 'Voice output off'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  {ttsEnabled && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
                </svg>
              </button>

              {/* Main action button — context-dependent */}
              <button
                onClick={() => {
                  // Initialize VAD on first interaction
                  initVADOnGesture();

                  if (voiceState === 'speaking') {
                    handleTapInterrupt();
                  } else if (voiceState === 'listening') {
                    // Tap while listening = send now (override silence timer)
                    const text = latestTranscriptForSendRef.current.trim();
                    if (text) {
                      handleSendTranscript(text);
                    }
                  } else if (voiceState === 'idle') {
                    handleTapToSpeak();
                  }
                }}
                disabled={voiceState === 'thinking'}
                className={`
                  w-14 h-14 rounded-full flex items-center justify-center transition-all select-none
                  ${voiceState === 'listening'
                    ? 'bg-[var(--t-signal-red)] text-white scale-110'
                    : voiceState === 'speaking'
                      ? 'bg-[var(--t-ochre)] text-white'
                      : voiceState === 'thinking'
                        ? 'bg-[var(--t-peach)] text-[var(--t-navy)]/40'
                        : 'bg-[var(--t-navy)] text-[var(--t-cream)] hover:scale-105 active:scale-110'
                  }
                `}
              >
                {voiceState === 'speaking' ? (
                  /* Waveform icon — tap to interrupt */
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
                ) : voiceState === 'listening' ? (
                  /* Active mic icon — pulsing to show recording */
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                ) : (
                  /* Mic icon — idle */
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
                  border border-[var(--t-peach)] text-[var(--t-navy)]/30 hover:text-[var(--t-navy)]/60"
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
            <p className="text-[12px] font-mono text-[var(--t-navy)]">
              {voiceState === 'listening' && (transcript ? 'Listening... tap to send' : 'Listening...')}
              {voiceState === 'speaking' && 'Tap to interrupt'}
              {voiceState === 'thinking' && 'Thinking...'}
              {voiceState === 'idle' && 'Tap to speak'}
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
                  transition-all border border-[var(--t-peach)] text-[var(--t-navy)]/40
                  hover:border-[var(--t-ochre)] hover:text-[var(--t-ochre)]"
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
                text-[var(--t-navy)] placeholder:text-[var(--t-navy)]/30
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
              style={{ backgroundColor: 'var(--t-navy)', color: 'var(--t-cream)' }}
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
