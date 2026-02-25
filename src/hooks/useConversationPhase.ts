'use client';

import { useState, useCallback, useRef } from 'react';
import type { AnalysisResult, ConversationMessage, TasteSignal, TasteContradiction } from '@/types';
import { useOnboardingStore } from '@/stores/onboardingStore';

interface UseConversationPhaseOptions {
  phaseId: string;
  aiPrompt: string;
  followUps: string[];
}

interface UseConversationPhaseReturn {
  messages: ConversationMessage[];
  isAnalyzing: boolean;
  isPhaseComplete: boolean;
  sendMessage: (text: string) => Promise<void>;
  currentFollowUpIndex: number;
}

export function useConversationPhase({
  phaseId,
  aiPrompt,
  followUps,
}: UseConversationPhaseOptions): UseConversationPhaseReturn {
  const {
    certainties,
    updateCertainties,
    addSignals,
    addMessages,
    addContradictions,
    setLifeContext,
    addTrustedSource,
    setGoBackPlace,
    setCurrentPhaseProgress,
    allMessages: storedMessages,
    completedPhaseIds,
    allSignals,
    lifeContext,
    goBackPlace,
    trustedSources,
  } = useOnboardingStore();

  // Restore previous messages for this phase from persisted store (for resume)
  const previousMessages = storedMessages.filter((m) => m.phaseId === phaseId);
  const hasPreviousMessages = previousMessages.length > 0;
  const wasAlreadyCompleted = completedPhaseIds.includes(phaseId);

  const [messages, setMessages] = useState<ConversationMessage[]>(() =>
    hasPreviousMessages
      ? previousMessages
      : [{ role: 'ai', text: aiPrompt, phaseId }]
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPhaseComplete, setIsPhaseComplete] = useState(wasAlreadyCompleted);
  const followUpIndex = useRef(0);

  const sendMessage = useCallback(async (text: string) => {
    if (isAnalyzing || isPhaseComplete) return;

    const userMsg: ConversationMessage = { role: 'user', text, phaseId };
    setMessages((prev) => [...prev, userMsg]);
    setIsAnalyzing(true);

    try {
      // Count user messages (excluding AI opening) to enforce minimum exchanges
      const allMessages = [...messages, userMsg];
      const userMessageCount = allMessages.filter((m) => m.role === 'user').length;

      // Build condensed cross-phase context so Claude knows what the user has already shared
      // Include summaries of user messages from prior phases so Claude remembers specific
      // hotels, places, and details the user mentioned (not just abstract taste signals)
      const priorPhaseMessages = storedMessages.filter((m) => m.phaseId !== phaseId && m.role === 'user');
      const priorUserSummaries = priorPhaseMessages.length > 0
        ? priorPhaseMessages.slice(-15).map((m) => m.text) // last 15 user messages from prior phases
        : undefined;
      // Also include AI questions from prior phases so Claude knows what was already asked
      const priorAiMessages = storedMessages.filter((m) => m.phaseId !== phaseId && m.role === 'ai');
      const priorAiQuestions = priorAiMessages.length > 0
        ? priorAiMessages.filter((m) => m.text.includes('?')).slice(-10).map((m) => m.text)
        : undefined;

      const crossPhaseContext = {
        completedPhases: completedPhaseIds,
        lifeContext: Object.keys(lifeContext).length > 1 ? lifeContext : undefined, // skip if only default
        keySignals: allSignals.length > 0
          ? allSignals
              .filter((s) => s.confidence >= 0.8)
              .slice(-20) // most recent high-confidence signals
              .map((s) => `${s.tag} (${s.cat})`)
          : undefined,
        trustedSources: trustedSources.length > 0 ? trustedSources.map((s) => s.name) : undefined,
        goBackPlace: goBackPlace?.placeName || undefined,
        priorUserMessages: priorUserSummaries,
        priorAiQuestions,
      };

      const res = await fetch('/api/onboarding/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userText: text,
          conversationHistory: allMessages,
          phaseId,
          certainties,
          userMessageCount,
          crossPhaseContext,
        }),
      });

      if (!res.ok) throw new Error('Analysis failed');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: AnalysisResult & { lifeContext?: Record<string, any>; trustedSource?: any; trustedSources?: any[]; goBackPlace?: any; contextModifiers?: any[]; partnerTravelDynamic?: string; soloTravelIdentity?: string; emotionalDriverPrimary?: string; emotionalDriverSecondary?: string; correctedTranscript?: string; userRequestedSkip?: boolean } = await res.json();

      // If Claude corrected garbled speech-to-text (e.g. "I'm on Geary" → "Amangiri"),
      // update the user's message bubble to show the corrected version
      if (result.correctedTranscript) {
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1 && m.role === 'user'
              ? { ...m, text: result.correctedTranscript! }
              : m
          )
        );
        // Also update the userMsg reference for store persistence
        userMsg.text = result.correctedTranscript;
      }

      // Update store — core taste data
      if (result.signals?.length) addSignals(result.signals);
      if (result.certainties) updateCertainties(result.certainties);
      if (result.contradictions?.length) addContradictions(result.contradictions);
      if (result.lifeContext && Object.keys(result.lifeContext).length > 0) {
        setLifeContext(result.lifeContext);
      }

      // Phase-specific structured data extraction

      // Phase 5: Trusted Sources
      if (result.trustedSources?.length) {
        result.trustedSources.forEach((s: { type?: string; name?: string; context?: string; relationship?: string }) => {
          if (s.name) addTrustedSource({ type: (s.type as 'friend' | 'publication' | 'instagram' | 'newsletter') || 'friend', name: s.name, context: s.context, relationship: s.relationship });
        });
      } else if (result.trustedSource?.name) {
        addTrustedSource({ type: result.trustedSource.type || 'friend', name: result.trustedSource.name, context: result.trustedSource.context, relationship: result.trustedSource.relationship });
      }

      // Phase 6: Go-Back Place
      if (result.goBackPlace?.placeName) {
        setGoBackPlace({
          placeName: result.goBackPlace.placeName,
          location: result.goBackPlace.location,
          reason: result.goBackPlace.reason,
          matchScore: undefined,
          calibrationStatus: 'confirmed',
        });
      }

      // Phase 3: Context modifiers — store as life context extensions
      if (result.contextModifiers?.length || result.partnerTravelDynamic || result.soloTravelIdentity) {
        const contextUpdate: Record<string, unknown> = {};
        if (result.partnerTravelDynamic) contextUpdate.partnerTravelDynamic = result.partnerTravelDynamic;
        if (result.soloTravelIdentity) contextUpdate.soloTravelIdentity = result.soloTravelIdentity;
        if (result.contextModifiers?.length) contextUpdate.contextModifiers = result.contextModifiers;
        if (Object.keys(contextUpdate).length > 0) setLifeContext(contextUpdate);
      }

      // Phase 10: Emotional drivers — store as life context
      if (result.emotionalDriverPrimary) {
        setLifeContext({ emotionalDriverPrimary: result.emotionalDriverPrimary, emotionalDriverSecondary: result.emotionalDriverSecondary || null });
      }

      // Exchange guards:
      // Floor: don't let Claude end too early (< 3 user messages) unless user asked to skip
      // Ceiling: force phase complete if user has sent 6+ messages — prevent over-interrogation
      const MIN_EXCHANGES = 3;
      const MAX_EXCHANGES = 6;
      if (result.phaseComplete && userMessageCount < MIN_EXCHANGES && !result.userRequestedSkip) {
        result.phaseComplete = false;
      }
      if (!result.phaseComplete && userMessageCount >= MAX_EXCHANGES) {
        result.phaseComplete = true;
      }

      // Update progress bar — progressive fill based on exchange count relative to expected max
      // Use the number of scripted follow-ups + 1 (for the opening) as the expected conversation length
      const expectedExchanges = Math.max(followUps.length + 1, MIN_EXCHANGES);
      const progress = result.phaseComplete ? 1 : Math.min(0.95, userMessageCount / expectedExchanges);
      setCurrentPhaseProgress(progress);

      // Determine next AI message
      let nextText: string;
      if (result.phaseComplete) {
        setIsPhaseComplete(true);
        // The transition message should NEVER contain a question — the next phase's
        // opening prompt will serve as the first question. If Claude included a question
        // (e.g. forced-complete via MAX_EXCHANGES, or Claude ignored the prompt rule),
        // strip the question sentence(s) to avoid showing a question + Continue button.
        let transitionText = result.followUp || "That's really wonderful — I feel like I'm getting to know you. Let me take all of that in and we'll keep going.";
        // Split into sentences, drop any that end with '?'
        const sentences = transitionText.match(/[^.!?]+[.!?]+/g) || [transitionText];
        const nonQuestions = sentences.filter(s => !s.trim().endsWith('?'));
        if (nonQuestions.length > 0) {
          transitionText = nonQuestions.join('').trim();
        } else {
          // Entire message was questions — replace with a warm generic wrap
          transitionText = "That's really helpful — I'm picking up a lot from what you've shared.";
        }
        nextText = transitionText;
      } else if (result.followUp) {
        nextText = result.followUp;
      } else if (followUpIndex.current < followUps.length) {
        nextText = followUps[followUpIndex.current];
        followUpIndex.current += 1;
      } else {
        // All scripted follow-ups exhausted — gracefully wrap up
        nextText = "This has been really revealing — I've picked up a lot from what you've shared. Let's keep the momentum going.";
        setIsPhaseComplete(true);
      }

      const aiMsg: ConversationMessage = { role: 'ai', text: nextText, phaseId };
      setMessages((prev) => [...prev, aiMsg]);

      // Persist messages to store
      addMessages([userMsg, aiMsg]);
    } catch {
      // Fallback: use predefined follow-ups
      let fallbackText: string;
      if (followUpIndex.current < followUps.length) {
        fallbackText = followUps[followUpIndex.current];
        followUpIndex.current += 1;
      } else {
        fallbackText = "I think I've got what I need here — let's keep going.";
      }

      const aiMsg: ConversationMessage = { role: 'ai', text: fallbackText, phaseId };
      setMessages((prev) => [...prev, aiMsg]);
      addMessages([userMsg, aiMsg]);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, isPhaseComplete, messages, phaseId, certainties, followUps, addSignals, updateCertainties, addContradictions, addMessages, setLifeContext, addTrustedSource, setGoBackPlace, setCurrentPhaseProgress, completedPhaseIds, allSignals, lifeContext, trustedSources, goBackPlace]);

  return {
    messages,
    isAnalyzing,
    isPhaseComplete,
    sendMessage,
    currentFollowUpIndex: followUpIndex.current,
  };
}
