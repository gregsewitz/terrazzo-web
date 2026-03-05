import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/taste-dashboard
 *
 * Returns all data needed by the taste-intelligence dashboard:
 *   - v2 vs v3 match scores for every property
 *   - cluster size distribution
 *   - domain statistics
 */
export async function GET() {
  try {
    // 1. Get the user with taste vectors
    const users = await prisma.$queryRawUnsafe<
      Array<{ id: string; tasteVector: string; tasteVectorV3: string }>
    >(`
      SELECT "id", "tasteVector"::text, "tasteVectorV3"::text
      FROM "User"
      WHERE "tasteVector" IS NOT NULL AND "tasteVectorV3" IS NOT NULL
      LIMIT 1
    `);

    if (!users.length) {
      return NextResponse.json({ error: 'No user with both vectors found' }, { status: 404 });
    }

    // 2. Property scores — v2 vs v3
    const scores = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        v2_score: number;
        v3_score: number;
        signalCount: number;
      }>
    >(`
      SELECT
        pi."id",
        pi."propertyName" as name,
        ROUND((1 - (pi."embedding" <=> u."tasteVector"))::numeric * 100, 1) as v2_score,
        ROUND((1 - (pi."embeddingV3" <=> u."tasteVectorV3"))::numeric * 100, 1) as v3_score,
        pi."signalCount"
      FROM "PlaceIntelligence" pi
      CROSS JOIN "User" u
      WHERE u."id" = $1
        AND pi."embedding" IS NOT NULL
        AND pi."embeddingV3" IS NOT NULL
      ORDER BY v3_score DESC
    `, users[0].id);

    // Build ranks
    const v2Ranked = [...scores].sort((a, b) => Number(b.v2_score) - Number(a.v2_score));
    const v3Ranked = [...scores].sort((a, b) => Number(b.v3_score) - Number(a.v3_score));
    const v2Ranks = new Map(v2Ranked.map((r, i) => [r.id, i + 1]));
    const v3Ranks = new Map(v3Ranked.map((r, i) => [r.id, i + 1]));

    const properties = scores.map((r) => ({
      name: r.name,
      v2: Number(r.v2_score),
      v3: Number(r.v3_score),
      signals: Number(r.signalCount) || 0,
      v2r: v2Ranks.get(r.id)!,
      v3r: v3Ranks.get(r.id)!,
      rc: v2Ranks.get(r.id)! - v3Ranks.get(r.id)!,
    }));

    // 3. Cluster sizes from signal_cluster_map
    const clusterRows = await prisma.$queryRawUnsafe<
      Array<{ cluster_id: number; signal_count: number }>
    >(`
      SELECT cluster_id, COUNT(*)::int as signal_count
      FROM v3_signal_cluster_map
      GROUP BY cluster_id
      ORDER BY cluster_id
    `);

    const clusterSizes = new Array(400).fill(0);
    clusterRows.forEach((r) => {
      clusterSizes[Number(r.cluster_id)] = Number(r.signal_count);
    });

    // 4. Domain stats
    const domainRanges = [
      { domain: 'Atmosphere', start: 0, end: 50 },
      { domain: 'Character', start: 51, end: 135 },
      { domain: 'Design', start: 136, end: 191 },
      { domain: 'FoodDrink', start: 192, end: 263 },
      { domain: 'Service', start: 264, end: 336 },
      { domain: 'Setting', start: 337, end: 379 },
      { domain: 'Sustainability', start: 380, end: 386 },
      { domain: 'Wellness', start: 387, end: 399 },
    ];

    const domains = domainRanges.map((dr) => {
      const slice = clusterSizes.slice(dr.start, dr.end + 1);
      const total = slice.reduce((s, v) => s + v, 0);
      return {
        domain: dr.domain,
        clusters: slice.length,
        signals: total,
        avg: Math.round((total / slice.length) * 10) / 10,
        min: Math.min(...slice),
        max: Math.max(...slice),
      };
    });

    // 5. Cluster size histogram
    const hist: Record<number, number> = {};
    clusterSizes.forEach((s) => {
      const bucket = Math.floor(s / 5) * 5;
      hist[bucket] = (hist[bucket] || 0) + 1;
    });
    const clusterHist = Object.entries(hist)
      .map(([k, v]) => ({ bucket: Number(k), count: v }))
      .sort((a, b) => a.bucket - b.bucket);

    return NextResponse.json({
      properties,
      domains,
      clusterSizes,
      clusterHist,
      meta: {
        propertyCount: properties.length,
        clusterCount: 400,
        dimensions: 408,
        mappedSignals: clusterRows.reduce((s, r) => s + Number(r.signal_count), 0),
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Taste dashboard error:', error);
    return NextResponse.json(
      { error: 'Internal error', details: String(error) },
      { status: 500 }
    );
  }
}
