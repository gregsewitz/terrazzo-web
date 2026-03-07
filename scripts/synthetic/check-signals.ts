#!/usr/bin/env node
/**
 * Quick diagnostic: compare signal content between archetypes to check
 * if the structured signal generator produces differentiated signals.
 */
import { loadArchetypes } from './archetypes';
import { computeStructuredSignals } from './simulator/structured-inputs';

const archetypes = loadArchetypes(['budget-backpacker', 'quiet-luxurist', 'eco-purist']);

const allSigSets: Record<string, Set<string>> = {};

for (const arch of archetypes) {
  const s = computeStructuredSignals(arch);
  const tagSet = new Set(s.signals.map((sig: any) => sig.tag));
  allSigSets[arch.id] = tagSet;

  console.log(`\n=== ${arch.id} (total: ${s.signals.length}, unique tags: ${tagSet.size}) ===`);
  console.log('First 20 tags:', s.signals.slice(0, 20).map((sig: any) => `${sig.cat}:${sig.tag}`));
}

// Compare pairwise overlap
const ids = Object.keys(allSigSets);
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const a = allSigSets[ids[i]];
    const b = allSigSets[ids[j]];
    const shared = [...a].filter(t => b.has(t)).length;
    const onlyA = [...a].filter(t => !b.has(t));
    const onlyB = [...b].filter(t => !a.has(t));
    console.log(`\n${ids[i]} vs ${ids[j]}:`);
    console.log(`  Shared: ${shared}/${Math.min(a.size, b.size)} (${(shared/Math.min(a.size, b.size) * 100).toFixed(0)}%)`);
    console.log(`  Only in ${ids[i]} (first 10):`, onlyA.slice(0, 10));
    console.log(`  Only in ${ids[j]} (first 10):`, onlyB.slice(0, 10));
  }
}
