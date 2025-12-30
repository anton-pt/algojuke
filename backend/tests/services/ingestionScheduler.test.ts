/**
 * IngestionScheduler Service Tests
 *
 * Tests for the ingestion scheduling service that handles automatic
 * scheduling of track ingestion when users add tracks/albums to their library.
 *
 * Test organization:
 * - Contract tests: Interface validation (US1 T011, US2 T020)
 * - Unit tests: ISRC normalization, duplicate detection (US3 T029, T030)
 * - Behavior tests: Fire-and-forget, fail-open (US5 T035, T036)
 */

import { describe, test, expect, beforeEach, vi, type Mock } from "vitest";
import { IngestionScheduler } from "../../src/services/ingestionScheduler.js";
import type { BackendQdrantClient } from "../../src/clients/qdrantClient.js";

// Mock the Inngest client
vi.mock("../../src/clients/inngestClient.js", () => ({
  sendTrackIngestionEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock the logger
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

describe("IngestionScheduler", () => {
  let scheduler: IngestionScheduler;
  let mockQdrantClient: {
    checkTracksExist: Mock;
    checkTrackExists: Mock;
    isHealthy: Mock;
  };
  let mockSendEvent: Mock;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create mock Qdrant client
    mockQdrantClient = {
      checkTracksExist: vi.fn().mockResolvedValue(new Map()),
      checkTrackExists: vi.fn().mockResolvedValue(false),
      isHealthy: vi.fn().mockResolvedValue(true),
    };

    // Get the mocked sendTrackIngestionEvent
    const inngestClient = await import("../../src/clients/inngestClient.js");
    mockSendEvent = inngestClient.sendTrackIngestionEvent as Mock;

    scheduler = new IngestionScheduler(
      mockQdrantClient as unknown as BackendQdrantClient
    );
  });

  // ==========================================================================
  // US1 T011: Contract test for scheduleTrack()
  // ==========================================================================
  describe("scheduleTrack() - Contract Tests (US1 T011)", () => {
    test("accepts TrackIngestionRequest and returns TrackSchedulingResult", async () => {
      const request = {
        isrc: "USRC11700001",
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
      };

      const result = await scheduler.scheduleTrack(request);

      // Verify result structure
      expect(result).toBeDefined();
      expect(typeof result.scheduled).toBe("boolean");
      expect(result.reason === undefined || typeof result.reason === "string").toBe(true);
    });

    test("returns scheduled: true for new tracks", async () => {
      mockQdrantClient.checkTracksExist.mockResolvedValue(
        new Map([["USRC11700001", false]])
      );

      const result = await scheduler.scheduleTrack({
        isrc: "USRC11700001",
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
      });

      expect(result.scheduled).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    test("returns scheduled: false with reason for already indexed tracks", async () => {
      mockQdrantClient.checkTracksExist.mockResolvedValue(
        new Map([["USRC11700001", true]])
      );

      const result = await scheduler.scheduleTrack({
        isrc: "USRC11700001",
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
      });

      expect(result.scheduled).toBe(false);
      expect(result.reason).toBe("already_indexed");
    });

    test("sends event to Inngest when track is not indexed", async () => {
      mockQdrantClient.checkTracksExist.mockResolvedValue(
        new Map([["USRC11700001", false]])
      );

      await scheduler.scheduleTrack({
        isrc: "USRC11700001",
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
      });

      expect(mockSendEvent).toHaveBeenCalledWith({
        isrc: "USRC11700001",
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
      });
    });

    test("does not send event when track is already indexed", async () => {
      mockQdrantClient.checkTracksExist.mockResolvedValue(
        new Map([["USRC11700001", true]])
      );

      await scheduler.scheduleTrack({
        isrc: "USRC11700001",
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
      });

      expect(mockSendEvent).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // US2 T020: Contract test for scheduleAlbumTracks()
  // ==========================================================================
  describe("scheduleAlbumTracks() - Contract Tests (US2 T020)", () => {
    test("returns BatchSchedulingResult with individual results per track", async () => {
      mockQdrantClient.checkTracksExist.mockResolvedValue(new Map());

      const result = await scheduler.scheduleAlbumTracks({
        albumTitle: "Test Album",
        artistName: "Test Artist",
        tracks: [
          { isrc: "USRC11700001", title: "Track 1" },
          { isrc: "USRC11700002", title: "Track 2" },
        ],
      });

      // Verify result structure
      expect(result).toBeDefined();
      expect(typeof result.totalTracks).toBe("number");
      expect(typeof result.scheduledCount).toBe("number");
      expect(typeof result.skippedCount).toBe("number");
      expect(Array.isArray(result.results)).toBe(true);
    });

    test("schedules individual tracks and returns per-track results", async () => {
      mockQdrantClient.checkTracksExist.mockResolvedValue(
        new Map([
          ["USRC11700001", false],
          ["USRC11700002", false],
        ])
      );

      const result = await scheduler.scheduleAlbumTracks({
        albumTitle: "Test Album",
        artistName: "Test Artist",
        tracks: [
          { isrc: "USRC11700001", title: "Track 1" },
          { isrc: "USRC11700002", title: "Track 2" },
        ],
      });

      expect(result.totalTracks).toBe(2);
      expect(result.scheduledCount).toBe(2);
      expect(result.skippedCount).toBe(0);
      expect(result.results).toHaveLength(2);
    });

    test("returns mixed results when some tracks already indexed", async () => {
      mockQdrantClient.checkTracksExist.mockResolvedValue(
        new Map([
          ["USRC11700001", true], // Already indexed
          ["USRC11700002", false], // New
        ])
      );

      const result = await scheduler.scheduleAlbumTracks({
        albumTitle: "Test Album",
        artistName: "Test Artist",
        tracks: [
          { isrc: "USRC11700001", title: "Track 1" },
          { isrc: "USRC11700002", title: "Track 2" },
        ],
      });

      expect(result.totalTracks).toBe(2);
      expect(result.scheduledCount).toBe(1);
      expect(result.skippedCount).toBe(1);
    });

    test("sends individual events per track (not batched)", async () => {
      mockQdrantClient.checkTracksExist.mockResolvedValue(new Map());

      await scheduler.scheduleAlbumTracks({
        albumTitle: "Test Album",
        artistName: "Test Artist",
        tracks: [
          { isrc: "USRC11700001", title: "Track 1" },
          { isrc: "USRC11700002", title: "Track 2" },
          { isrc: "USRC11700003", title: "Track 3" },
        ],
      });

      // Should have 3 separate calls, not 1 batched call
      expect(mockSendEvent).toHaveBeenCalledTimes(3);
    });
  });

  // ==========================================================================
  // US3 T029: ISRC normalization tests
  // ==========================================================================
  describe("ISRC Normalization (US3 T029)", () => {
    test("normalizes lowercase ISRC to uppercase", async () => {
      mockQdrantClient.checkTracksExist.mockResolvedValue(new Map());

      await scheduler.scheduleTrack({
        isrc: "usrc11700001",
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
      });

      // Should check with uppercase
      expect(mockQdrantClient.checkTracksExist).toHaveBeenCalledWith([
        "USRC11700001",
      ]);

      // Should send with uppercase
      expect(mockSendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          isrc: "USRC11700001",
        })
      );
    });

    test("handles mixed case ISRC", async () => {
      mockQdrantClient.checkTracksExist.mockResolvedValue(new Map());

      await scheduler.scheduleTrack({
        isrc: "UsRc11700001",
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
      });

      expect(mockSendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          isrc: "USRC11700001",
        })
      );
    });
  });

  // ==========================================================================
  // US3 T030: Duplicate detection via Qdrant mock
  // ==========================================================================
  describe("Duplicate Detection (US3 T030)", () => {
    test("returns already_indexed when track exists in Qdrant", async () => {
      mockQdrantClient.checkTracksExist.mockResolvedValue(
        new Map([["USRC11700001", true]])
      );

      const result = await scheduler.scheduleTrack({
        isrc: "USRC11700001",
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
      });

      expect(result.scheduled).toBe(false);
      expect(result.reason).toBe("already_indexed");
    });

    test("does not call Inngest when track exists", async () => {
      mockQdrantClient.checkTracksExist.mockResolvedValue(
        new Map([["USRC11700001", true]])
      );

      await scheduler.scheduleTrack({
        isrc: "USRC11700001",
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
      });

      expect(mockSendEvent).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // US5 T035: Fire-and-forget pattern - Inngest errors don't propagate
  // ==========================================================================
  describe("Fire-and-Forget Pattern (US5 T035)", () => {
    test("catches Inngest errors and does not propagate to caller", async () => {
      mockQdrantClient.checkTracksExist.mockResolvedValue(new Map());
      mockSendEvent.mockRejectedValue(new Error("Inngest unavailable"));

      // Should not throw
      const result = await scheduler.scheduleTrack({
        isrc: "USRC11700001",
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
      });

      // Returns error result but doesn't throw
      expect(result.scheduled).toBe(false);
      expect(result.reason).toBe("inngest_error");
    });

    test("logs Inngest error but continues", async () => {
      const { logger } = await import("../../src/utils/logger.js");
      mockQdrantClient.checkTracksExist.mockResolvedValue(new Map());
      mockSendEvent.mockRejectedValue(new Error("Connection refused"));

      await scheduler.scheduleTrack({
        isrc: "USRC11700001",
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
      });

      expect(logger.inngestSendError).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // US5 T036: Fail-open on Qdrant error
  // ==========================================================================
  describe("Fail-Open on Qdrant Error (US5 T036)", () => {
    test("returns empty map on Qdrant error and proceeds with scheduling", async () => {
      mockQdrantClient.checkTracksExist.mockRejectedValue(
        new Error("Qdrant unavailable")
      );
      // Ensure Inngest mock is ready to receive the call
      mockSendEvent.mockResolvedValue(undefined);

      // Should not throw and should proceed with scheduling
      const result = await scheduler.scheduleTrack({
        isrc: "USRC11700001",
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
      });

      // Should still schedule (fail-open means assume not indexed)
      expect(result.scheduled).toBe(true);
      expect(mockSendEvent).toHaveBeenCalled();
    });

    test("logs Qdrant error when fail-open triggers", async () => {
      const { logger } = await import("../../src/utils/logger.js");
      mockQdrantClient.checkTracksExist.mockRejectedValue(
        new Error("Connection timeout")
      );

      await scheduler.scheduleTrack({
        isrc: "USRC11700001",
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
      });

      expect(logger.qdrantCheckError).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Invalid ISRC handling (US1 T016)
  // ==========================================================================
  describe("Invalid ISRC Handling (US1 T016)", () => {
    test("skips tracks with missing ISRC", async () => {
      const result = await scheduler.scheduleTrack({
        isrc: "",
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
      });

      expect(result.scheduled).toBe(false);
      expect(result.reason).toBe("missing_isrc");
      expect(mockSendEvent).not.toHaveBeenCalled();
    });

    test("skips tracks with invalid ISRC format", async () => {
      const result = await scheduler.scheduleTrack({
        isrc: "INVALID",
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
      });

      expect(result.scheduled).toBe(false);
      expect(result.reason).toBe("invalid_isrc");
      expect(mockSendEvent).not.toHaveBeenCalled();
    });

    test("logs warning for missing ISRC", async () => {
      const { logger } = await import("../../src/utils/logger.js");

      await scheduler.scheduleTrack({
        isrc: "",
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
      });

      expect(logger.ingestionSkipped).toHaveBeenCalledWith(
        "",
        "Test Track",
        "missing_isrc"
      );
    });

    test("logs warning for invalid ISRC format", async () => {
      const { logger } = await import("../../src/utils/logger.js");

      await scheduler.scheduleTrack({
        isrc: "BAD",
        title: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
      });

      expect(logger.ingestionSkipped).toHaveBeenCalledWith(
        "BAD",
        "Test Track",
        "invalid_isrc"
      );
    });
  });

  // ==========================================================================
  // Album tracks with missing ISRCs
  // ==========================================================================
  describe("Album Tracks with Missing ISRCs", () => {
    test("skips tracks without ISRCs in album batch", async () => {
      mockQdrantClient.checkTracksExist.mockResolvedValue(new Map());
      mockSendEvent.mockResolvedValue(undefined);

      const result = await scheduler.scheduleAlbumTracks({
        albumTitle: "Test Album",
        artistName: "Test Artist",
        tracks: [
          { isrc: "USRC11700001", title: "Track 1" },
          { isrc: "", title: "Track 2" }, // Missing ISRC
          { isrc: "USRC11700003", title: "Track 3" },
        ],
      });

      expect(result.totalTracks).toBe(3);
      expect(result.scheduledCount).toBe(2);
      expect(result.skippedCount).toBe(1);
      expect(mockSendEvent).toHaveBeenCalledTimes(2);
    });
  });
});
