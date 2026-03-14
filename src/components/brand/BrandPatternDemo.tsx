'use client';

import React from 'react';
import { BrandPattern, BrandPatternStrip } from './BrandPattern';

/**
 * Demo component showing all BrandPattern variants.
 * This is for development/review only — not shipped to production.
 */
export function BrandPatternDemo() {
  return (
    <div className="min-h-screen bg-cream p-8 font-sans text-navy">
      <h1 className="text-2xl font-bold mb-8">Brand Pattern Component — All Variants</h1>

      {/* Color Variants */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-4">1. Color Variants (vertical, 120px tall)</h2>
        <div className="flex gap-6 items-end">
          {['navy', 'cream', 'coral', 'teal', 'ochre', 'olive'].map((color) => (
            <div key={color} className="flex flex-col items-center gap-2">
              <div
                className={`${color === 'cream' ? 'bg-navy' : 'bg-cream'} p-2 rounded`}
              >
                <BrandPattern color={color} className="h-[120px] w-[28px]" />
              </div>
              <span className="text-xs">{color}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Orientation */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-4">2. Horizontal Orientation</h2>
        <BrandPattern color="coral" orientation="horizontal" className="w-[400px] h-[28px]" />
      </section>

      {/* Mirror + Flip */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-4">3. Mirror / Flip Transforms</h2>
        <div className="flex gap-8">
          <div className="flex flex-col items-center gap-2">
            <BrandPattern color="navy" className="h-[100px] w-[24px]" />
            <span className="text-xs">Default</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <BrandPattern color="navy" mirror className="h-[100px] w-[24px]" />
            <span className="text-xs">Mirror</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <BrandPattern color="navy" flip className="h-[100px] w-[24px]" />
            <span className="text-xs">Flip</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <BrandPattern color="navy" mirror flip className="h-[100px] w-[24px]" />
            <span className="text-xs">Mirror + Flip</span>
          </div>
        </div>
      </section>

      {/* Multi-color Strip */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-4">4. Multi-Color Strip (poster style)</h2>
        <BrandPatternStrip
          colors={['navy', 'coral', 'navy', 'coral', 'navy']}
          className="h-[300px] w-[28px]"
        />
      </section>

      {/* Card with Pattern Accent */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-4">5. Card with Pattern Accent</h2>
        <div className="relative bg-coral rounded-lg overflow-hidden w-[400px] h-[200px] p-6">
          <BrandPatternStrip
            colors={['navy', 'coral', 'navy', 'coral', 'navy']}
            mirror
            className="absolute right-0 top-0 h-full w-[28px]"
          />
          <h3 className="text-cream text-xl font-bold">Discover Trastevere</h3>
          <p className="text-cream mt-2 text-sm">A neighborhood that feels like it was made for you.</p>
        </div>
      </section>

      {/* Hero Section Mock */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-4">6. Hero Section with Corner Patterns</h2>
        <div className="relative bg-navy rounded-lg overflow-hidden w-full h-[300px] p-8 flex items-center">
          {/* Top-right pattern */}
          <BrandPatternStrip
            colors={['coral', 'navy', 'coral']}
            mirror
            className="absolute right-0 top-0 h-full w-[32px]"
          />
          {/* Bottom-left pattern */}
          <BrandPattern
            color="teal"
            flip
            className="absolute bottom-4 left-4 h-[80px] w-[20px]"
          />
          <div>
            <p className="text-peach text-sm mb-2 italic font-bold">Discover your next adventure</p>
            <h2 className="text-cream text-4xl font-bold tracking-wide">TERRAZZO TRAVEL</h2>
          </div>
        </div>
      </section>
    </div>
  );
}

export default BrandPatternDemo;
