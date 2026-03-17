import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeMatchFromSignals } from '@/lib/taste-match-v3';
import type { TasteProfile } from '@/types';
import { ALL_TASTE_DOMAINS } from '@/types';

/**
 * GET /api/admin/taste-dashboard
 *
 * Returns all data needed by the taste-intelligence dashboard:
 *   - v1 (LLM signal matching) scores for every property
 *   - v2 (Embedding 136-dim) vs v3 (Cluster 400-dim, signal-only) match scores
 *   - cluster size distribution
 *   - domain statistics
 */
export async function GET(req: Request) {
  // Admin auth: require ADMIN_SECRET bearer token
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Get the user with taste vectors + taste profile (for LLM scoring)
    const users = await prisma.$queryRawUnsafe<
      Array<{ id: string; tasteVector: string; tasteVectorV3: string; tasteProfile: any }>
    >(`
      SELECT "id", "tasteVector"::text, "tasteVectorV3"::text, "tasteProfile"
      FROM "User"
      WHERE "tasteVector" IS NOT NULL AND "tasteVectorV3" IS NOT NULL
      LIMIT 1
    `);

    if (!users.length) {
      return NextResponse.json({ error: 'No user with both vectors found' }, { status: 404 });
    }

    const user = users[0];

    // Build TasteProfile from radarData for LLM scoring
    const userTasteProfile: TasteProfile = {
      Design: 0.5, Atmosphere: 0.5, Character: 0.5,
      Service: 0.5, FoodDrink: 0.5, Geography: 0.5,
      Wellness: 0.5, Sustainability: 0.5,
    };

    const axisToKey: Record<string, keyof TasteProfile> = {
      design: 'Design', 'design language': 'Design',
      atmosphere: 'Atmosphere', 'sensory environment': 'Atmosphere',
      character: 'Character', 'character & identity': 'Character',
      service: 'Service', 'service philosophy': 'Service',
      fooddrink: 'FoodDrink', 'food & drink': 'FoodDrink', 'food & drink identity': 'FoodDrink', food: 'FoodDrink',
      setting: 'Geography', 'location & context': 'Geography', 'location & setting': 'Geography', location: 'Geography',
      wellness: 'Wellness', 'wellness & body': 'Wellness',
      sustainability: 'Sustainability',
    };

    if (user.tasteProfile?.radarData) {
      for (const { axis, value } of user.tasteProfile.radarData) {
        const key = axisToKey[axis.toLowerCase()];
        if (key) userTasteProfile[key] = value;
      }
    }

    // 2. Get property scores — Embedding (v2) & Clusters (v3) via pgvector
    //    Also load signals/antiSignals JSON for LLM scoring
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        embedding_score: number;
        clusters_score: number;
        signalCount: number;
        signals: any;
        antiSignals: any;
      }>
    >(`
      SELECT
        pi."id",
        pi."propertyName" as name,
        ROUND((1 - (pi."embedding" <=> u."tasteVector"))::numeric * 100, 1) as embedding_score,
        ROUND((1 - (pi."embeddingV3" <=> u."tasteVectorV3"))::numeric * 100, 1) as clusters_score,
        pi."signalCount",
        pi."signals",
        pi."antiSignals"
      FROM "PlaceIntelligence" pi
      CROSS JOIN "User" u
      WHERE u."id" = $1
        AND pi."embedding" IS NOT NULL
        AND pi."embeddingV3" IS NOT NULL
      ORDER BY clusters_score DESC
    `, user.id);

    // 3. Compute LLM scores for each property
    const properties = rows.map((r: {
        id: string;
        name: string;
        embedding_score: number;
        clusters_score: number;
        signalCount: number;
        signals: any;
        antiSignals: any;
      }) => {
      const signals = Array.isArray(r.signals) ? r.signals : [];
      const antiSignals = Array.isArray(r.antiSignals) ? r.antiSignals : [];

      let llmScore = 50; // default neutral
      if (signals.length > 0) {
        const result = computeMatchFromSignals(signals, antiSignals, userTasteProfile);
        llmScore = result.overallScore;
      }

      return {
        id: r.id,
        name: r.name,
        llm: llmScore,
        embedding: Number(r.embedding_score),
        clusters: Number(r.clusters_score),
        signals: Number(r.signalCount) || 0,
      };
    });

    // Build ranks for each approach
    const llmRanked = [...properties].sort((a, b) => b.llm - a.llm);
    const embRanked = [...properties].sort((a, b) => b.embedding - a.embedding);
    const cluRanked = [...properties].sort((a, b) => b.clusters - a.clusters);

    const llmRanks = new Map(llmRanked.map((r, i) => [r.id, i + 1]));
    const embRanks = new Map(embRanked.map((r, i) => [r.id, i + 1]));
    const cluRanks = new Map(cluRanked.map((r, i) => [r.id, i + 1]));

    const enriched = properties.map((r: {
        id: string;
        name: string;
        llm: number;
        embedding: number;
        clusters: number;
        signals: number;
      }) => ({
      name: r.name,
      llm: r.llm,
      embedding: r.embedding,
      clusters: r.clusters,
      signals: r.signals,
      llmR: llmRanks.get(r.id)!,
      embR: embRanks.get(r.id)!,
      cluR: cluRanks.get(r.id)!,
    }));

    // 4. Cluster sizes from signal_cluster_map
    const clusterRows = await prisma.$queryRawUnsafe<
      Array<{ cluster_id: number; signal_count: number }>
    >(`
      SELECT cluster_id, COUNT(*)::int as signal_count
      FROM v3_signal_cluster_map
      GROUP BY cluster_id
      ORDER BY cluster_id
    `);

    const clusterSizes = new Array(400).fill(0);
    clusterRows.forEach((r: { cluster_id: number; signal_count: number }) => {
      clusterSizes[Number(r.cluster_id)] = Number(r.signal_count);
    });

    // 5. Domain stats
    const domainRanges = [
      { domain: 'Atmosphere', start: 0, end: 50 },
      { domain: 'Character', start: 51, end: 135 },
      { domain: 'Design', start: 136, end: 191 },
      { domain: 'FoodDrink', start: 192, end: 263 },
      { domain: 'Service', start: 264, end: 336 },
      { domain: 'Geography', start: 337, end: 379 },
      { domain: 'Sustainability', start: 380, end: 386 },
      { domain: 'Wellness', start: 387, end: 399 },
    ];

    const domains = domainRanges.map((dr: { domain: string; start: number; end: number }) => {
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

    // 6. Cluster size histogram
    const hist: Record<number, number> = {};
    clusterSizes.forEach((s) => {
      const bucket = Math.floor(s / 5) * 5;
      hist[bucket] = (hist[bucket] || 0) + 1;
    });
    const clusterHist = Object.entries(hist)
      .map(([k, v]) => ({ bucket: Number(k), count: v }))
      .sort((a, b) => a.bucket - b.bucket);

    return NextResponse.json({
      properties: enriched,
      domains,
      clusterSizes,
      clusterHist,
      meta: {
        propertyCount: enriched.length,
        clusterCount: 400,
        dimensions: 400,
        mappedSignals: clusterRows.reduce((s: number, r: { cluster_id: number; signal_count: number }) => s + Number(r.signal_count), 0),
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
