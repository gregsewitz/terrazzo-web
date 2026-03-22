/**
 * Diagnostic: show review scraper results for places with 0 reviews.
 * After deploying the updated pipeline, re-enrich a few places and run this
 * to see what URLs the scraper attempted and what it returned.
 *
 * Usage: node scripts/audit-review-scraper.mjs
 */

import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL });

async function main() {
  const client = await pool.connect();

  try {
    // All complete records with 0 reviews
    const { rows } = await client.query(`
      SELECT
        "propertyName",
        "googlePlaceId",
        "reviewCount",
        "signalCount",
        "sourcesProcessed" -> 'reviewScraper' as scraper_diag,
        "sourcesProcessed" as full_sources,
        "lastEnrichedAt"
      FROM "PlaceIntelligence"
      WHERE status = 'complete'
        AND "reviewCount" = 0
      ORDER BY "lastEnrichedAt" DESC
    `);

    console.log(`\n=== ${rows.length} complete records with 0 reviews ===\n`);

    for (const r of rows) {
      const diag = r.scraper_diag;
      console.log(`📍 ${r.propertyName} (${r.googlePlaceId})`);
      console.log(`   Signals: ${r.signalCount} | Last enriched: ${r.lastEnrichedAt}`);

      if (diag) {
        console.log(`   🔍 Scraper diagnostics:`);
        console.log(`      totalCount: ${diag.totalCount} (Google: ${diag.googleCount ?? '?'}, TA: ${diag.tripadvisorCount ?? '?'})`);
        console.log(`      reviewsReturned: ${diag.reviewsReturned}`);
        console.log(`      skipped: ${diag.skipped}`);
        if (diag.urlsAttempted) {
          const urls = diag.urlsAttempted;
          console.log(`      🔗 Google: placeId=${urls.google?.placeId}, method=${urls.google?.method}`);
          if (urls.google?.attempts?.length) {
            for (const a of urls.google.attempts) {
              console.log(`         attempt: ${a.actor} → ${a.count ?? 0} reviews${a.error ? ` (error: ${a.error})` : ''}`);
            }
          }
          console.log(`      🔗 TripAdvisor: url=${urls.tripadvisor?.discoveredUrl || 'none'}, method=${urls.tripadvisor?.method}`);
          if (urls.tripadvisor?.attempts?.length) {
            for (const a of urls.tripadvisor.attempts) {
              console.log(`         attempt: ${a.actor || a.step} → ${a.reviews_extracted ?? a.result ?? 0}${a.error ? ` (error: ${a.error})` : ''}`);
            }
          }
        }
        if (diag.rawKeys?.length) console.log(`      rawKeys from worker: [${diag.rawKeys.join(', ')}]`);
      } else {
        console.log(`   ⚠️  No scraper diagnostics (enriched before diagnostic logging was added)`);
        // Show what we do have
        const src = r.full_sources;
        if (src) {
          console.log(`   Source counts: editorial=${src.editorial_signals || 0}, menu=${src.menu_signals || 0}, award=${src.award_signals || 0}, instagram=${src.instagram_signals || 0}`);
        }
      }
      console.log('');
    }

    // Summary
    const withDiag = rows.filter(r => r.scraper_diag).length;
    const withoutDiag = rows.length - withDiag;
    console.log(`=== Summary ===`);
    console.log(`  ${withDiag} records with scraper diagnostics`);
    console.log(`  ${withoutDiag} records without (pre-diagnostic enrichment)`);
    console.log(`\nTo see diagnostics for the ${withoutDiag} older records, reset them to pending and re-enrich.`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
