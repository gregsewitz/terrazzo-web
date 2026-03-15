import { NextRequest } from 'next/server';
import { extractAndMatchPlaces } from '@/lib/anthropic';
import { getUserTasteProfile } from '@/lib/user-profile';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { getUser } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import {
  enrichWithGooglePlaces,
  deduplicatePlaces,
  stripHtml,
} from '@/lib/import-pipeline';
import Anthropic from '@anthropic-ai/sdk';

// Allow up to 120s — Claude extraction + Google Places enrichment for large files
export const maxDuration = 120;

/**
 * File-based smart import endpoint — handles screenshots, PDFs, CSVs, and text files.
 *
 * Flow:
 * 1. Accept file upload via FormData
 * 2. For images: use Claude vision to extract place names
 * 3. For PDFs: extract text then pass to Claude
 * 4. For CSV/text: parse directly and pass to Claude
 * 5. Enrich with Google Places + taste match
 * 6. Stream results via SSE
 */

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request.headers);
  const rl = rateLimit(clientIp, { maxRequests: 5, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid form data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return new Response(JSON.stringify({ error: 'No file provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate file size (20 MB max)
  if (file.size > 20 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: 'File too large (max 20 MB)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userProfile = await getUserTasteProfile(request);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|heic)$/i.test(file.name);
        const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
        const isCsv = file.type === 'text/csv' || file.name.endsWith('.csv');

        send({
          type: 'progress',
          stage: 'detecting',
          label: isImage ? 'Analyzing screenshot…' : isPdf ? 'Reading PDF…' : 'Reading file…',
          percent: 5,
        });

        let textContent: string;

        if (isImage) {
          // ── Image: Use Claude vision to extract places ────────────────────
          send({
            type: 'progress',
            stage: 'extracting',
            label: 'AI is reading your screenshot…',
            percent: 10,
          });

          const arrayBuffer = await file.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          const mediaType = file.type.startsWith('image/')
            ? file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
            : 'image/jpeg';

          // Use Claude vision directly to extract text/places from the image
          const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
          const visionResponse = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 4096,
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: mediaType, data: base64 },
                },
                {
                  type: 'text',
                  text: `This image contains travel recommendations, a list of places, or a screenshot from a travel app/website/social media post.

Extract ALL place names visible in the image, along with any details you can see (location, type of place, descriptions, ratings, etc.).

Format your response as a structured text list like:
Place Name - Type (restaurant/hotel/bar/cafe/shop/museum/activity) - Location - Any description or context visible

Extract EVERY place visible. Be thorough — scan the entire image. If it's a screenshot of a map, list all visible pins/labels. If it's a social media post, extract places mentioned in the text and captions.

If the image does not contain any identifiable places or travel recommendations, respond with: NO_PLACES_FOUND`,
                },
              ],
            }],
          });

          const visionText = visionResponse.content.find((b: { type: string }) => b.type === 'text');
          textContent = visionText?.type === 'text' ? visionText.text : '';

          if (!textContent || textContent.includes('NO_PLACES_FOUND')) {
            send({ type: 'error', error: 'No places found in this image. Try a screenshot of a travel article, list, or map.' });
            controller.close();
            return;
          }
        } else if (isPdf) {
          // ── PDF: Extract text ─────────────────────────────────────────────
          // For now, we'll use Claude vision on each page since pdf-parse
          // has reliability issues. Convert PDF pages to images via the SDK.
          // Simpler approach: read as ArrayBuffer and send to Claude as a document.
          send({
            type: 'progress',
            stage: 'extracting',
            label: 'Extracting text from PDF…',
            percent: 10,
          });

          const arrayBuffer = await file.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');

          // Use Claude's document understanding capability
          const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
          const pdfResponse = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 8192,
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'document',
                  source: { type: 'base64', media_type: 'application/pdf', data: base64 },
                },
                {
                  type: 'text',
                  text: `This PDF contains travel recommendations, a guide, an itinerary, or a list of places.

Extract ALL the text content that mentions specific places (restaurants, hotels, bars, cafes, shops, museums, activities, neighborhoods).

Format the extracted content as structured text preserving the names, locations, types, and any descriptions.

If the PDF does not contain any identifiable places, respond with: NO_PLACES_FOUND`,
                },
              ],
            }],
          });

          const pdfText = pdfResponse.content.find((b: { type: string }) => b.type === 'text');
          textContent = pdfText?.type === 'text' ? pdfText.text : '';

          if (!textContent || textContent.includes('NO_PLACES_FOUND')) {
            send({ type: 'error', error: 'No places found in this PDF.' });
            controller.close();
            return;
          }
        } else {
          // ── CSV / Text / HTML: Read as text directly ──────────────────────
          textContent = await file.text();
          if (!textContent?.trim()) {
            send({ type: 'error', error: 'File is empty' });
            controller.close();
            return;
          }

          const isHtml = file.type === 'text/html' || file.name.endsWith('.html') || file.name.endsWith('.htm');

          if (isHtml) {
            // Strip scripts, styles, and HTML tags so Claude gets clean text
            // instead of burning the 30k char budget on WordPress boilerplate.
            send({
              type: 'progress',
              stage: 'parsing',
              label: 'Cleaning HTML content…',
              percent: 10,
            });
            textContent = stripHtml(textContent, 60000);
          } else if (isCsv) {
            // For CSV files, clean up and format for better extraction
            send({
              type: 'progress',
              stage: 'parsing',
              label: 'Parsing CSV data…',
              percent: 10,
            });
          }
        }

        // ── Extract places + taste match (single Claude call) ────────────
        send({
          type: 'progress',
          stage: 'extracting',
          label: 'AI is finding & matching places…',
          percent: 20,
        });

        let extracted: any[] = [];
        let inferredRegion: string | null = null;

        try {
          const result = await extractAndMatchPlaces(
            textContent.slice(0, 30000),
            false, // not from URL
            userProfile
          );
          extracted = result.places;
          inferredRegion = result.region;
        } catch (e) {
          console.error('File extraction failed:', e);
          send({ type: 'error', error: 'AI extraction failed' });
          controller.close();
          return;
        }

        if (!extracted || extracted.length === 0) {
          send({ type: 'error', error: 'No places found in the file' });
          controller.close();
          return;
        }

        // ── Deduplicate ─────────────────────────────────────────────────────
        const deduped = deduplicatePlaces(extracted);
        if (deduped.length < extracted.length) {
          send({
            type: 'progress',
            stage: 'deduplicating',
            label: `Merged ${extracted.length - deduped.length} duplicate${extracted.length - deduped.length > 1 ? 's' : ''}`,
            percent: 30,
          });
        }

        const limited = deduped.slice(0, 30);
        send({
          type: 'progress',
          stage: 'extracted',
          label: `Found ${limited.length} place${limited.length === 1 ? '' : 's'}${inferredRegion ? ` in ${inferredRegion}` : ''}`,
          percent: 35,
          placeNames: limited.map((p: { name: string }) => p.name),
        });

        // ── Enrich with Google Places ───────────────────────────────────────
        send({ type: 'progress', stage: 'enriching', label: 'Looking up details on Google…', percent: 40 });
        const enrichedPlaces = await enrichWithGooglePlaces(limited, 'file', inferredRegion, (done, total) => {
          const enrichPercent = 40 + Math.round((done / total) * 50);
          send({
            type: 'progress',
            stage: 'enriching',
            label: `Enriching place ${done} of ${total}…`,
            percent: enrichPercent,
          });
        });

        send({ type: 'progress', stage: 'finalizing', label: 'Compiling your results…', percent: 95 });

        // ── Merge taste data ────────────────────────────────────────────────
        const mergedPlaces = enrichedPlaces.map((place, i) => {
          const source = limited[i];
          if (source && source.matchScore) {
            return {
              ...place,
              matchScore: source.matchScore || 0,
              matchBreakdown: source.matchBreakdown || place.matchBreakdown,
              tasteNote: source.tasteNote || place.tasteNote,
              terrazzoInsight: source.terrazzoInsight || undefined,
            };
          }
          return place;
        });

        // ── Cross-reference library ─────────────────────────────────────────
        let finalPlaces: any[] = mergedPlaces;
        const user = await getUser(request);
        if (user) {
          const googlePlaceIds = mergedPlaces
            .map((p: any) => p.google?.placeId)
            .filter((id: any): id is string => !!id);

          if (googlePlaceIds.length > 0) {
            const existingPlaces = await prisma.savedPlace.findMany({
              where: {
                userId: user.id,
                googlePlaceId: { in: googlePlaceIds },
                deletedAt: null,
              },
              select: { googlePlaceId: true, source: true, importSources: true },
            });

            const existingByGoogleId = new Map(
              existingPlaces.map((p) => [p.googlePlaceId, p]),
            );

            finalPlaces = mergedPlaces.map((place: any) => {
              const gpId = place.google?.placeId;
              const existing = gpId ? existingByGoogleId.get(gpId) : null;
              if (existing) {
                return {
                  ...place,
                  alreadyInLibrary: true,
                  existingSource: existing.source,
                  existingImportSources: existing.importSources,
                };
              }
              return place;
            });
          }
        }

        // ── Done ────────────────────────────────────────────────────────────
        send({
          type: 'result',
          places: finalPlaces,
          detectedType: 'file',
          percent: 100,
        });
      } catch (error) {
        console.error('File import error:', error);
        send({ type: 'error', error: 'File import failed' });
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
