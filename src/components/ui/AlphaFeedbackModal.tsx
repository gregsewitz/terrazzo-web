'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FONT, TEXT, COLOR } from '@/constants/theme';
import { PerriandIcon } from '@/components/icons/PerriandIcons';

interface AlphaFeedbackModalProps {
  title: string;
  question: string;
  placeholder: string;
  onSubmit: (rating: number, text: string) => void;
  onDismiss: () => void;
}

export default function AlphaFeedbackModal({
  title,
  question,
  placeholder,
  onSubmit,
  onDismiss,
}: AlphaFeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
        style={{ background: 'rgba(0,42,85,0.3)', backdropFilter: 'blur(4px)' }}
        onClick={onDismiss}
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden"
          style={{ background: 'var(--t-cream)', border: '1px solid var(--t-linen)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <div>
              <span style={{ fontFamily: FONT.mono, fontSize: 9, color: COLOR.coral, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                Alpha Feedback
              </span>
              <h3 style={{ fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 20, color: TEXT.primary, margin: '4px 0 0' }}>
                {title}
              </h3>
            </div>
            <button onClick={onDismiss} className="bg-transparent border-none cursor-pointer p-2" aria-label="Dismiss">
              <PerriandIcon name="close" size={16} color={TEXT.secondary} />
            </button>
          </div>

          <div className="px-5 pb-6">
            <p style={{ fontFamily: FONT.sans, fontSize: 14, color: TEXT.primary, lineHeight: 1.5, margin: '0 0 16px' }}>
              {question}
            </p>

            {/* Rating */}
            <div className="flex items-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  className="w-10 h-10 rounded-lg border-none cursor-pointer transition-all flex items-center justify-center"
                  style={{
                    background: rating >= n ? 'var(--t-dark-teal)' : 'rgba(0,42,85,0.04)',
                    color: rating >= n ? 'white' : TEXT.secondary,
                    fontFamily: FONT.mono,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {n}
                </button>
              ))}
              <span style={{ fontFamily: FONT.mono, fontSize: 10, color: TEXT.secondary, marginLeft: 8 }}>
                {rating === 0 ? '' : rating <= 2 ? 'Needs work' : rating <= 4 ? 'Pretty good' : 'Love it'}
              </span>
            </div>

            {/* Text input */}
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={placeholder}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border-none resize-none text-[14px] transition-all focus:outline-none"
              style={{
                background: 'rgba(0,42,85,0.03)',
                border: '1px solid var(--t-linen)',
                fontFamily: FONT.sans,
                color: TEXT.primary,
                lineHeight: 1.5,
              }}
            />

            {/* Submit */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={onDismiss}
                className="flex-1 py-3 rounded-xl border-none cursor-pointer transition-all hover:opacity-80"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--t-linen)',
                  fontFamily: FONT.sans,
                  fontSize: 14,
                  fontWeight: 500,
                  color: TEXT.secondary,
                }}
              >
                Skip
              </button>
              <button
                onClick={() => onSubmit(rating, text)}
                disabled={rating === 0}
                className="flex-1 py-3 rounded-xl border-none cursor-pointer transition-all hover:opacity-90 disabled:opacity-40"
                style={{
                  background: 'var(--t-navy)',
                  fontFamily: FONT.sans,
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                Send feedback
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
