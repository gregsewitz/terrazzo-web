import { NextRequest, NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/import-history
 *
 * Returns a unified, reverse-chronological timeline of all imports:
 * - Email scans (with reservation counts)
 * - URL / article imports (grouped by importBatchId)
 * - Manual adds
 */

interface TimelineItem {
  id: string;
  type: 'email-scan' | 'url-import' | 'manual';
  date: string;
  title: string;
  subtitle: string;
  count: number;
  status?: string;
  scanId?: string;
}

export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return unauthorized();

  try {
    const timeline: TimelineItem[] = [];

    // ── Email scans ──────────────────────────────────────────────────────
    const scans = await prisma.emailScan.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        _count: { select: { reservations: true } },
      },
    });

    for (const scan of scans) {
      timeline.push({
        id: `scan-${scan.id}`,
        type: 'email-scan',
        date: scan.createdAt.toISOString(),
        title: `Email scan`,
        subtitle: `${scan.emailsFound} emails → ${scan._count.reservations} reservations`,
        count: scan._count.reservations,
        status: scan.status,
        scanId: scan.id,
      });
    }

    // ── URL/article imports (grouped by importBatchId) ───────────────────
    const urlImports = await prisma.savedPlace.groupBy({
      by: ['importBatchId', 'ghostSource'],
      where: {
        userId: user.id,
        importBatchId: { not: null },
        ghostSource: { in: ['article', 'url', 'google-maps'] },
      },
      _count: { id: true },
      _min: { createdAt: true },
    });

    for (const group of urlImports) {
      if (!group.importBatchId) continue;

      // Fetch one place from the batch to get the source name
      const sample = await prisma.savedPlace.findFirst({
        where: { importBatchId: group.importBatchId, userId: user.id },
        select: { importSources: true, createdAt: true },
      });

      const sources = (sample?.importSources as Array<{ name?: string; url?: string }>) || [];
      const sourceName = sources[0]?.name || group.ghostSource || 'Import';

      timeline.push({
        id: `import-${group.importBatchId}`,
        type: 'url-import',
        date: (group._min.createdAt ?? new Date()).toISOString(),
        title: sourceName,
        subtitle: `${group._count.id} places imported`,
        count: group._count.id,
      });
    }

    // ── Manual adds ──────────────────────────────────────────────────────
    const manualPlaces = await prisma.savedPlace.findMany({
      where: {
        userId: user.id,
        ghostSource: 'manual',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, name: true, type: true, location: true, createdAt: true },
    });

    for (const place of manualPlaces) {
      timeline.push({
        id: `manual-${place.id}`,
        type: 'manual',
        date: place.createdAt.toISOString(),
        title: place.name,
        subtitle: `${place.type} · ${place.location || 'No location'}`,
        count: 1,
      });
    }

    // ── Sort all items by date descending ────────────────────────────────
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ timeline });
  } catch (error) {
    console.error('Import history error:', error);
    return NextResponse.json({ error: 'Failed to fetch import history' }, { status: 500 });
  }
}
