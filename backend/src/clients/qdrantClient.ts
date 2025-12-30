/**
 * Qdrant Client for Backend Service
 *
 * Provides track existence checking for ingestion scheduling.
 * Used to skip scheduling for tracks already in the vector index.
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { getIngestionConfig } from "../config/ingestion.js";
import { hashIsrcToUuid } from "../utils/isrcHash.js";
import { logger } from "../utils/logger.js";
import type { TrackPayload } from "../types/trackMetadata.js";

/**
 * Backend Qdrant client wrapper
 *
 * Provides simplified API for track existence checking.
 * Does not provide full search functionality (that's in search-index service).
 */
export class BackendQdrantClient {
  private client: QdrantClient;
  private collection: string;

  constructor(url: string, collection: string) {
    this.client = new QdrantClient({ url });
    this.collection = collection;
  }

  /**
   * Check if tracks exist in the vector index by ISRCs
   *
   * Uses batch retrieve operation for efficiency.
   * Returns a map of ISRC -> exists (boolean).
   *
   * Implements fail-open behavior per FR-013:
   * If Qdrant is unavailable, returns empty map (all tracks assumed not to exist).
   *
   * @param isrcs - Array of ISRCs to check
   * @returns Map of ISRC to existence boolean
   */
  async checkTracksExist(isrcs: string[]): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>();

    if (isrcs.length === 0) {
      return result;
    }

    try {
      // Convert ISRCs to UUIDs
      const isrcToUuid = new Map<string, string>();
      const uuidToIsrc = new Map<string, string>();

      for (const isrc of isrcs) {
        try {
          const uuid = hashIsrcToUuid(isrc);
          const normalizedIsrc = isrc.toUpperCase();
          isrcToUuid.set(normalizedIsrc, uuid);
          uuidToIsrc.set(uuid, normalizedIsrc);
        } catch {
          // Invalid ISRC - mark as not existing
          result.set(isrc.toUpperCase(), false);
        }
      }

      if (uuidToIsrc.size === 0) {
        return result;
      }

      // Batch retrieve points by UUIDs
      const uuids = Array.from(uuidToIsrc.keys());
      const points = await this.client.retrieve(this.collection, {
        ids: uuids,
        with_payload: false,
        with_vector: false,
      });

      // Build existence map
      const existingUuids = new Set(points.map((p) => String(p.id)));

      for (const [uuid, isrc] of uuidToIsrc) {
        result.set(isrc, existingUuids.has(uuid));
      }

      // Mark invalid ISRCs as not existing
      for (const isrc of isrcs) {
        const normalized = isrc.toUpperCase();
        if (!result.has(normalized)) {
          result.set(normalized, false);
        }
      }

      return result;
    } catch (error) {
      // Fail-open: On Qdrant error, return empty map
      // This allows scheduling to proceed, letting the pipeline handle upsert
      logger.warn("qdrant_check_failed", {
        event: "qdrant_error",
        isrcCount: isrcs.length,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return empty map - all tracks assumed not to exist
      return new Map();
    }
  }

  /**
   * Check if a single track exists in the vector index
   *
   * @param isrc - ISRC to check
   * @returns true if track exists, false otherwise
   */
  async checkTrackExists(isrc: string): Promise<boolean> {
    const result = await this.checkTracksExist([isrc]);
    return result.get(isrc.toUpperCase()) ?? false;
  }

  /**
   * Health check for Qdrant connection
   *
   * @returns true if Qdrant is reachable
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.client.getCollections();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retrieve full track payload from Qdrant by ISRC
   *
   * Used by Track Metadata Display feature (008) to fetch
   * lyrics, interpretation, and audio features for display.
   *
   * Implements fail-open behavior:
   * If Qdrant is unavailable, returns null.
   *
   * @param isrc - ISRC to retrieve (will be normalized to uppercase)
   * @returns TrackPayload if found, null otherwise
   */
  async getTrackPayload(isrc: string): Promise<TrackPayload | null> {
    try {
      const normalizedIsrc = isrc.toUpperCase();
      const uuid = hashIsrcToUuid(normalizedIsrc);

      const points = await this.client.retrieve(this.collection, {
        ids: [uuid],
        with_payload: true,
        with_vector: false,
      });

      if (points.length === 0) {
        return null;
      }

      const payload = points[0].payload as Record<string, unknown>;

      return {
        isrc: String(payload.isrc ?? normalizedIsrc),
        title: String(payload.title ?? ''),
        artist: String(payload.artist ?? ''),
        album: String(payload.album ?? ''),
        lyrics: payload.lyrics != null ? String(payload.lyrics) : null,
        interpretation: payload.interpretation != null ? String(payload.interpretation) : null,
        acousticness: typeof payload.acousticness === 'number' ? payload.acousticness : null,
        danceability: typeof payload.danceability === 'number' ? payload.danceability : null,
        energy: typeof payload.energy === 'number' ? payload.energy : null,
        instrumentalness: typeof payload.instrumentalness === 'number' ? payload.instrumentalness : null,
        key: typeof payload.key === 'number' ? payload.key : null,
        liveness: typeof payload.liveness === 'number' ? payload.liveness : null,
        loudness: typeof payload.loudness === 'number' ? payload.loudness : null,
        mode: typeof payload.mode === 'number' ? payload.mode : null,
        speechiness: typeof payload.speechiness === 'number' ? payload.speechiness : null,
        tempo: typeof payload.tempo === 'number' ? payload.tempo : null,
        valence: typeof payload.valence === 'number' ? payload.valence : null,
      };
    } catch (error) {
      logger.warn("qdrant_get_payload_failed", {
        event: "qdrant_error",
        isrc,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}

/**
 * Create a new BackendQdrantClient instance
 *
 * Uses shared configuration from config/ingestion.ts if not provided.
 *
 * @param url - Qdrant server URL (default from config)
 * @param collection - Qdrant collection name (default from config)
 * @returns BackendQdrantClient instance
 */
export function createBackendQdrantClient(
  url?: string,
  collection?: string
): BackendQdrantClient {
  const config = getIngestionConfig();
  return new BackendQdrantClient(
    url ?? config.qdrant.url,
    collection ?? config.qdrant.collection
  );
}
