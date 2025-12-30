/**
 * IngestionScheduler Integration Tests
 *
 * Tests end-to-end flow of ingestion scheduling with real/mock services.
 * These tests verify the integration between:
 * - LibraryService -> IngestionScheduler -> Qdrant + Inngest
 *
 * Test categories:
 * - Qdrant connectivity tests (with test collection)
 * - Inngest event delivery tests (with mock server)
 * - End-to-end library addition -> scheduling flow
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { QdrantClient } from "@qdrant/js-client-rest";
import { BackendQdrantClient, createBackendQdrantClient } from "../../src/clients/qdrantClient.js";
import { IngestionScheduler } from "../../src/services/ingestionScheduler.js";
import { hashIsrcToUuid } from "../../src/utils/isrcHash.js";

// Test collection name to avoid polluting production data
const TEST_COLLECTION = "tracks-integration-test";
const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";

// Mock Inngest client for integration tests
vi.mock("../../src/clients/inngestClient.js", () => ({
  sendTrackIngestionEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock logger to reduce noise
vi.mock("../../src/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    ingestionScheduled: vi.fn(),
    ingestionSkipped: vi.fn(),
    ingestionError: vi.fn(),
    albumIngestionBatch: vi.fn(),
    albumTrackListingError: vi.fn(),
    qdrantCheckError: vi.fn(),
    inngestSendError: vi.fn(),
  },
}));

describe("IngestionScheduler Integration Tests", () => {
  let qdrantClient: QdrantClient;
  let backendClient: BackendQdrantClient;
  let scheduler: IngestionScheduler;
  let qdrantAvailable = false;

  beforeAll(async () => {
    // Check if Qdrant is available
    qdrantClient = new QdrantClient({ url: QDRANT_URL });

    try {
      await qdrantClient.getCollections();
      qdrantAvailable = true;

      // Create test collection
      const collections = await qdrantClient.getCollections();
      const exists = collections.collections.some((c) => c.name === TEST_COLLECTION);

      if (!exists) {
        await qdrantClient.createCollection(TEST_COLLECTION, {
          vectors: {
            size: 4096,
            distance: "Cosine",
          },
        });
      }

      backendClient = createBackendQdrantClient(QDRANT_URL, TEST_COLLECTION);
      scheduler = new IngestionScheduler(backendClient);
    } catch (error) {
      console.log("Qdrant not available, skipping integration tests");
    }
  });

  afterAll(async () => {
    if (qdrantAvailable) {
      // Clean up test collection
      try {
        await qdrantClient.deleteCollection(TEST_COLLECTION);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    if (qdrantAvailable) {
      // Clear all points from test collection
      try {
        // Delete and recreate to ensure clean state
        await qdrantClient.deleteCollection(TEST_COLLECTION);
        await qdrantClient.createCollection(TEST_COLLECTION, {
          vectors: {
            size: 4096,
            distance: "Cosine",
          },
        });
      } catch {
        // Ignore errors
      }
    }
  });

  // ==========================================================================
  // Qdrant Connectivity Tests
  // ==========================================================================
  describe("Qdrant Connectivity", () => {
    test("BackendQdrantClient.isHealthy() returns true when Qdrant is available", async () => {
      if (!qdrantAvailable) {
        console.log("Skipping: Qdrant not available");
        return;
      }

      const isHealthy = await backendClient.isHealthy();
      expect(isHealthy).toBe(true);
    });

    test("checkTracksExist returns false for non-existent tracks", async () => {
      if (!qdrantAvailable) {
        console.log("Skipping: Qdrant not available");
        return;
      }

      const result = await backendClient.checkTracksExist(["USRC11700001"]);
      expect(result.get("USRC11700001")).toBe(false);
    });

    test("checkTracksExist returns true for existing tracks", async () => {
      if (!qdrantAvailable) {
        console.log("Skipping: Qdrant not available");
        return;
      }

      // Insert a test track
      const isrc = "USRC11700001";
      const uuid = hashIsrcToUuid(isrc);

      await qdrantClient.upsert(TEST_COLLECTION, {
        wait: true,
        points: [
          {
            id: uuid,
            vector: new Array(4096).fill(0.1),
            payload: { isrc },
          },
        ],
      });

      const result = await backendClient.checkTracksExist([isrc]);
      expect(result.get(isrc)).toBe(true);
    });

    test("checkTracksExist handles batch of ISRCs", async () => {
      if (!qdrantAvailable) {
        console.log("Skipping: Qdrant not available");
        return;
      }

      // Insert some tracks
      const existingIsrcs = ["USRC11700001", "USRC11700002"];
      const nonExistingIsrcs = ["USRC11700003", "USRC11700004"];
      const allIsrcs = [...existingIsrcs, ...nonExistingIsrcs];

      // Insert existing tracks
      const points = existingIsrcs.map((isrc) => ({
        id: hashIsrcToUuid(isrc),
        vector: new Array(4096).fill(0.1),
        payload: { isrc },
      }));

      await qdrantClient.upsert(TEST_COLLECTION, {
        wait: true,
        points,
      });

      const result = await backendClient.checkTracksExist(allIsrcs);

      expect(result.get("USRC11700001")).toBe(true);
      expect(result.get("USRC11700002")).toBe(true);
      expect(result.get("USRC11700003")).toBe(false);
      expect(result.get("USRC11700004")).toBe(false);
    });
  });

  // ==========================================================================
  // Scheduler + Qdrant Integration
  // ==========================================================================
  describe("Scheduler with Real Qdrant", () => {
    test("scheduleTrack skips already-indexed tracks", async () => {
      if (!qdrantAvailable) {
        console.log("Skipping: Qdrant not available");
        return;
      }

      const { sendTrackIngestionEvent } = await import(
        "../../src/clients/inngestClient.js"
      );

      // Insert track into Qdrant
      const isrc = "USRC11700099";
      const uuid = hashIsrcToUuid(isrc);

      await qdrantClient.upsert(TEST_COLLECTION, {
        wait: true,
        points: [
          {
            id: uuid,
            vector: new Array(4096).fill(0.1),
            payload: { isrc },
          },
        ],
      });

      // Try to schedule the same track
      const result = await scheduler.scheduleTrack({
        isrc,
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
      });

      expect(result.scheduled).toBe(false);
      expect(result.reason).toBe("already_indexed");
      expect(sendTrackIngestionEvent).not.toHaveBeenCalled();
    });

    test("scheduleTrack sends event for new tracks", async () => {
      if (!qdrantAvailable) {
        console.log("Skipping: Qdrant not available");
        return;
      }

      const { sendTrackIngestionEvent } = await import(
        "../../src/clients/inngestClient.js"
      );

      const result = await scheduler.scheduleTrack({
        isrc: "USRC11700088",
        title: "New Track",
        artist: "New Artist",
        album: "New Album",
      });

      expect(result.scheduled).toBe(true);
      expect(sendTrackIngestionEvent).toHaveBeenCalledWith({
        isrc: "USRC11700088",
        title: "New Track",
        artist: "New Artist",
        album: "New Album",
      });
    });

    test("scheduleAlbumTracks correctly filters existing tracks", async () => {
      if (!qdrantAvailable) {
        console.log("Skipping: Qdrant not available");
        return;
      }

      const { sendTrackIngestionEvent } = await import(
        "../../src/clients/inngestClient.js"
      );

      // Insert some tracks
      const existingIsrc = "USRC11700001";
      await qdrantClient.upsert(TEST_COLLECTION, {
        wait: true,
        points: [
          {
            id: hashIsrcToUuid(existingIsrc),
            vector: new Array(4096).fill(0.1),
            payload: { isrc: existingIsrc },
          },
        ],
      });

      const result = await scheduler.scheduleAlbumTracks({
        albumTitle: "Test Album",
        artistName: "Test Artist",
        tracks: [
          { isrc: "USRC11700001", title: "Track 1 (exists)" },
          { isrc: "USRC11700002", title: "Track 2 (new)" },
          { isrc: "USRC11700003", title: "Track 3 (new)" },
        ],
      });

      expect(result.totalTracks).toBe(3);
      expect(result.scheduledCount).toBe(2);
      expect(result.skippedCount).toBe(1);

      // Should only send 2 events
      expect(sendTrackIngestionEvent).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // Performance Tests
  // ==========================================================================
  describe("Performance", () => {
    test("scheduleAlbumTracks completes within 5 seconds for 20 tracks", async () => {
      if (!qdrantAvailable) {
        console.log("Skipping: Qdrant not available");
        return;
      }

      const tracks = Array.from({ length: 20 }, (_, i) => ({
        isrc: `USRC117000${String(i).padStart(2, "0")}`,
        title: `Track ${i + 1}`,
      }));

      const startTime = Date.now();

      await scheduler.scheduleAlbumTracks({
        albumTitle: "Large Album",
        artistName: "Test Artist",
        tracks,
      });

      const duration = Date.now() - startTime;

      // Should complete well within 5 seconds (FR-007)
      expect(duration).toBeLessThan(5000);
    });
  });

  // ==========================================================================
  // Fail-Open Behavior (Mock Qdrant Failure)
  // ==========================================================================
  describe("Fail-Open Behavior", () => {
    test("scheduler proceeds when Qdrant client throws", async () => {
      const { sendTrackIngestionEvent } = await import(
        "../../src/clients/inngestClient.js"
      );

      // Create scheduler with failing Qdrant client
      const failingClient = {
        checkTracksExist: vi.fn().mockRejectedValue(new Error("Connection refused")),
        checkTrackExists: vi.fn().mockRejectedValue(new Error("Connection refused")),
        isHealthy: vi.fn().mockResolvedValue(false),
      } as unknown as BackendQdrantClient;

      const failingScheduler = new IngestionScheduler(failingClient);

      const result = await failingScheduler.scheduleTrack({
        isrc: "USRC11700001",
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
      });

      // Should still schedule (fail-open)
      expect(result.scheduled).toBe(true);
      expect(sendTrackIngestionEvent).toHaveBeenCalled();
    });
  });
});
