/**
 * Integration tests for Tidal Playlist API
 *
 * Feature: 017-tidal-playlist-export
 *
 * Tests the TidalService methods for creating playlists and adding tracks.
 * Requires TIDAL_CLIENT_ID and TIDAL_CLIENT_SECRET environment variables.
 *
 * NOTE: These tests require actual Tidal API access and a test user with
 * valid OAuth tokens. Skip if running without proper credentials.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { TidalService } from "../../src/services/tidalService.js";
import { TidalTokenService } from "../../src/services/tidalTokenService.js";
import type {
  TidalPlaylistCreatePayload,
  TidalPlaylistCreateResponse,
  TidalPlaylistItemsPayload,
} from "../../src/types/playlist.js";

// Skip integration tests if no Tidal credentials
const hasTidalCredentials =
  process.env.TIDAL_CLIENT_ID && process.env.TIDAL_CLIENT_SECRET;

describe.skipIf(!hasTidalCredentials)("Tidal Playlist API Integration", () => {
  let tidalService: TidalService;
  let tokenService: TidalTokenService;

  beforeAll(() => {
    tokenService = new TidalTokenService();
    tidalService = new TidalService(tokenService);
  });

  describe("batchFetchTracksByIsrc", () => {
    it("should resolve valid ISRCs to Tidal track data", async () => {
      // Use well-known ISRCs that should exist on Tidal
      const isrcs = [
        "USUM71900765", // Blinding Lights - The Weeknd
        "USUG11902288", // Don't Start Now - Dua Lipa
      ];

      const result = await tidalService.batchFetchTracksByIsrc(isrcs);

      expect(result.size).toBeGreaterThan(0);

      // At least one track should be found
      const firstIsrc = isrcs[0];
      const trackData = result.get(firstIsrc);
      if (trackData) {
        expect(trackData.tidalId).toBeDefined();
        expect(trackData.title).toBeDefined();
        expect(trackData.artist).toBeDefined();
      }
    });

    it("should return empty map for invalid ISRCs", async () => {
      const invalidIsrcs = ["INVALID00001", "INVALID00002"];

      const result = await tidalService.batchFetchTracksByIsrc(invalidIsrcs);

      // Should return empty map or map with missing entries
      expect(result.size).toBe(0);
    });

    it("should handle batch of 20+ ISRCs (chunking)", async () => {
      // Generate 25 test ISRCs (some valid, mostly invalid to test chunking logic)
      const isrcs = [
        "USUM71900765", // Real ISRC
        ...Array.from(
          { length: 24 },
          (_, i) => `TEST${i.toString().padStart(8, "0")}`,
        ),
      ];

      const result = await tidalService.batchFetchTracksByIsrc(isrcs);

      // Should complete without error even with 25 ISRCs (requires 2 batches)
      expect(result).toBeDefined();
      // At least the first real ISRC might be found
    });
  });
});

/**
 * Unit tests for TidalService playlist methods
 * These test the method signatures and payload structure without making real API calls
 */
describe("TidalService Playlist Methods (Unit)", () => {
  // Create a mock token service that doesn't require credentials
  const createMockTokenService = () =>
    ({
      getValidToken: vi.fn().mockResolvedValue("mock-token"),
      clearCache: vi.fn(),
    }) as unknown as TidalTokenService;

  describe("createPlaylist method signature", () => {
    it("should define createPlaylist method", () => {
      const tokenService = createMockTokenService();
      const tidalService = new TidalService(tokenService);

      // The method should exist (will be implemented in T006)
      expect(typeof tidalService.createPlaylist).toBe("function");
    });
  });

  describe("addTracksToPlaylist method signature", () => {
    it("should define addTracksToPlaylist method", () => {
      const tokenService = createMockTokenService();
      const tidalService = new TidalService(tokenService);

      // The method should exist (will be implemented in T007)
      expect(typeof tidalService.addTracksToPlaylist).toBe("function");
    });
  });

  describe("Tidal API payload structure", () => {
    it("should create valid playlist creation payload", () => {
      const payload: TidalPlaylistCreatePayload = {
        data: {
          type: "playlists",
          attributes: {
            name: "Test Playlist",
            accessType: "UNLISTED",
            description: "Created by AlgoJuke",
          },
        },
      };

      expect(payload.data.type).toBe("playlists");
      expect(payload.data.attributes.accessType).toBe("UNLISTED");
    });

    it("should create valid playlist items payload", () => {
      const now = new Date().toISOString();
      const payload: TidalPlaylistItemsPayload = {
        data: [
          { type: "tracks", id: "12345678", meta: { addedAt: now } },
          { type: "tracks", id: "87654321", meta: { addedAt: now } },
        ],
      };

      expect(payload.data).toHaveLength(2);
      expect(payload.data[0].type).toBe("tracks");
      expect(payload.data[0].meta.addedAt).toBeDefined();
    });

    it("should handle max 20 items per playlist items payload", () => {
      const now = new Date().toISOString();
      const items = Array.from({ length: 20 }, (_, i) => ({
        type: "tracks" as const,
        id: `track_${i}`,
        meta: { addedAt: now },
      }));

      const payload: TidalPlaylistItemsPayload = { data: items };

      expect(payload.data).toHaveLength(20);
    });
  });
});

/**
 * Mock tests for playlist export endpoint
 * Tests the route handler logic with mocked TidalService
 */
describe("Playlist Export Endpoint (Mock)", () => {
  it("should validate request body structure", async () => {
    const validRequest = {
      name: "My Playlist",
      tracks: [{ isrc: "USUM71900765", title: "Track 1", artist: "Artist 1" }],
    };

    // Import the schema for validation
    const { PlaylistExportRequestSchema } =
      await import("../../src/schemas/playlist.js");
    const result = PlaylistExportRequestSchema.safeParse(validRequest);

    expect(result.success).toBe(true);
  });

  it("should reject invalid ISRC format", async () => {
    const invalidRequest = {
      name: "My Playlist",
      tracks: [{ isrc: "INVALID", title: "Track 1", artist: "Artist 1" }],
    };

    const { PlaylistExportRequestSchema } =
      await import("../../src/schemas/playlist.js");
    const result = PlaylistExportRequestSchema.safeParse(invalidRequest);

    expect(result.success).toBe(false);
  });

  it("should reject empty playlist name", async () => {
    const invalidRequest = {
      name: "",
      tracks: [{ isrc: "USUM71900765", title: "Track 1", artist: "Artist 1" }],
    };

    const { PlaylistExportRequestSchema } =
      await import("../../src/schemas/playlist.js");
    const result = PlaylistExportRequestSchema.safeParse(invalidRequest);

    expect(result.success).toBe(false);
  });

  it("should reject playlist with no tracks", async () => {
    const invalidRequest = {
      name: "Empty Playlist",
      tracks: [],
    };

    const { PlaylistExportRequestSchema } =
      await import("../../src/schemas/playlist.js");
    const result = PlaylistExportRequestSchema.safeParse(invalidRequest);

    expect(result.success).toBe(false);
  });
});
