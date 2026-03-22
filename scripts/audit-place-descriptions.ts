/**
 * Terrazzo PlaceIntelligence Description Audit Script
 * Uses both regex pattern matching and Claude AI to identify description mismatches
 *
 * Usage:
 *   npx ts-node scripts/audit-place-descriptions.ts [--dry-run] [--limit N]
 *
 * Options:
 *   --dry-run   Count records without calling Claude
 *   --limit N   Maximum number of records to check (default: all)
 */

import { Anthropic } from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

interface AuditRecord {
  id: string;
  googlePlaceId: string;
  propertyName: string;
  placeType: string | null;
  description: string | null;
}

interface AuditResult {
  id: string;
  googlePlaceId: string;
  propertyName: string;
  placeType: string | null;
  descriptionPreview: string;
  localCheckFlag: string | null;
  claudeCheckFlag: string | null;
  claudeReasoning?: string;
}

interface BatchCheckRequest {
  id: string;
  googlePlaceId: string;
  propertyName: string;
  placeType: string | null;
  description: string;
}

// Pattern definitions for local checks
const FOOD_KEYWORDS =
  /chef|prix-fixe|prix fixe|menu|cuisine|dishes|sommelier|tasting menu|wine list|reservation|courses|diner|restaurant|gastronomy/i;
const NON_FOOD_KEYWORDS =
  /shopping|retail|fashion|boutique|exhibits?|gallery|collection|rooms|check-in|check in|lobby|spa|pool|hotel|accommodation|sleeping|bedrooms?|suites?/i;

function getLocalMismatchReason(
  placeType: string | null,
  description: string
): string | null {
  if (!placeType || !description) return null;

  const isFoodType = ["restaurant", "bar", "cafe"].includes(placeType);
  const isNonFoodType = [
    "shop",
    "museum",
    "activity",
    "neighborhood",
  ].includes(placeType);

  if (isNonFoodType && FOOD_KEYWORDS.test(description)) {
    return "Non-food place with restaurant description keywords";
  }

  if (isFoodType && NON_FOOD_KEYWORDS.test(description)) {
    return "Food place with non-food description keywords";
  }

  return null;
}

function truncateDescription(desc: string, maxLength: number = 200): string {
  if (desc.length <= maxLength) return desc;
  return desc.substring(0, maxLength) + "...";
}

async function checkBatchWithClaude(
  client: Anthropic,
  batch: BatchCheckRequest[]
): Promise<
  Map<
    string,
    { flag: string | null; reasoning: string }
  >
> {
  const results = new Map<
    string,
    { flag: string | null; reasoning: string }
  >();

  // Format batch for Claude
  const batchText = batch
    .map(
      (item, idx) =>
        `${idx + 1}. Place: "${item.propertyName}" | Type: ${item.placeType || "unknown"} | Description: "${item.description}"`
    )
    .join("\n");

  const prompt = `You are an expert in place classification and content quality. Review the following place descriptions and flag any that contradict their assigned place type.

A mismatch occurs when:
- A non-food place (shop, museum, activity, neighborhood) has a description that clearly describes food/restaurant experience
- A food place (restaurant, bar, cafe) has a description that clearly describes something else (retail, hotel, museum, etc.)
- The description talks about a completely different kind of establishment

Places to review:
${batchText}

For each place, respond with only the entry number and a brief flag if there's a mismatch, or "OK" if the description matches the type. Format:
1. [FLAG or OK]: [brief reason if flagged, empty if OK]
2. [FLAG or OK]: [brief reason]
etc.`;

  try {
    const message = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";
    const lines = responseText.split("\n");

    for (let i = 0; i < batch.length; i++) {
      const batchItem = batch[i];
      const responseLine = lines.find((line) => line.startsWith(`${i + 1}.`));

      if (responseLine) {
        const hasFlag =
          responseLine.includes("FLAG") || responseLine.includes("Mismatch");
        const reasoning = responseLine
          .replace(/^\d+\.\s*/, "")
          .replace(/^(FLAG|OK):\s*/, "")
          .trim();

        results.set(batchItem.id, {
          flag: hasFlag ? "Mismatch detected by Claude" : null,
          reasoning: reasoning,
        });
      } else {
        results.set(batchItem.id, {
          flag: null,
          reasoning: "No Claude review performed",
        });
      }
    }
  } catch (error) {
    console.error("Claude API error:", error);
    // Return empty results on API failure
    for (const item of batch) {
      results.set(item.id, {
        flag: null,
        reasoning: `API error: ${error instanceof Error ? error.message : "Unknown"}`,
      });
    }
  }

  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitIndex = args.indexOf("--limit");
  const limit =
    limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : undefined;

  console.log("=== Terrazzo PlaceIntelligence Description Audit ===\n");

  // Fetch records to audit
  const records: AuditRecord[] = await prisma.placeIntelligence.findMany({
    where: {
      status: "complete",
      description: {
        not: null,
      },
    },
    select: {
      id: true,
      googlePlaceId: true,
      propertyName: true,
      placeType: true,
      description: true,
    },
    orderBy: {
      propertyName: "asc",
    },
    ...(limit ? { take: limit } : {}),
  });

  console.log(`Found ${records.length} records to audit.\n`);

  if (dryRun) {
    console.log("DRY RUN MODE: Skipping Claude checks.");
    console.log(
      `Would audit ${records.length} records in batches of 20.\n`
    );

    // Show local check summary
    const flaggedByLocal = records.filter((r) =>
      getLocalMismatchReason(r.placeType, r.description || "")
    );
    console.log(
      `Local pattern matching would flag ${flaggedByLocal.length} records.`
    );
    if (flaggedByLocal.length > 0) {
      console.log("Sample flagged records:");
      flaggedByLocal.slice(0, 5).forEach((r) => {
        console.log(
          `  - ${r.propertyName} (${r.placeType}): ${getLocalMismatchReason(r.placeType, r.description || "")}`
        );
      });
    }
    return;
  }

  // Initialize Anthropic client
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const results: AuditResult[] = [];

  // Process in batches
  const batchSize = 20;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    console.log(
      `Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} records)...`
    );

    // Get Claude results for this batch
    const claudeResults = await checkBatchWithClaude(
      anthropic,
      batch.map((r) => ({
        id: r.id,
        googlePlaceId: r.googlePlaceId,
        propertyName: r.propertyName,
        placeType: r.placeType,
        description: r.description || "",
      }))
    );

    // Combine results
    for (const record of batch) {
      const localFlag = getLocalMismatchReason(
        record.placeType,
        record.description || ""
      );
      const claudeResult = claudeResults.get(record.id);

      results.push({
        id: record.id,
        googlePlaceId: record.googlePlaceId,
        propertyName: record.propertyName,
        placeType: record.placeType,
        descriptionPreview: truncateDescription(record.description || ""),
        localCheckFlag: localFlag,
        claudeCheckFlag: claudeResult?.flag || null,
        claudeReasoning: claudeResult?.reasoning,
      });
    }

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < records.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Filter for flagged records
  const flaggedResults = results.filter(
    (r) => r.localCheckFlag || r.claudeCheckFlag
  );

  console.log(`\n=== Audit Results ===`);
  console.log(
    `Total records: ${records.length}`
  );
  console.log(
    `Flagged by local checks: ${results.filter((r) => r.localCheckFlag).length}`
  );
  console.log(
    `Flagged by Claude: ${results.filter((r) => r.claudeCheckFlag).length}`
  );
  console.log(
    `Total flagged (either check): ${flaggedResults.length}\n`
  );

  // Output JSON results
  console.log(JSON.stringify(flaggedResults, null, 2));
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
