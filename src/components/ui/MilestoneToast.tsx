'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FONT } from '@/constants/theme';

interface ToastMessage {
  id: number;
  message: string;
}

/**
 * Toast manager for milestone celebrations.
 * Returns [showToast, ToastContainer].
 */
export function useMilestoneToastUI(): [
  (message: string) => void,
  React.FC,
] {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const idCounter = useRef(0);

  const showToast = useCallback((message: string) => {
    const id = ++idCounter.current;
    setToasts(prev => [...prev, { id, message }]);

    // Auto-dismiss after 3.5s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const ToastContainer = useCallback(() => (
    <div
      className="fixed bottom-20 left-0 right-0 z-[100] flex flex-col items-center gap-2 pointer-events-none"
      style={{ maxWidth: 480, margin: '0 auto' }}
    >
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="px-5 py-3 rounded-xl pointer-events-auto"
            style={{
              background: 'var(--t-navy)',
              boxShadow: '0 4px 20px rgba(0,42,85,0.2)',
            }}
          >
            <span style={{
              fontFamily: FONT.sans,
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--t-cream)',
              letterSpacing: 0.1,
            }}>
              {toast.message}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  ), [toasts]);

  return [showToast, ToastContainer];
}
