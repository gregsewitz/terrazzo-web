'use client';

import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT } from '@/constants/theme';

interface BaseSheetProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Center the sheet on desktop (adds sm:items-center + sm:rounded-2xl) */
  centerOnDesktop?: boolean;
  zIndex?: number;
}

export default function BaseSheet({
  title,
  subtitle,
  onClose,
  children,
  centerOnDesktop = false,
  zIndex = 60,
}: BaseSheetProps) {
  return (
    <div
      className={`fixed inset-0 z-[${zIndex}] flex items-end ${centerOnDesktop ? 'sm:items-center' : ''} justify-center`}
      style={{ height: '100dvh' }}
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.3)' }} />
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full ${centerOnDesktop ? 'sm:w-[480px] sm:rounded-2xl' : ''} rounded-t-2xl flex flex-col`}
        style={{
          maxWidth: centerOnDesktop ? undefined : 480,
          maxHeight: '80dvh',
          background: 'var(--t-cream)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px))',
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <span
              style={{ fontFamily: FONT.serif, fontSize: 16, fontStyle: 'italic', color: TEXT.primary }}
            >
              {title}
            </span>
            {subtitle && (
              <div className="text-[11px] mt-0.5" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer"
            style={{ color: TEXT.secondary, background: 'none', border: 'none' }}
          >
            <PerriandIcon name="close" size={16} color={TEXT.secondary} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
