/**
 * GET /api/signals/decay?userId=...
 *
 * Compute decayed confidence for all of a user's taste signals.
 * Returns signals with their current decayedConfidence and ageInDays.
 *
 * Also detects taste trajectory shifts by comparing recent vs older signals.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decayConfidence, computeSignalAge } from '@/lib/signal-decay';
import { analyzeTrajectory } from '@/lib/taste-trajectory';
import { ALL_TASTE_DOMAINS } from '@/types';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  // Fetch all active signals
  const signals = await prisma.tasteNode.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  if (signals.length === 0) {
    return NextResponse.json({ signals: [], trajectory: null });
  }

  const now = new Date();

  // Compute decay for each signal
  const decayedSignals = signals.map((sig) => {
    const extractedAt = sig.extractedAt || sig.createdAt;
    const ageInDays = computeSignalAge(extractedAt, now);
    const decayed = decayConfidence(sig.confidence, extractedAt, 180, now);

    return {
      id: sig.id,
      domain: sig.domain,
      signal: sig.signal,
      originalConfidence: sig.confidence,
      decayedConfidence: Math.round(decayed * 1000) / 1000,
      ageInDays,
      sourceModality: sig.sourceModality,
      extractedAt: extractedAt.toISOString(),
      isAgedOut: decayed < 0.05,
    };
  });

  // Update decayed values in DB (batch)
  const updates = decayedSignals.map((s) =>
    prisma.tasteNode.update({
      where: { id: s.id },
      data: {
        decayedConfidence: s.decayedConfidence,
        ageInDays: s.ageInDays,
      },
    })
  );
  await prisma.$transaction(updates);

  // Trajectory detection: split signals into recent (0-90 days) vs older (90-270 days)
  const recentSignals = decayedSignals
    .filter((s) => s.ageInDays <= 90)
    .map((s) => ({ domain: s.domain, signal: s.signal, confidence: s.originalConfidence }));

  const olderSignals = decayedSignals
    .filter((s) => s.ageInDays > 90 && s.ageInDays <= 270)
    .map((s) => ({ domain: s.domain, signal: s.signal, confidence: s.originalConfidence }));

  let trajectory = null;
  if (recentSignals.length >= 3 && olderSignals.length >= 3) {
    trajectory = analyzeTrajectory(recentSignals, olderSignals, ALL_TASTE_DOMAINS);

    // Persist trajectory shifts
    if (trajectory.shifts.length > 0) {
      await prisma.tasteTrajectoryShift.createMany({
        data: trajectory.shifts.map((shift) => ({
          userId,
          domain: shift.domain,
          fromPattern: shift.fromPattern,
          toPattern: shift.toPattern,
          detectedAt: new Date(shift.detectedAt),
        })),
      });

      // Update user trajectory
      await prisma.user.update({
        where: { id: userId },
        data: {
          tasteTrajectoryDirection: trajectory.direction,
          tasteTrajectoryDescription: trajectory.description,
        },
      });
    }
  }

  return NextResponse.json({
    signals: decayedSignals,
    trajectory,
    summary: {
      total: decayedSignals.length,
      agedOut: decayedSignals.filter((s) => s.isAgedOut).length,
      avgDecayedConfidence:
        Math.round(
          (decayedSignals.reduce((sum, s) => sum + s.decayedConfidence, 0) / decayedSignals.length) * 1000
        ) / 1000,
    },
  });
}
