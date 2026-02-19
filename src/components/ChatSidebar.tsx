'use client';

import React, { useState, useRef, useEffect } from 'react';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { TASTE_PROFILE } from '@/constants/profile';
import { FONT, INK } from '@/constants/theme';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isFirstMessage?: boolean;
}

export interface ChatTripContext {
  name: string;
  destinations: string[];
  totalDays: number;
  currentDay?: {
    dayNumber: number;
    destination?: string;
    slots: { label: string; place?: { name: string; type?: string; matchScore?: number } }[];
    hotel?: string;
  };
}

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  tripContext?: ChatTripContext;
}

// Render message content with smart formatting
function renderMessageContent(content: string) {
  const parts: (string | React.ReactElement)[] = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    // Add the bold place name with honey color
    parts.push(
      <span key={`bold-${match.index}`} style={{ color: 'var(--t-honey)', fontWeight: 600 }}>
        {match[1]}
        <span className="text-[9px] ml-1" style={{ color: INK['90'] }}>
          →
        </span>
      </span>
    );

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return parts;
}

export default function ChatSidebar({ isOpen, onClose, tripContext }: ChatSidebarProps) {
  const generatedProfile = useOnboardingStore(s => s.generatedProfile);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hey! I'm your trip companion. I know your taste profile inside out — ask me to rearrange your day, find somewhere for a late-night drink, or tell you why that restaurant your friend recommended is actually perfect for you.",
      isFirstMessage: true,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const quickActions = [
    'Rearrange my day',
    'Find a late-night spot',
    'What should I skip?',
    'Suggest something like...',
  ];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  async function handleSend() {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    const currentInput = input;
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/trips/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: currentInput,
          conversationHistory: [...messages, userMsg].map(m => ({
            role: m.role,
            content: m.content,
          })),
          tripContext: tripContext || null,
          userProfile: generatedProfile || TASTE_PROFILE,
        }),
      });

      const data = await res.json();
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response || "Let me think about that — could you rephrase?",
        },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "Having trouble connecting right now — try again in a moment.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleQuickAction(action: string) {
    setInput(action);
  }

  return (
    <div
      className="fixed inset-0 flex items-end justify-center z-55 transition-all duration-300 pointer-events-none"
      style={{
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
      onClick={onClose}
    >
      {/* Overlay backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}
      />

      {/* Slide-up sheet */}
      <div
        className="relative w-full max-w-md rounded-t-2xl flex flex-col transition-transform duration-300"
        style={{
          background: 'var(--t-cream)',
          maxHeight: '85vh',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Frosted glass header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{
            borderColor: 'var(--t-linen)',
            backdropFilter: 'blur(16px)',
            background: 'rgba(248,243,234,0.8)',
          }}
        >
          <div>
            <h3
              className="text-sm font-semibold"
              style={{ fontFamily: FONT.serif, color: 'var(--t-ink)' }}
            >
              Terrazzo Assistant
            </h3>
            <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--t-amber)', fontFamily: FONT.mono }}>
              Your taste-aware trip companion
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full border-none cursor-pointer"
            style={{ background: INK['06'] }}
          >
            <PerriandIcon name="close" size={16} color="var(--t-ink)" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          {messages.map((msg, idx) => (
            <div
              key={msg.id}
              className={`max-w-[85%] p-3 rounded-xl text-[12px] leading-relaxed ${
                msg.role === 'user' ? 'self-end' : 'self-start'
              }`}
              style={{
                background: msg.role === 'user' ? 'var(--t-ink)' : INK['04'],
                color: msg.role === 'user' ? 'var(--t-cream)' : 'var(--t-ink)',
              }}
            >
              {msg.role === 'assistant' && idx === 0 && (
                <span style={{ color: 'var(--t-honey)', marginRight: '4px' }}>✦</span>
              )}
              {renderMessageContent(msg.content)}
            </div>
          ))}
          {isLoading && (
            <div className="self-start p-3 rounded-xl text-[12px]" style={{ background: INK['04'] }}>
              <span className="inline-block">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>•</span>
                <span className="animate-bounce ml-1" style={{ animationDelay: '150ms' }}>•</span>
                <span className="animate-bounce ml-1" style={{ animationDelay: '300ms' }}>•</span>
              </span>
            </div>
          )}
        </div>

        {/* Quick action chips */}
        <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--t-linen)' }}>
          <div className="flex flex-wrap gap-2">
            {quickActions.map(action => (
              <button
                key={action}
                onClick={() => handleQuickAction(action)}
                className="px-3 py-1.5 rounded-full text-[11px] font-medium border-none cursor-pointer transition-all hover:scale-105"
                style={{
                  background: 'white',
                  color: 'var(--t-ink)',
                  border: '1px solid var(--t-linen)',
                  fontFamily: FONT.sans,
                }}
              >
                {action}
              </button>
            ))}
          </div>
        </div>

        {/* Input area */}
        <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--t-linen)' }}>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="What sounds good?"
              className="flex-1 px-3 py-2 rounded-full text-[12px] border outline-none"
              style={{
                background: 'var(--t-cream)',
                borderColor: 'var(--t-linen)',
                color: 'var(--t-ink)',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="w-8 h-8 rounded-full border-none cursor-pointer flex items-center justify-center text-sm transition-opacity"
              style={{
                background: 'var(--t-panton-orange)',
                color: 'white',
                opacity: !input.trim() || isLoading ? 0.5 : 1,
              }}
            >
              ↑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
