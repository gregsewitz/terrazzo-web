'use client';

import { useState } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatSidebar({ isOpen, onClose }: ChatSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "I'm your Terrazzo assistant. I can help arrange your itinerary, suggest places based on your taste profile, or answer questions about your trip. What would you like to do?",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSend() {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // TODO: Wire to real API
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "I'll help you with that! This feature will be connected to the Terrazzo intelligence engine soon. For now, try importing places using the Import button or browsing your available pool.",
        },
      ]);
      setIsLoading(false);
    }, 1000);
  }

  return (
    <div
      className="fixed top-0 right-0 bottom-0 z-50 flex flex-col transition-transform duration-300"
      style={{
        width: 320,
        maxWidth: '85vw',
        background: 'var(--t-cream)',
        borderLeft: '1px solid var(--t-linen)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--t-linen)' }}>
        <div>
          <h3
            className="text-sm font-semibold"
            style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}
          >
            Terrazzo Assistant
          </h3>
          <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--t-amber)', fontFamily: "'Space Mono', monospace" }}>
            Ask anything about your trip
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
        {messages.map(msg => (
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
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div className="self-start p-3 rounded-xl text-[12px]" style={{ background: 'rgba(28,26,23,0.04)' }}>
            <span className="animate-pulse">Thinking...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--t-linen)' }}>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask Terrazzo..."
            className="flex-1 px-3 py-2 rounded-full text-[12px] border-none outline-none"
            style={{ background: 'rgba(28,26,23,0.04)', color: 'var(--t-ink)' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 rounded-full border-none cursor-pointer flex items-center justify-center text-sm"
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
  );
}
