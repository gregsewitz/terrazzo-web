import { NextRequest } from 'next/server';
import { searchPlace, priceLevelToString } from '@/lib/places';
import { generateTasteMatchBatch } from '@/lib/anthropic';
import { DEFAULT_USER_PROFILE } from '@/lib/taste';

/**
 * Google Maps Saved List Import — powered by Apify Puppeteer Scraper
 *
 * Flow:
 * 1. User pastes a maps.app.goo.gl or google.com/maps list URL
 * 2. We resolve the shortened URL server-side to get the full Google Maps URL
 * 3. We run Apify's Puppeteer Scraper with custom page code that:
 *    - Opens the full Google Maps URL in a real browser
 *    - Scrolls the sidebar to load all places (defeats virtual scrolling)
 *    - Extracts place names from the DOM using .fontHeadlineSmall.rZF81c selector
 * 4. Enrich via Google Places API → taste matching
 * 5. Stream progress via SSE
 */

const APIFY_TOKEN = process.env.APIFY_TOKEN?.trim() || '';

// Custom pageFunction that runs inside Puppeteer on the Google Maps list page.
// Scrolls the sidebar to load all places, then extracts names from the DOM.
const PAGE_FUNCTION = `
async function pageFunction(context) {
  const { page, request, log } = context;
  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  log.info('Opening Google Maps list page...');

  // Wait for the page to load and render the list
  await delay(8000);

  // Take note of what we see
  const title = await page.title();
  log.info('Page title: ' + title);

  // Find the scrollable sidebar container
  const containerSelectors = [
    '.m6QErb.DxyBCb.kA9KIf.dS8AEf',
    '.m6QErb',
    'div[role="feed"]',
    'div[role="main"]',
  ];

  let foundContainer = false;
  for (const sel of containerSelectors) {
    const exists = await page.$(sel);
    if (exists) {
      log.info('Found scroll container: ' + sel);
      foundContainer = true;

      // Scroll down repeatedly to load all places
      for (let i = 0; i < 25; i++) {
        await page.evaluate((selector) => {
          const el = document.querySelector(selector);
          if (el) el.scrollTop = el.scrollHeight;
        }, sel);
        await delay(800);
      }
      break;
    }
  }

  if (!foundContainer) {
    log.warning('No scroll container found');
  }

  // Wait a moment for final renders
  await delay(2000);

  // Extract all places with rich data from the DOM
  const places = await page.evaluate(() => {
    const results = [];
    const seen = new Set();

    // Primary: extract from place buttons which contain name, category, rating
    const buttons = document.querySelectorAll('button.SMP2wb');
    for (const btn of buttons) {
      const nameEl = btn.querySelector('.fontHeadlineSmall.rZF81c') || btn.querySelector('.fontHeadlineSmall');
      const name = nameEl?.textContent?.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);

      // Parse leaf text nodes for rating, reviews, price, category
      const spans = btn.querySelectorAll('span, div');
      let rating = '', reviews = '', price = '', category = '';
      for (const s of spans) {
        if (s.children.length > 0) continue;
        const t = s.textContent?.trim();
        if (!t || t === name) continue;
        if (/^\\d\\.\\d$/.test(t)) rating = t;
        else if (/^\\([\\d,]+\\)$/.test(t)) reviews = t.replace(/[()]/g, '');
        else if (/^[£$€]/.test(t)) price = t;
        else if (t !== '·' && t !== 'Note' && t !== '+' && t.length > 2) {
          if (!category) category = t;
        }
      }

      results.push({ name, category, rating, reviews });
    }

    // Fallback: if no buttons found, try name elements directly
    if (results.length === 0) {
      const nameEls = document.querySelectorAll('.fontHeadlineSmall');
      for (const el of nameEls) {
        const name = el.textContent?.trim();
        if (name && name.length > 1 && name.length < 100 && !seen.has(name)) {
          seen.add(name);
          results.push({ name, category: '', rating: '', reviews: '' });
        }
      }
    }

    // Get the list title
    const titleEl = document.querySelector('h1, .fontHeadlineLarge, .DUwDvf');
    const listTitle = titleEl?.textContent?.trim() || null;

    return { places: results, listTitle };
  });

  log.info('Extracted ' + places.places.length + ' places');
  log.info('List title: ' + (places.listTitle || 'unknown'));
  if (places.places.length > 0) {
    log.info('Sample: ' + JSON.stringify(places.places[0]));
  }

  // Push each place as a separate dataset item
  for (const place of places.places) {
    await context.Apify.pushData({
      ...place,
      listTitle: places.listTitle,
    });
  }

  return { placesFound: places.places.length, listTitle: places.listTitle };
}
`;

export async function POST(request: NextRequest) {
  const { url } = await request.json();

  if (!url?.trim()) {
    return new Response(JSON.stringify({ error: 'URL is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!APIFY_TOKEN) {
    return new Response(JSON.stringify({ error: 'Apify not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        // ── 1. Resolve shortened URL ──
        send({
          type: 'progress',
          stage: 'starting',
          label: 'Resolving Google Maps link…',
          percent: 5,
        });

        let resolvedUrl = url.trim();

        // Resolve shortened URLs (goo.gl, maps.app) to full google.com/maps URLs.
        // We MUST do this because Apify Puppeteer times out on goo.gl redirects.
        if (resolvedUrl.includes('goo.gl') || resolvedUrl.includes('maps.app')) {
          try {
            const headRes = await fetch(resolvedUrl, { method: 'HEAD', redirect: 'follow' });
            if (headRes.url && headRes.url !== resolvedUrl) {
              resolvedUrl = headRes.url;
              console.log('[maps-list] Resolved URL:', resolvedUrl);
            }
          } catch {
            console.warn('[maps-list] Could not resolve short URL, using as-is');
          }
        }

        // ── 2. Start Apify Puppeteer Scraper ──
        send({
          type: 'progress',
          stage: 'starting',
          label: 'Connecting to Google Maps…',
          percent: 10,
        });

        console.log('[maps-list] Sending to Apify Puppeteer Scraper:', resolvedUrl);

        const startRes = await fetch(
          `https://api.apify.com/v2/acts/apify~puppeteer-scraper/runs?token=${APIFY_TOKEN}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              startUrls: [{ url: resolvedUrl }],
              pageFunction: PAGE_FUNCTION,
              maxRequestRetries: 2,
              maxConcurrency: 1,
              navigationTimeoutSecs: 90,
              pageLoadTimeoutSecs: 90,
              proxyConfiguration: {
                useApifyProxy: true,
                apifyProxyGroups: ['RESIDENTIAL'],
              },
              preNavigationHooks: `[
                async ({ page }) => {
                  await page.setViewport({ width: 1280, height: 900 });
                  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
                }
              ]`,
            }),
          }
        );

        if (!startRes.ok) {
          const err = await startRes.text();
          throw new Error(`Apify start failed: ${startRes.status} — ${err}`);
        }

        const runData = await startRes.json();
        const runId = runData.data?.id;
        if (!runId) throw new Error('No run ID returned from Apify');

        console.log('[maps-list] Apify run started:', runId);

        send({
          type: 'progress',
          stage: 'scraping',
          label: 'Opening your list in a browser…',
          percent: 15,
        });

        // ── 3. Poll for completion ──
        let status = 'RUNNING';
        let pollCount = 0;
        const MAX_POLLS = 100; // 100 * 3s = 5 min max

        while (status === 'RUNNING' || status === 'READY') {
          if (pollCount++ > MAX_POLLS) throw new Error('Apify timed out');
          await new Promise(r => setTimeout(r, 3000));

          const pollRes = await fetch(
            `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
          );
          const pollData = await pollRes.json();
          status = pollData.data?.status || 'FAILED';

          const pct = Math.min(15 + pollCount * 1.2, 45);
          send({
            type: 'progress',
            stage: 'scraping',
            label: 'Scrolling through your list to load all places…',
            percent: Math.round(pct),
          });
        }

        // ── 4. Fetch run log for debugging ──
        try {
          const logRes = await fetch(
            `https://api.apify.com/v2/actor-runs/${runId}/log?token=${APIFY_TOKEN}`
          );
          const logText = await logRes.text();
          console.log('[maps-list] === APIFY RUN LOG (last 3000 chars) ===');
          console.log(logText.slice(-3000));
          console.log('[maps-list] === END LOG ===');
        } catch {
          console.warn('[maps-list] Could not fetch run log');
        }

        if (status !== 'SUCCEEDED') {
          throw new Error(`Apify run failed with status: ${status}`);
        }

        // ── 5. Fetch results ──
        send({
          type: 'progress',
          stage: 'fetched',
          label: 'Got your places! Enriching…',
          percent: 50,
        });

        const datasetId = runData.data?.defaultDatasetId;
        console.log('[maps-list] Dataset ID:', datasetId);

        const resultsRes = await fetch(
          `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&format=json`
        );
        const rawItems = await resultsRes.json();

        // Filter out error items from Apify
        const apifyPlaces = Array.isArray(rawItems)
          ? rawItems.filter((item: Record<string, unknown>) => !item['#error'] && item.name)
          : [];

        console.log('[maps-list] Raw items:', Array.isArray(rawItems) ? rawItems.length : 'not array');
        console.log('[maps-list] Valid places:', apifyPlaces.length);
        if (apifyPlaces.length > 0) {
          console.log('[maps-list] First place:', JSON.stringify(apifyPlaces[0]));
        }

        if (apifyPlaces.length === 0) {
          throw new Error('No places found in the list. The Google Maps list may not be publicly shared, or the format is not supported.');
        }

        const placeNames = apifyPlaces.map((p: Record<string, unknown>) =>
          (p.name as string) || 'Unknown'
        );

        send({
          type: 'progress',
          stage: 'enriching',
          label: `Found ${placeNames.length} places. Looking up details…`,
          percent: 55,
          placeNames: placeNames.slice(0, 20),
        });

        // ── 6. Enrich each place via Google Places API ──
        // Use category + list title as context for accurate matching.
        // e.g. "Juliet restaurant England" finds the Cotswolds restaurant, not a NYC show.
        const listTitle = (apifyPlaces[0]?.listTitle as string) || '';
        const enrichedPlaces = [];
        for (let i = 0; i < apifyPlaces.length; i++) {
          const ap = apifyPlaces[i];
          const name = ap.name as string;
          const category = (ap.category as string) || '';

          if (!name) continue;

          try {
            // Build a precise search query: name + category (if not a country) + list title
            const isCountryCategory = /^(United Kingdom|United States|France|Italy|Spain|Germany|Japan|China|Australia|Canada|Mexico|Brazil|India|Thailand|Portugal|Greece|Turkey|Morocco|Indonesia)/i.test(category);
            const parts = [name];
            if (category && !isCountryCategory && !category.startsWith('$') && !category.startsWith('£') && !category.startsWith('€')) {
              parts.push(category);
            }
            if (listTitle) parts.push(listTitle);
            const query = parts.join(', ');
            console.log(`[maps-list] Searching: "${query}"`);
            const googleResult = await searchPlace(query);

            if (googleResult) {
              enrichedPlaces.push({
                id: `maps-list-${Date.now()}-${i}`,
                name: googleResult.displayName?.text || name,
                type: mapGoogleTypeToPlaceType(googleResult.primaryType || googleResult.types?.[0]),
                location: googleResult.formattedAddress || '',
                source: { type: 'google-maps' as const, name: 'Google Maps' },
                matchScore: 0,
                matchBreakdown: { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0 },
                tasteNote: '',
                status: 'available' as const,
                google: {
                  placeId: googleResult.id,
                  rating: googleResult.rating,
                  reviewCount: googleResult.userRatingCount,
                  category: googleResult.primaryTypeDisplayName?.text || googleResult.primaryType,
                  priceLevel: priceLevelToString(googleResult.priceLevel) ? priceLevelToString(googleResult.priceLevel).length : undefined,
                  hours: googleResult.regularOpeningHours?.weekdayDescriptions,
                  address: googleResult.formattedAddress,
                  lat: googleResult.location?.latitude,
                  lng: googleResult.location?.longitude,
                },
                ghostSource: 'maps' as const,
              });
            } else {
              enrichedPlaces.push({
                id: `maps-list-${Date.now()}-${i}`,
                name,
                type: guessTypeFromCategory(category),
                location: '',
                source: { type: 'google-maps' as const, name: 'Google Maps' },
                matchScore: 0,
                matchBreakdown: { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0 },
                tasteNote: '',
                status: 'available' as const,
                ghostSource: 'maps' as const,
              });
            }
          } catch {
            console.warn(`Failed to enrich: ${name}`);
          }

          if (i % 3 === 0) {
            const pct = Math.min(55 + Math.round((i / apifyPlaces.length) * 20), 75);
            send({
              type: 'progress',
              stage: 'enriching',
              label: `Looking up ${name}…`,
              percent: pct,
            });
          }
        }

        // ── 7. Taste matching ──
        send({
          type: 'progress',
          stage: 'taste',
          label: 'Matching to your taste profile…',
          percent: 80,
        });

        try {
          const tasteResults = await generateTasteMatchBatch(
            enrichedPlaces.map(p => ({ name: p.name, type: p.type, city: p.location })),
            DEFAULT_USER_PROFILE
          );

          if (tasteResults && tasteResults.length === enrichedPlaces.length) {
            enrichedPlaces.forEach((place, i) => {
              const taste = tasteResults[i];
              if (taste) {
                place.matchScore = taste.matchScore || 0;
                place.matchBreakdown = taste.matchBreakdown || place.matchBreakdown;
                place.tasteNote = taste.tasteNote || '';
              }
            });
          }
        } catch (e) {
          console.warn('Taste matching failed, continuing without scores:', e);
        }

        // ── 8. Return results ──
        send({
          type: 'progress',
          stage: 'done',
          label: 'All done!',
          percent: 100,
        });

        const listName = apifyPlaces[0]?.listTitle || null;
        send({
          type: 'result',
          places: enrichedPlaces,
          listName,
        });
      } catch (err) {
        console.error('Maps list import error:', err);
        send({
          type: 'error',
          error: (err as Error).message || 'Failed to import Google Maps list',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapGoogleTypeToPlaceType(googleType?: string): string {
  if (!googleType) return 'activity';
  const type = googleType.toLowerCase();
  if (type.includes('restaurant') || type.includes('food')) return 'restaurant';
  if (type.includes('bar') || type.includes('night_club') || type.includes('pub')) return 'bar';
  if (type.includes('cafe') || type.includes('coffee') || type.includes('bakery')) return 'cafe';
  if (type.includes('hotel') || type.includes('lodging') || type.includes('resort')) return 'hotel';
  if (type.includes('museum') || type.includes('art_gallery') || type.includes('church') || type.includes('landmark')) return 'museum';
  if (type.includes('store') || type.includes('shop') || type.includes('market')) return 'shop';
  if (type.includes('park') || type.includes('neighborhood') || type.includes('locality')) return 'neighborhood';
  return 'activity';
}

function guessTypeFromCategory(category?: string): string {
  if (!category) return 'activity';
  const c = category.toLowerCase();
  if (c.includes('restaurant') || c.includes('food') || c.includes('kitchen') || c.includes('butcher')) return 'restaurant';
  if (c.includes('bar') || c.includes('pub') || c.includes('inn') || c.includes('tavern')) return 'bar';
  if (c.includes('cafe') || c.includes('coffee') || c.includes('bakery')) return 'cafe';
  if (c.includes('hotel') || c.includes('lodging') || c.includes('resort') || c.includes('manor')) return 'hotel';
  if (c.includes('museum') || c.includes('gallery') || c.includes('church') || c.includes('cathedral')) return 'museum';
  if (c.includes('store') || c.includes('shop') || c.includes('market') || c.includes('antique')) return 'shop';
  if (c.includes('kingdom') || c.includes('village') || c.includes('town') || c.includes('city')) return 'neighborhood';
  return 'activity';
}
