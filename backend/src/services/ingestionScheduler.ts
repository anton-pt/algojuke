/**
 * Ingestion Scheduler Service
 *
 * Handles automatic scheduling of track ingestion when users add tracks or
 * albums to their library. Integrates with:
 * - Qdrant: To check if tracks already exist in the vector index
 * - Inngest: To schedule track ingestion tasks
 *
 * Key behaviors:
 * - ISRC-based idempotency (normalized to uppercase)
 * - Fail-open on Qdrant unavailability (proceed with scheduling)
 * - Fire-and-forget pattern (errors logged but not thrown)
 * - Individual task scheduling with parallel execution for albums
 * - Configurable concurrency limit for large albums
 */

import { sendTrackIngestionEvent } from "../clients/inngestClient.js";
import type { BackendQdrantClient } from "../clients/qdrantClient.js";
import { getIngestionConfig } from "../config/ingestion.js";
import { isValidIsrc } from "../utils/isrc.js";
import { logger } from "../utils/logger.js";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Execute promises with concurrency limit
 *
 * @param items - Array of items to process
 * @param fn - Async function to apply to each item
 * @param concurrency - Max concurrent operations
 * @returns Array of results in same order as items
 */
async function parallelWithLimit<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await fn(items[currentIndex]);
    }
  }

  // Create workers up to concurrency limit
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );

  await Promise.all(workers);
  return results;
}

// ============================================================================
// Types
// ============================================================================

/**
 * Request to schedule a single track for ingestion
 */
export interface TrackIngestionRequest {
  isrc: string;
  title: string;
  artist: string;
  album: string;
}

/**
 * Result of scheduling a single track
 */
export interface TrackSchedulingResult {
  scheduled: boolean;
  reason?:
    | "already_indexed"
    | "missing_isrc"
    | "invalid_isrc"
    | "inngest_error";
}

/**
 * Track info for album batch scheduling
 */
export interface AlbumTrackInfo {
  isrc: string;
  title: string;
}

/**
 * Request to schedule all tracks from an album
 */
export interface AlbumTracksIngestionRequest {
  albumTitle: string;
  artistName: string;
  tracks: AlbumTrackInfo[];
}

/**
 * Individual track result in batch
 */
export interface TrackBatchResult {
  isrc: string;
  title: string;
  scheduled: boolean;
  reason?: TrackSchedulingResult["reason"];
}

/**
 * Result of batch scheduling for an album
 */
export interface BatchSchedulingResult {
  totalTracks: number;
  scheduledCount: number;
  skippedCount: number;
  results: TrackBatchResult[];
}

// ============================================================================
// IngestionScheduler Class
// ============================================================================

/**
 * Service for scheduling track ingestion tasks
 */
export class IngestionScheduler {
  private qdrantClient: BackendQdrantClient;

  constructor(qdrantClient: BackendQdrantClient) {
    this.qdrantClient = qdrantClient;
  }

  /**
   * Schedule a single track for ingestion
   *
   * Checks if track exists in Qdrant first, then sends to Inngest if not.
   * Implements fire-and-forget pattern - errors are logged but not thrown.
   *
   * @param request - Track data to schedule
   * @returns Scheduling result
   */
  async scheduleTrack(
    request: TrackIngestionRequest
  ): Promise<TrackSchedulingResult> {
    const startTime = Date.now();

    // Validate ISRC
    if (!request.isrc || request.isrc.trim() === "") {
      logger.ingestionSkipped(request.isrc, request.title, "missing_isrc");
      return { scheduled: false, reason: "missing_isrc" };
    }

    if (!isValidIsrc(request.isrc)) {
      logger.ingestionSkipped(request.isrc, request.title, "invalid_isrc");
      return { scheduled: false, reason: "invalid_isrc" };
    }

    // Normalize ISRC to uppercase
    const normalizedIsrc = request.isrc.toUpperCase();

    // Check if track exists in Qdrant (fail-open)
    let exists = false;
    try {
      const existsMap = await this.qdrantClient.checkTracksExist([
        normalizedIsrc,
      ]);
      exists = existsMap.get(normalizedIsrc) ?? false;
    } catch (error) {
      // Fail-open: Assume not indexed and proceed with scheduling
      logger.qdrantCheckError(
        1,
        error instanceof Error ? error.message : String(error)
      );
    }

    if (exists) {
      logger.ingestionSkipped(normalizedIsrc, request.title, "already_indexed");
      return { scheduled: false, reason: "already_indexed" };
    }

    // Send to Inngest (fire-and-forget)
    try {
      await sendTrackIngestionEvent({
        isrc: normalizedIsrc,
        title: request.title,
        artist: request.artist,
        album: request.album,
      });

      const durationMs = Date.now() - startTime;
      logger.ingestionScheduled(normalizedIsrc, request.title, durationMs);
      return { scheduled: true };
    } catch (error) {
      logger.inngestSendError(
        normalizedIsrc,
        error instanceof Error ? error.message : String(error)
      );
      return { scheduled: false, reason: "inngest_error" };
    }
  }

  /**
   * Schedule all tracks from an album for ingestion
   *
   * Batch checks Qdrant for existing tracks, then schedules non-existing ones
   * in parallel with a configurable concurrency limit.
   *
   * Each track is scheduled as an individual task (no batch events).
   *
   * @param request - Album tracks data
   * @param concurrency - Max parallel scheduling operations (default: 10)
   * @returns Batch scheduling results
   */
  async scheduleAlbumTracks(
    request: AlbumTracksIngestionRequest,
    concurrency?: number
  ): Promise<BatchSchedulingResult> {
    const config = getIngestionConfig();
    const effectiveConcurrency = concurrency ?? config.scheduling.concurrency;
    const startTime = Date.now();
    const results: TrackBatchResult[] = [];

    // Separate valid and invalid tracks
    const validTracks: Array<{ isrc: string; title: string }> = [];

    for (const track of request.tracks) {
      if (!track.isrc || track.isrc.trim() === "") {
        results.push({
          isrc: track.isrc,
          title: track.title,
          scheduled: false,
          reason: "missing_isrc",
        });
        logger.ingestionSkipped(track.isrc, track.title, "missing_isrc");
      } else if (!isValidIsrc(track.isrc)) {
        results.push({
          isrc: track.isrc,
          title: track.title,
          scheduled: false,
          reason: "invalid_isrc",
        });
        logger.ingestionSkipped(track.isrc, track.title, "invalid_isrc");
      } else {
        validTracks.push({
          isrc: track.isrc.toUpperCase(),
          title: track.title,
        });
      }
    }

    const invalidCount = results.length;

    if (validTracks.length === 0) {
      const durationMs = Date.now() - startTime;
      this.logSchedulingResult(request.albumTitle, request.tracks.length, 0, invalidCount, durationMs);
      return {
        totalTracks: request.tracks.length,
        scheduledCount: 0,
        skippedCount: invalidCount,
        results,
      };
    }

    // Batch check Qdrant for existing tracks (fail-open)
    let existsMap = new Map<string, boolean>();
    try {
      existsMap = await this.qdrantClient.checkTracksExist(
        validTracks.map((t) => t.isrc)
      );
    } catch (error) {
      // Fail-open: Assume none are indexed
      logger.qdrantCheckError(
        validTracks.length,
        error instanceof Error ? error.message : String(error)
      );
    }

    // Separate tracks into already-indexed and to-schedule
    const tracksToSchedule: Array<{ isrc: string; title: string }> = [];

    for (const track of validTracks) {
      const exists = existsMap.get(track.isrc) ?? false;
      if (exists) {
        results.push({
          isrc: track.isrc,
          title: track.title,
          scheduled: false,
          reason: "already_indexed",
        });
        logger.ingestionSkipped(track.isrc, track.title, "already_indexed");
      } else {
        tracksToSchedule.push(track);
      }
    }

    // Schedule tracks in parallel with concurrency limit
    const schedulingResults = await parallelWithLimit(
      tracksToSchedule,
      async (track) => {
        try {
          await sendTrackIngestionEvent({
            isrc: track.isrc,
            title: track.title,
            artist: request.artistName,
            album: request.albumTitle,
          });
          return { ...track, scheduled: true } as TrackBatchResult;
        } catch (error) {
          logger.inngestSendError(
            track.isrc,
            error instanceof Error ? error.message : String(error)
          );
          return {
            ...track,
            scheduled: false,
            reason: "inngest_error" as const,
          };
        }
      },
      effectiveConcurrency
    );

    // Combine results
    results.push(...schedulingResults);

    // Count results
    const scheduledCount = schedulingResults.filter((r) => r.scheduled).length;
    const skippedCount = results.filter((r) => !r.scheduled).length;

    const durationMs = Date.now() - startTime;
    this.logSchedulingResult(
      request.albumTitle,
      request.tracks.length,
      scheduledCount,
      skippedCount,
      durationMs
    );

    return {
      totalTracks: request.tracks.length,
      scheduledCount,
      skippedCount,
      results,
    };
  }

  /**
   * Log scheduling result with SLA check
   *
   * Logs batch scheduling results and warns if duration exceeds SLA threshold.
   *
   * @param albumTitle - Album title for logging
   * @param totalTracks - Total tracks in album
   * @param scheduledCount - Number of tracks scheduled
   * @param skippedCount - Number of tracks skipped
   * @param durationMs - Total scheduling duration in milliseconds
   */
  private logSchedulingResult(
    albumTitle: string,
    totalTracks: number,
    scheduledCount: number,
    skippedCount: number,
    durationMs: number
  ): void {
    const config = getIngestionConfig();
    const slaThresholdMs = config.scheduling.slaMs;
    const slaStatus = durationMs <= slaThresholdMs ? "PASS" : "FAIL";

    logger.albumIngestionBatch(
      albumTitle,
      totalTracks,
      scheduledCount,
      skippedCount,
      durationMs
    );

    // Log SLA warning if exceeded
    if (durationMs > slaThresholdMs) {
      logger.warn("scheduling_sla_exceeded", {
        albumTitle,
        totalTracks,
        scheduledCount,
        durationMs,
        slaThresholdMs,
        slaStatus,
      });
    }
  }

  /**
   * Check if tracks exist in the vector index
   *
   * Wrapper around Qdrant client with fail-open behavior.
   *
   * @param isrcs - ISRCs to check
   * @returns Map of ISRC to existence boolean
   */
  async checkTracksExist(isrcs: string[]): Promise<Map<string, boolean>> {
    try {
      return await this.qdrantClient.checkTracksExist(isrcs);
    } catch (error) {
      logger.qdrantCheckError(
        isrcs.length,
        error instanceof Error ? error.message : String(error)
      );
      return new Map();
    }
  }
}
