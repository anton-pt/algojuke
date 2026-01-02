#!/usr/bin/env npx tsx

/**
 * Backfill Short Descriptions Script
 *
 * Processes existing tracks in Qdrant that don't have short descriptions.
 * Uses Qdrant scroll API for pagination and saves progress for resumability.
 *
 * Rate limit: 1 track every 2 seconds (30 tracks/minute)
 *
 * Usage:
 *   npx tsx scripts/backfill-short-descriptions.ts
 *   npx tsx scripts/backfill-short-descriptions.ts --reset  # Start from beginning
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { createAnthropicClient } from "../src/clients/anthropic.js";
import {
  buildShortDescriptionPrompt,
  buildInstrumentalShortDescriptionPrompt,
  buildMetadataOnlyShortDescriptionPrompt,
  type AudioFeatures,
} from "../src/prompts/shortDescription.js";
import {
  BackfillProgress,
  createInitialProgress,
  validateBackfillProgress,
} from "../src/schemas/backfillProgress.js";
import {
  createBackfillTrace,
  createGenerationSpan,
  createSearchSpan,
  flushLangfuse,
} from "../src/observability/langfuse.js";

// Configuration
const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION ?? "tracks";
const PROGRESS_FILE = ".backfill-progress.json";
const DELAY_MS = 2000; // 2 seconds between tracks
const SCROLL_LIMIT = 100; // Tracks per scroll batch

/**
 * Track document payload from Qdrant
 */
interface TrackPayload {
  isrc: string;
  title: string;
  artist: string;
  album: string;
  interpretation?: string | null;
  short_description?: string | null;
  acousticness?: number | null;
  danceability?: number | null;
  energy?: number | null;
  instrumentalness?: number | null;
  liveness?: number | null;
  loudness?: number | null;
  speechiness?: number | null;
  tempo?: number | null;
  valence?: number | null;
  key?: number | null;
  mode?: number | null;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Load progress from file or create initial state
 */
function loadProgress(): BackfillProgress {
  if (existsSync(PROGRESS_FILE)) {
    try {
      const data = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
      return validateBackfillProgress(data);
    } catch (error) {
      console.error("Failed to load progress file, starting fresh:", error);
    }
  }
  return createInitialProgress();
}

/**
 * Save progress to file
 */
function saveProgress(progress: BackfillProgress): void {
  progress.updatedAt = new Date().toISOString();
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Extract audio features from payload
 */
function extractAudioFeatures(payload: TrackPayload): AudioFeatures | null {
  const features: AudioFeatures = {};
  let hasFeatures = false;

  if (payload.acousticness !== null && payload.acousticness !== undefined) {
    features.acousticness = payload.acousticness;
    hasFeatures = true;
  }
  if (payload.danceability !== null && payload.danceability !== undefined) {
    features.danceability = payload.danceability;
    hasFeatures = true;
  }
  if (payload.energy !== null && payload.energy !== undefined) {
    features.energy = payload.energy;
    hasFeatures = true;
  }
  if (payload.instrumentalness !== null && payload.instrumentalness !== undefined) {
    features.instrumentalness = payload.instrumentalness;
    hasFeatures = true;
  }
  if (payload.liveness !== null && payload.liveness !== undefined) {
    features.liveness = payload.liveness;
    hasFeatures = true;
  }
  if (payload.loudness !== null && payload.loudness !== undefined) {
    features.loudness = payload.loudness;
    hasFeatures = true;
  }
  if (payload.speechiness !== null && payload.speechiness !== undefined) {
    features.speechiness = payload.speechiness;
    hasFeatures = true;
  }
  if (payload.tempo !== null && payload.tempo !== undefined) {
    features.tempo = payload.tempo;
    hasFeatures = true;
  }
  if (payload.valence !== null && payload.valence !== undefined) {
    features.valence = payload.valence;
    hasFeatures = true;
  }
  if (payload.key !== null && payload.key !== undefined) {
    features.key = payload.key;
    hasFeatures = true;
  }
  if (payload.mode !== null && payload.mode !== undefined) {
    features.mode = payload.mode;
    hasFeatures = true;
  }

  return hasFeatures ? features : null;
}

/**
 * Format ETA based on remaining tracks and rate
 */
function formatETA(remaining: number): string {
  const seconds = remaining * (DELAY_MS / 1000);
  if (seconds < 60) {
    return `${Math.ceil(seconds)}s`;
  }
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Main backfill function
 */
async function main(): Promise<void> {
  // Check for --reset flag
  const args = process.argv.slice(2);
  const shouldReset = args.includes("--reset");

  if (shouldReset && existsSync(PROGRESS_FILE)) {
    console.log("Resetting progress...");
    const fresh = createInitialProgress();
    saveProgress(fresh);
  }

  console.log("Starting short description backfill...");
  console.log(`Qdrant URL: ${QDRANT_URL}`);
  console.log(`Collection: ${QDRANT_COLLECTION}`);
  console.log(`Rate: 1 track every ${DELAY_MS / 1000} seconds`);
  console.log("");

  // Initialize clients
  const qdrant = new QdrantClient({ url: QDRANT_URL });
  const anthropic = createAnthropicClient();

  // Load or create progress
  let progress = loadProgress();
  console.log(`Resuming from: ${progress.processedCount} processed, ${progress.successCount} success, ${progress.errorCount} errors, ${progress.skippedCount} skipped`);

  // Create observability trace for this backfill run
  const runId = `backfill-${Date.now()}`;
  const trace = createBackfillTrace(runId);

  // Get total count first
  const collectionInfo = await qdrant.getCollection(QDRANT_COLLECTION);
  const totalPoints = collectionInfo.points_count ?? 0;
  console.log(`Total tracks in collection: ${totalPoints}`);
  console.log("");

  let offset: string | number | null | undefined = progress.lastPointId;
  let continueScrolling = true;

  while (continueScrolling) {
    // Scroll for next batch
    const scrollSpan = createSearchSpan(trace, {
      name: "qdrant-scroll",
      collection: QDRANT_COLLECTION,
      operation: "scroll",
      metadata: { offset, limit: SCROLL_LIMIT },
    });

    const scrollResult = await qdrant.scroll(QDRANT_COLLECTION, {
      offset: offset ?? undefined,
      limit: SCROLL_LIMIT,
      with_payload: true,
      with_vector: false,
    });

    scrollSpan.end({
      pointCount: scrollResult.points.length,
      durationMs: 0, // Not tracked for simplicity
    });

    const points = scrollResult.points;

    if (points.length === 0) {
      continueScrolling = false;
      break;
    }

    // Process each point
    for (const point of points) {
      const payload = point.payload as TrackPayload;
      const pointId = String(point.id);

      // Skip if already has short description
      if (payload.short_description) {
        progress.skippedCount++;
        progress.processedCount++;
        progress.lastPointId = pointId;
        saveProgress(progress);
        continue;
      }

      const remaining = totalPoints - progress.processedCount;
      const eta = formatETA(remaining);
      console.log(`[${progress.processedCount + 1}/${totalPoints}] Processing: ${payload.title} by ${payload.artist} (ETA: ${eta})`);

      // Generate short description
      const generationSpan = createGenerationSpan(trace, {
        name: "llm-short-description-backfill",
        model: "claude-haiku-4-5-20251001",
        prompt: "",
        metadata: { isrc: payload.isrc, hasInterpretation: !!payload.interpretation },
      });

      try {
        let prompt: string;
        const audioFeatures = extractAudioFeatures(payload);

        if (payload.interpretation) {
          prompt = buildShortDescriptionPrompt(
            payload.title,
            payload.artist,
            payload.interpretation
          );
        } else if (audioFeatures) {
          prompt = buildInstrumentalShortDescriptionPrompt(
            payload.title,
            payload.artist,
            payload.album,
            audioFeatures
          );
        } else {
          prompt = buildMetadataOnlyShortDescriptionPrompt(
            payload.title,
            payload.artist,
            payload.album
          );
        }

        const result = await anthropic.generateShortDescription(prompt);

        generationSpan.end({
          completion: result.text,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        });

        // Update the document in Qdrant
        await qdrant.setPayload(QDRANT_COLLECTION, {
          points: [pointId],
          payload: {
            short_description: result.text,
          },
        });

        console.log(`  -> ${result.text.substring(0, 80)}...`);
        progress.successCount++;
      } catch (error) {
        generationSpan.end({
          completion: "",
          inputTokens: 0,
          outputTokens: 0,
        });

        console.error(`  -> Error: ${error instanceof Error ? error.message : "Unknown error"}`);
        progress.errorCount++;
      }

      progress.processedCount++;
      progress.lastPointId = pointId;
      saveProgress(progress);

      // Rate limit delay
      await sleep(DELAY_MS);
    }

    // Update offset for next scroll
    offset = scrollResult.next_page_offset ?? null;
    if (!offset) {
      continueScrolling = false;
    }
  }

  // Mark complete
  progress.isComplete = true;
  saveProgress(progress);

  // Flush observability data
  await flushLangfuse();

  console.log("");
  console.log("Backfill complete!");
  console.log(`  Processed: ${progress.processedCount}`);
  console.log(`  Success: ${progress.successCount}`);
  console.log(`  Errors: ${progress.errorCount}`);
  console.log(`  Skipped: ${progress.skippedCount}`);
}

// Run
main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
