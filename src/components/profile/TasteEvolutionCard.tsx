'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { FONT, TEXT, COLOR } from '@/constants/theme';
import { PerriandIcon } from '@/components/icons/PerriandIcons';

interface TasteEvolutionCardProps {
  type: 'evolution' | 'expand';
  newSignalCount?: number;
  onDismiss: () => void;
  /** For expand type: called when user wants to expand mosaic */
  onExpand?: () => void;
}

export default function TasteEvolutionCard({ type, newSignalCount, onDismiss, onExpand }: TasteEvolutionCardProps) {
  const isEvolution = type === 'evolution';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl overflow-hidden mb-4"
      style={{
        background: isEvolution
          ? 'linear-gradient(135deg, rgba(58,128,136,0.08) 0%, rgba(58,128,136,0.03) 100%)'
          : 'linear-gradient(135deg, rgba(238,113,109,0.08) 0%, rgba(238,113,109,0.03) 100%)',
        border: `1px solid ${isEvolution ? 'rgba(58,128,136,0.15)' : 'rgba(238,113,109,0.15)'}`,
      }}
    >
      <div className="flex items-start gap-3 p-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: isEvolution ? 'rgba(58,128,136,0.10)' : 'rgba(238,113,109,0.10)',
          }}
        >
          <PerriandIcon
            name={isEvolution ? 'sparkle' : 'lightbulb'}
            size={20}
            color={isEvolution ? 'var(--t-dark-teal)' : COLOR.coral}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 style={{ fontFamily: FONT.sans, fontSize: 14, fontWeight: 600, color: TEXT.primary, margin: '0 0 4px' }}>
            {isEvolution ? 'Your taste is evolving' : 'Sharpen your matches'}
          </h4>
          <p style={{ fontFamily: FONT.sans, fontSize: 13, color: TEXT.secondary, lineHeight: 1.5, margin: 0 }}>
            {isEvolution
              ? `We've picked up ${newSignalCount || 'new'} new taste signals from your recent saves. Your recommendations will keep getting sharper.`
              : 'A few quick questions could unlock even better matches. Takes about 2 minutes.'}
          </p>
          {type === 'expand' && onExpand && (
            <button
              onClick={onExpand}
              className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-lg border-none cursor-pointer transition-all hover:opacity-90"
              style={{
                background: COLOR.coral,
                color: 'white',
                fontFamily: FONT.sans,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Expand Your Mosaic
              <PerriandIcon name="add" size={12} color="white" />
            </button>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 bg-transparent border-none cursor-pointer p-1"
          aria-label="Dismiss"
        >
          <PerriandIcon name="close" size={14} color={TEXT.secondary} />
        </button>
      </div>
    </motion.div>
  );
}
