'use client';

import React from 'react';
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
  siblingPlaces?: ImportedPlace[]; // other places from the same import batch
}

export default function PlaceDetailSheet(props: PlaceDetailSheetProps) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <>
        <div
          className="fixed inset-0 z-50 fade-in-backdrop"
          style={{ background: 'rgba(0,0,0,0.25)' }}
          onClick={props.onClose}
        />
        <div
          className="fixed top-0 right-0 bottom-0 z-50 slide-in-right flex flex-col"
          style={{
            width: 440,
            background: 'var(--t-cream)',
            boxShadow: '-8px 0 32px rgba(0,0,0,0.08)',
          }}
        >
          <PlaceDetailContent {...props} variant="desktop" />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={props.onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 overflow-y-auto rounded-t-2xl"
        style={{
          maxWidth: 560,
          margin: '0 auto',
          maxHeight: '90dvh',
          background: 'var(--t-cream)',
        }}
      >
        <PlaceDetailContent {...props} variant="mobile" />
      </div>
    </>
  );
}
