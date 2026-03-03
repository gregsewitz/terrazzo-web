'use client';

import { ImportedPlace } from '@/types';
import type { ImportMode } from '@/stores/importStore';

// Input type detection — Terrazzo figures out the rest
export function detectInputType(input: string): ImportMode {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed) || /^(www\.)/i.test(trimmed)) {
    if (/google\.com\/maps/i.test(trimmed) || /maps\.app\.goo/i.test(trimmed)) return 'google-maps';
    return 'url';
  }
  return 'text';
}

// Demo imported results for prototype
export const DEMO_IMPORT_RESULTS: ImportedPlace[] = [
  {
    id: 'imp-1', name: 'Casa Caldera', type: 'restaurant', location: 'Yaiza, Lanzarote',
    source: { type: 'url', name: 'CN Traveller' }, matchScore: 91,
    matchBreakdown: { Design: 0.95, Atmosphere: 0.5, Character: 0.9, Service: 0.85, FoodDrink: 0.92, Setting: 0.8, Wellness: 0.4, Sustainability: 0.5 },
    tasteNote: 'Volcanic stone dining room — the grilled octopus at sunset is unforgettable',
    status: 'available', ghostSource: 'article', importBatchId: 'batch-lanzarote',
    whatToOrder: ['Grilled octopus ★', 'Papas arrugadas', 'Local wine'],
    tips: ['⏰ Book ahead for sunset table', '🍷 Ask for the volcanic Malvasía'],
  },
  {
    id: 'imp-2', name: 'Finca de Arrieta', type: 'hotel', location: 'Arrieta, Lanzarote',
    source: { type: 'url', name: 'CN Traveller' }, matchScore: 88,
    matchBreakdown: { Design: 0.92, Atmosphere: 0.5, Character: 0.88, Service: 0.8, FoodDrink: 0.5, Setting: 0.85, Wellness: 0.9, Sustainability: 0.5 },
    tasteNote: 'Eco-chic finca with volcanic views — the silence here is the luxury',
    status: 'available', ghostSource: 'article', importBatchId: 'batch-lanzarote',
  },
  {
    id: 'imp-3', name: 'El Lago', type: 'restaurant', location: 'Teguise, Lanzarote',
    source: { type: 'url', name: 'CN Traveller' }, matchScore: 85,
    matchBreakdown: { Design: 0.88, Atmosphere: 0.5, Character: 0.82, Service: 0.9, FoodDrink: 0.88, Setting: 0.7, Wellness: 0.3, Sustainability: 0.5 },
    tasteNote: 'Michelin-starred in a former granary — tasting menu tells the island\'s story',
    status: 'available', ghostSource: 'article', importBatchId: 'batch-lanzarote',
    whatToOrder: ['Tasting menu ★', 'Island cheese board'],
    tips: ['📅 Reserve well in advance', '👔 Smart casual dress code'],
  },
  {
    id: 'imp-4', name: 'Jameos del Agua', type: 'museum', location: 'Haría, Lanzarote',
    source: { type: 'url', name: 'CN Traveller' }, matchScore: 93,
    matchBreakdown: { Design: 0.99, Atmosphere: 0.5, Character: 0.95, Service: 0.6, FoodDrink: 0.1, Setting: 0.9, Wellness: 0.7, Sustainability: 0.5 },
    tasteNote: 'César Manrique\'s masterwork — a concert hall inside a lava tube',
    status: 'available', ghostSource: 'article', importBatchId: 'batch-lanzarote',
  },
  {
    id: 'imp-5', name: 'Bodega La Geria', type: 'activity', location: 'La Geria, Lanzarote',
    source: { type: 'url', name: 'CN Traveller' }, matchScore: 82,
    matchBreakdown: { Design: 0.85, Atmosphere: 0.5, Character: 0.9, Service: 0.7, FoodDrink: 0.75, Setting: 0.95, Wellness: 0.6, Sustainability: 0.5 },
    tasteNote: 'Volcanic wine tasting — vines growing in craters, Malvasía that tastes like the island',
    status: 'available', ghostSource: 'article', importBatchId: 'batch-lanzarote',
    whatToOrder: ['Malvasía volcánica ★', 'Moscatel dulce'],
    tips: ['🕐 Open afternoons only', '📸 Incredible photo ops in the vineyard craters'],
  },
  {
    id: 'imp-6', name: 'La Tegala', type: 'bar', location: 'Puerto del Carmen, Lanzarote',
    source: { type: 'url', name: 'CN Traveller' }, matchScore: 79,
    matchBreakdown: { Design: 0.7, Atmosphere: 0.5, Character: 0.85, Service: 0.8, FoodDrink: 0.6, Setting: 0.65, Wellness: 0.4, Sustainability: 0.5 },
    tasteNote: 'Local favorite — Canarian wines and volcanic cheese on a terrace with no tourists',
    status: 'available', ghostSource: 'article', importBatchId: 'batch-lanzarote',
    whatToOrder: ['Volcanic cheese board ★', 'Canarian wines by the glass'],
  },
];
