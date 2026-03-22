'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { FONT, TEXT } from '@/constants/theme';
import { PerriandIcon, type PerriandIconName } from '@/components/icons/PerriandIcons';

interface FirstActionCardProps {
  isVisible: boolean;
  onDismiss: () => void;
  icon?: PerriandIconName;
  message: string;
  /** Optional secondary line of text */
  hint?: string;
}

export default function FirstActionCard({ isVisible, onDismiss, icon, message, hint }: FirstActionCardProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <div
            className="flex items-start gap-3 p-4 rounded-xl mb-4"
            style={{
              background: 'linear-gradient(135deg, rgba(58,128,136,0.05) 0%, rgba(238,113,109,0.05) 100%)',
              border: '1px solid var(--t-linen)',
            }}
          >
            {icon && (
              <div className="flex-shrink-0 mt-0.5">
                <PerriandIcon name={icon} size={16} color="var(--t-dark-teal)" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p style={{ fontFamily: FONT.sans, fontSize: 13, color: TEXT.primary, lineHeight: 1.5, margin: 0 }}>
                {message}
              </p>
              {hint && (
                <p style={{ fontFamily: FONT.mono, fontSize: 10, color: TEXT.secondary, margin: '4px 0 0', lineHeight: 1.4 }}>
                  {hint}
                </p>
              )}
            </div>
            <button
              onClick={onDismiss}
              className="flex-shrink-0 bg-transparent border-none cursor-pointer p-1 rounded-full transition-all hover:opacity-60"
              style={{ color: TEXT.secondary }}
              aria-label="Dismiss"
            >
              <PerriandIcon name="close" size={14} color={TEXT.secondary} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
