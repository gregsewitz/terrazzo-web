'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImportedPlace } from '@/types';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import PlaceDetailContent from '@/components/PlaceDetailContent';

interface PlaceDetailSheetProps {
  item: ImportedPlace;
  onClose: () => void;
  onRate?: () => void;
  onSave?: () => void;
  onEditRating?: () => void;
  onViewBriefing?: () => void;
  onCollectionTap?: () => void;
  isPreview?: boolean;
  siblingPlaces?: ImportedPlace[];
}

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function PlaceDetailSheet(props: PlaceDetailSheetProps) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <>
        <motion.div
          className="fixed inset-0 z-50"
          style={{ background: 'rgba(0,0,0,0.25)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={props.onClose}
        />
        <motion.div
          className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
          style={{
            width: 440,
            background: 'var(--t-cream)',
            boxShadow: '-8px 0 32px rgba(0,0,0,0.08)',
          }}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring' as const, stiffness: 300, damping: 30 }}
        >
          <PlaceDetailContent {...props} variant="desktop" />
        </motion.div>
      </>
    );
  }

  return (
    <>
      <motion.div
        className="fixed inset-0 z-50 bg-black/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={props.onClose}
      />
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 overflow-y-auto rounded-t-2xl"
        style={{
          maxWidth: 560,
          margin: '0 auto',
          maxHeight: '90dvh',
          background: 'var(--t-cream)',
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring' as const, stiffness: 300, damping: 30 }}
      >
        <PlaceDetailContent {...props} variant="mobile" />
      </motion.div>
    </>
  );
}
