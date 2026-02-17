'use client';

import React, { useState } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isFirstMessage?: boolean;
}

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

// Smart response generator based on user input
function getSmartResponse(userInput: string): string {
  const lowerInput = userInput.toLowerCase();

  if (lowerInput.includes('rearrange')) {
    return "Looking at your Day 1... I'd swap Tsukiji Market to breakfast (it's best before 9am) and move TeamLab to late afternoon when the light installations hit different. Want me to make that switch?";
  }

  if (lowerInput.includes('late') || lowerInput.includes('night') || lowerInput.includes('drink')) {
    return "For late-night in Shinjuku, there's Golden Gai — tiny bars stacked five stories. Your Character axis would light up. Or if you want something quieter, try Bar Benfiddich in Nishi-Shinjuku. The bartender forages his own ingredients.";
  }

  if (lowerInput.includes('skip')) {
    return "Honestly? I'd skip the Meiji Shrine on a Tuesday — it's packed with tour groups. Your afternoon is better spent in Shimokitazawa, which matches your Design and Character signals much higher.";
  }

  if (lowerInput.includes('suggest') || lowerInput.includes('like')) {
    return "Based on your taste profile... if you loved Narisawa's forest-to-table approach, try Florilège in Aoyama. Same philosophy, slightly more experimental. Your Food and Design axes both peak there. 94% match.";
  }

  return "I'm still getting connected to the full Terrazzo intelligence engine, but I'm already thinking about your trip. Try dragging places from the unsorted tray into your day slots, or tap any ghost card to see why it landed there.";
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
        <span className="text-[9px] ml-1" style={{ color: 'rgba(28,26,23,0.4)' }}>
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

export default function ChatSidebar({ isOpen, onClose }: ChatSidebarProps) {
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

  async function handleSend() {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Simulate API delay
    setTimeout(() => {
      const aiResponse = getSmartResponse(input);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: aiResponse,
        },
      ]);
      setIsLoading(false);
    }, 1000);
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
              style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}
            >
              Terrazzo Assistant
            </h3>
            <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--t-amber)', fontFamily: "'Space Mono', monospace" }}>
              Your taste-aware trip companion
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full border-none cursor-pointer"
            style={{ background: 'rgba(28,26,23,0.06)', color: 'var(--t-ink)' }}
          >
            ×
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          {messages.map((msg, idx) => (
            <div
              key={msg.id}
              className={`max-w-[85%] p-3 rounded-xl text-[12px] leading-relaxed ${
                msg.role === 'user' ? 'self-end' : 'self-start'
              }`}
              style={{
                background: msg.role === 'user' ? 'var(--t-ink)' : 'rgba(28,26,23,0.04)',
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
            <div className="self-start p-3 rounded-xl text-[12px]" style={{ background: 'rgba(28,26,23,0.04)' }}>
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
                  fontFamily: "'DM Sans', sans-serif",
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
