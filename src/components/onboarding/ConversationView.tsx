'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useConversationPhase } from '@/hooks/useConversationPhase';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTTS } from '@/hooks/useTTS';
import AnchorVerificationCard from './AnchorVerificationCard';
import type { OnboardingPhase } from '@/types';

interface ConversationViewProps {
  phase: OnboardingPhase;
  onComplete: () => void;
}

export default function ConversationView({ phase, onComplete }: ConversationViewProps) {
  const [inputText, setInputText] = useState('');
  const [voiceMode, setVoiceMode] = useState(true); // voice-first by default
  const [autoAdvancing, setAutoAdvancing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const spokenCountRef = useRef(0);
  const sendingRef = useRef(false);
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdingRef = useRef(false); // tracks whether user is actively holding the mic button
  const mountedRef = useRef(true); // tracks if component is still mounted
  const isSpeakingRef = useRef(false); // mirrors isSpeaking for async callbacks
  const streamHandledRef = useRef(false); // true when streaming pipeline is handling TTS for current response

  // Refs for TTS queue integration (set after useTTS initializes)
  const queueSentenceRef = useRef<((s: string) => void) | null>(null);
  const finishQueueRef = useRef<(() => void) | null>(null);
  const ttsEnabledRef = useRef(true);

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
        // (e.g., "phaseComplete", "userRequestedSkip", "correctedTranscript")
        if (/^\s*"?(phaseComplete|userRequestedSkip|correctedTranscript|followUp)\s*"?\s*:/i.test(sentence)) return;
        if (/^\s*\{?\s*"/.test(sentence) && /[{}]/.test(sentence)) return; // looks like raw JSON
        if (/^(true|false|\d+)\s*[,}]?\s*$/.test(sentence.trim())) return; // bare JSON values
        streamHandledRef.current = true; // streaming pipeline is handling this response
        queueSentenceRef.current(sentence);
      }
    },
    onResponseComplete: () => {
      if (ttsEnabledRef.current && finishQueueRef.current) {
        finishQueueRef.current();
      }
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
      // Safety check: don't advance while TTS is still speaking.
      // If still speaking, poll every 500ms until it finishes.
      if (isSpeakingRef.current) {
        autoAdvanceTimerRef.current = setTimeout(check, 500);
        return;
      }
      autoAdvanceTimerRef.current = null;
      onComplete();
    }, 1800);
  }, [onComplete]);

  // Clean up on unmount — stop TTS, cancel timers
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    };
  }, []);

  // After TTS finishes speaking: auto-advance if phase is done (and no anchors to review),
  // otherwise just idle (hold-to-speak)
  const handleTTSDone = useCallback(() => {
    if (isPhaseComplete && anchorsForReview.length === 0) {
      triggerAutoAdvance();
      return;
    }
    // If anchors are present, skip auto-advance — let user interact with cards
    // In hold-to-speak mode, we do NOT auto-start the mic. User initiates.
  }, [isPhaseComplete, anchorsForReview.length, triggerAutoAdvance]);

  // Handle sending speech transcript (called when user releases hold-to-speak, or silence detection fires)
  const handleSendTranscript = useCallback(async (text: string) => {
    if (sendingRef.current || isAnalyzing || isPhaseComplete) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    sendingRef.current = true;
    setInputText('');
    streamHandledRef.current = false; // reset — new response hasn't been handled yet
    resetTranscriptRef.current?.();
    stopListeningRef.current?.();
    stopTTSRef.current?.();
    await sendMessage(trimmed);
    if (mountedRef.current) sendingRef.current = false;
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
    // In hold-to-speak mode, we use a longer silence timeout as a safety net
    // (user should release button, but if they hold and go silent, auto-send after 2s)
    silenceTimeout: voiceMode ? 2000 : 0,
    onSilenceDetected: handleSendTranscript,
  });

  // Store refs for callbacks (avoid stale closures)
  const startListeningRef = useRef(startListening);
  startListeningRef.current = startListening;
  const stopListeningRef = useRef(stopListening);
  stopListeningRef.current = stopListening;
  const resetTranscriptRef = useRef(resetTranscript);
  resetTranscriptRef.current = resetTranscript;

  const { isSpeaking, speak, queueSentence, finishQueue, stop: stopTTS, enabled: ttsEnabled, setEnabled: setTTSEnabled } = useTTS({
    voice: 'nova',
    onDone: handleTTSDone,
  });

  // Wire up refs so the streaming onSentence callback can access TTS queue
  queueSentenceRef.current = queueSentence;
  finishQueueRef.current = finishQueue;
  ttsEnabledRef.current = ttsEnabled;

  const stopTTSRef = useRef(stopTTS);
  stopTTSRef.current = stopTTS;
  isSpeakingRef.current = isSpeaking;

  // Stop TTS on unmount (prevents audio bleeding into next phase)
  useEffect(() => {
    return () => {
      stopTTSRef.current?.();
    };
  }, []);

  // Speak new AI messages — for the opening prompt use batch speak(),
  // for streamed responses TTS is already handled via onSentence → queueSentence
  useEffect(() => {
    const newMessages = messages.slice(spokenCountRef.current);
    const latestAI = [...newMessages].reverse().find((m) => m.role === 'ai');
    const prevCount = spokenCountRef.current;
    spokenCountRef.current = messages.length;

    if (!latestAI) return;

    if (!ttsEnabled) {
      // TTS off — handle auto-advance via read-time estimate (only if no anchor cards)
      if (isPhaseComplete && anchorsForReview.length === 0) {
        const readTime = Math.max(2000, latestAI.text.split(/\s+/).length * 40);
        setTimeout(() => {
          if (mountedRef.current) triggerAutoAdvance();
        }, readTime);
      }
      return;
    }

    // Use batch speak() for the opening prompt AND for any message that wasn't
    // handled by the streaming pipeline (error fallbacks, scripted follow-ups).
    // The streaming pipeline handles messages via onSentence → queueSentence,
    // but if the stream fails, the message still needs to be spoken.
    const isOpeningPrompt = prevCount === 0 && messages.length === 1;
    if (isOpeningPrompt) {
      speak(latestAI.text);
    } else if (!streamHandledRef.current) {
      // Only use batch speak as fallback if the streaming pipeline did NOT handle this.
      // streamHandledRef is set to true by onSentence when the first streamed sentence
      // arrives. If it's still false here, the stream failed and we need the fallback.
      // Use a longer delay to give the streaming pipeline time to start.
      const fallbackTimer = setTimeout(() => {
        if (!streamHandledRef.current && !isSpeakingRef.current && mountedRef.current) {
          speak(latestAI.text);
        }
      }, 500);
      return () => clearTimeout(fallbackTimer);
    }
    // Note: isSpeaking intentionally NOT in deps — we use isSpeakingRef inside the timeout
    // to avoid re-running this effect every time speaking state changes (which caused loops).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, ttsEnabled, speak, isPhaseComplete, anchorsForReview.length, triggerAutoAdvance]);

  // Stop TTS when user starts talking (holds mic button)
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

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sendingRef.current) return;
    sendingRef.current = true;
    setInputText('');
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

  // --- Hold-to-speak handlers ---
  // On press down: start listening, interrupt TTS
  const handleMicDown = useCallback(() => {
    if (isAnalyzing || isPhaseComplete) return;
    holdingRef.current = true;
    setInputText('');
    resetTranscript();
    if (isSpeaking) stopTTS();
    startListening();
  }, [isAnalyzing, isPhaseComplete, isSpeaking, stopTTS, startListening, resetTranscript]);

  // On release: stop listening and send whatever was captured
  const handleMicUp = useCallback(() => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    stopListening();
    // Brief delay to let final recognition results arrive (reduced from 150ms)
    setTimeout(() => {
      const text = (latestTranscriptForSendRef.current || inputText).trim();
      if (text && !sendingRef.current) {
        handleSendTranscript(text);
      }
    }, 50);
  }, [stopListening, inputText, handleSendTranscript]);

  // We need a ref to get the latest transcript at send time
  const latestTranscriptForSendRef = useRef('');
  useEffect(() => {
    latestTranscriptForSendRef.current = transcript;
  }, [transcript]);

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

        {/* Live transcript preview while holding to speak */}
        {isListening && transcript && (
          <div className="ml-auto max-w-[85%]">
            <div
              className="rounded-2xl rounded-br-sm px-4 py-3 opacity-50"
              style={{ backgroundColor: 'var(--t-travertine)' }}
            >
              <p className="text-[15px] leading-relaxed text-[var(--t-ink)] italic">
                {transcript}
              </p>
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

        {/* End-of-phase anchor verification — batched */}
        {isPhaseComplete && anchorsForReview.length > 0 && (
          <div className="mr-auto max-w-[85%] space-y-2 message-enter">
            <p className="text-[15px] leading-relaxed text-[var(--t-ink)]">
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
      <div className="flex-shrink-0 border-t border-[var(--t-travertine)] px-4 py-3 bg-[var(--t-cream)] max-w-2xl mx-auto w-full">
        {isPhaseComplete ? (
          <button
            onClick={() => {
              if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
              stopTTS(); // Stop TTS immediately when user taps Continue
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
          /* Voice-first mode — hold-to-speak UI */
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

              {/* Main mic button — HOLD to speak (touch + mouse support) */}
              <button
                onTouchStart={(e) => { e.preventDefault(); handleMicDown(); }}
                onTouchEnd={(e) => { e.preventDefault(); handleMicUp(); }}
                onTouchCancel={() => handleMicUp()}
                onMouseDown={handleMicDown}
                onMouseUp={handleMicUp}
                onMouseLeave={() => { if (holdingRef.current) handleMicUp(); }}
                onContextMenu={(e) => e.preventDefault()} // prevent long-press context menu on mobile
                disabled={isAnalyzing}
                className={`
                  w-14 h-14 rounded-full flex items-center justify-center transition-all select-none touch-none
                  ${voiceState === 'listening'
                    ? 'bg-[var(--t-signal-red)] text-white scale-110'
                    : voiceState === 'speaking'
                      ? 'bg-[var(--t-honey)] text-white'
                      : voiceState === 'thinking'
                        ? 'bg-[var(--t-travertine)] text-[var(--t-ink)]/40'
                        : 'bg-[var(--t-ink)] text-[var(--t-cream)] hover:scale-105 active:scale-110'
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
            <p className="text-[12px] font-mono text-[var(--t-ink)]">
              {voiceState === 'listening' && 'Listening...'}
              {voiceState === 'speaking' && 'Speaking...'}
              {voiceState === 'thinking' && 'Thinking...'}
              {voiceState === 'idle' && (isAnalyzing ? 'Processing...' : 'Hold to speak')}
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
