/**
 * Contract tests for Playlist Export GraphQL Resolver
 *
 * Feature: 017-tidal-playlist-export
 *
 * Tests the GraphQL resolver for exportPlaylistToTidal mutation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { playlistResolvers } from "../../src/resolvers/playlistResolver.js";
import type { TidalService } from "../../src/services/tidalService.js";
import { RateLimitError, ApiUnavailableError } from "../../src/types/errors.js";

// Mock modules
vi.mock("../../src/services/tidalAuthService.js", () => ({
  getTidalTokens: vi.fn(),
  isTokenExpired: vi.fn(),
  attemptTokenRefresh: vi.fn(),
}));

import {
  getTidalTokens,
  isTokenExpired,
  attemptTokenRefresh,
} from "../../src/services/tidalAuthService.js";

const mockGetTidalTokens = vi.mocked(getTidalTokens);
const mockIsTokenExpired = vi.mocked(isTokenExpired);
const mockAttemptTokenRefresh = vi.mocked(attemptTokenRefresh);

describe("Playlist Export Resolver", () => {
  // Create a mock TidalService
  const createMockTidalService = () =>
    ({
      batchFetchTracksByIsrc: vi.fn(),
      createPlaylist: vi.fn(),
      addTracksToPlaylist: vi.fn(),
    }) as unknown as TidalService;

  const validInput = {
    name: "Test Playlist",
    tracks: [
      { isrc: "USUM71900765", title: "Track 1", artist: "Artist 1" },
      { isrc: "USUG11902288", title: "Track 2", artist: "Artist 2" },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns NoTidalConnectionError when userId is not provided", async () => {
      const tidalService = createMockTidalService();
      const context = { tidalService, userId: undefined };

      const result = await playlistResolvers.Mutation.exportPlaylistToTidal(
        null,
        { input: validInput },
        context,
      );

      expect(result.__typename).toBe("NoTidalConnectionError");
      expect((result as any).code).toBe("no_tidal_connection");
    });

    it("returns NoTidalConnectionError when user has no Tidal tokens", async () => {
      mockGetTidalTokens.mockResolvedValue(null);

      const tidalService = createMockTidalService();
      const context = { tidalService, userId: "user_123" };

      const result = await playlistResolvers.Mutation.exportPlaylistToTidal(
        null,
        { input: validInput },
        context,
      );

      expect(result.__typename).toBe("NoTidalConnectionError");
      expect((result as any).code).toBe("no_tidal_connection");
    });
  });

  describe("Token Refresh", () => {
    it("returns TokenRefreshFailedError when token expired and refresh fails", async () => {
      mockGetTidalTokens.mockResolvedValue({
        accessToken: "expired-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() - 1000,
        scopes: ["playlists.write"],
        connectedAt: Date.now() - 10000,
      });
      mockIsTokenExpired.mockResolvedValue(true);
      mockAttemptTokenRefresh.mockResolvedValue(null);

      const tidalService = createMockTidalService();
      const context = { tidalService, userId: "user_123" };

      const result = await playlistResolvers.Mutation.exportPlaylistToTidal(
        null,
        { input: validInput },
        context,
      );

      expect(result.__typename).toBe("TokenRefreshFailedError");
      expect((result as any).code).toBe("token_refresh_failed");
    });

    it("continues with refreshed token when refresh succeeds", async () => {
      mockGetTidalTokens.mockResolvedValue({
        accessToken: "expired-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() - 1000,
        scopes: ["playlists.write"],
        connectedAt: Date.now() - 10000,
      });
      mockIsTokenExpired.mockResolvedValue(true);
      mockAttemptTokenRefresh.mockResolvedValue("new-access-token");

      const tidalService = createMockTidalService();
      (tidalService.batchFetchTracksByIsrc as any).mockResolvedValue(
        new Map([
          [
            "USUM71900765",
            { tidalId: "123", title: "Track 1", artist: "Artist 1" },
          ],
        ]),
      );
      (tidalService.createPlaylist as any).mockResolvedValue("playlist-uuid");
      (tidalService.addTracksToPlaylist as any).mockResolvedValue(undefined);

      const context = { tidalService, userId: "user_123" };

      const result = await playlistResolvers.Mutation.exportPlaylistToTidal(
        null,
        { input: validInput },
        context,
      );

      expect(result.__typename).toBe("ExportPlaylistSuccess");
      expect(tidalService.createPlaylist).toHaveBeenCalledWith(
        "Test Playlist",
        "new-access-token",
        "US",
      );
    });
  });

  describe("Validation", () => {
    it("returns PlaylistValidationError for empty playlist name", async () => {
      mockGetTidalTokens.mockResolvedValue({
        accessToken: "valid-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() + 3600000,
        scopes: ["playlists.write"],
        connectedAt: Date.now() - 10000,
      });
      mockIsTokenExpired.mockResolvedValue(false);

      const tidalService = createMockTidalService();
      const context = { tidalService, userId: "user_123" };

      const result = await playlistResolvers.Mutation.exportPlaylistToTidal(
        null,
        { input: { name: "", tracks: validInput.tracks } },
        context,
      );

      expect(result.__typename).toBe("PlaylistValidationError");
      expect((result as any).code).toBe("validation_error");
    });

    it("returns PlaylistValidationError for empty tracks array", async () => {
      mockGetTidalTokens.mockResolvedValue({
        accessToken: "valid-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() + 3600000,
        scopes: ["playlists.write"],
        connectedAt: Date.now() - 10000,
      });
      mockIsTokenExpired.mockResolvedValue(false);

      const tidalService = createMockTidalService();
      const context = { tidalService, userId: "user_123" };

      const result = await playlistResolvers.Mutation.exportPlaylistToTidal(
        null,
        { input: { name: "Test", tracks: [] } },
        context,
      );

      expect(result.__typename).toBe("PlaylistValidationError");
      expect((result as any).code).toBe("validation_error");
    });
  });

  describe("Track Resolution", () => {
    it("returns NoTracksAvailableError when no tracks found on Tidal", async () => {
      mockGetTidalTokens.mockResolvedValue({
        accessToken: "valid-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() + 3600000,
        scopes: ["playlists.write"],
        connectedAt: Date.now() - 10000,
      });
      mockIsTokenExpired.mockResolvedValue(false);

      const tidalService = createMockTidalService();
      (tidalService.batchFetchTracksByIsrc as any).mockResolvedValue(new Map());

      const context = { tidalService, userId: "user_123" };

      const result = await playlistResolvers.Mutation.exportPlaylistToTidal(
        null,
        { input: validInput },
        context,
      );

      expect(result.__typename).toBe("NoTracksAvailableError");
      expect((result as any).code).toBe("no_tracks_available");
    });
  });

  describe("Success Case", () => {
    it("returns ExportPlaylistSuccess with correct data", async () => {
      mockGetTidalTokens.mockResolvedValue({
        accessToken: "valid-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() + 3600000,
        scopes: ["playlists.write"],
        connectedAt: Date.now() - 10000,
      });
      mockIsTokenExpired.mockResolvedValue(false);

      const tidalService = createMockTidalService();
      (tidalService.batchFetchTracksByIsrc as any).mockResolvedValue(
        new Map([
          [
            "USUM71900765",
            { tidalId: "123", title: "Track 1", artist: "Artist 1" },
          ],
          [
            "USUG11902288",
            { tidalId: "456", title: "Track 2", artist: "Artist 2" },
          ],
        ]),
      );
      (tidalService.createPlaylist as any).mockResolvedValue(
        "550e8400-e29b-41d4-a716-446655440000",
      );
      (tidalService.addTracksToPlaylist as any).mockResolvedValue(undefined);

      const context = { tidalService, userId: "user_123" };

      const result = await playlistResolvers.Mutation.exportPlaylistToTidal(
        null,
        { input: validInput },
        context,
      );

      expect(result.__typename).toBe("ExportPlaylistSuccess");
      const success = result as any;
      expect(success.playlistId).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(success.playlistName).toBe("Test Playlist");
      expect(success.tracksAdded).toBe(2);
      expect(success.tracksSkipped).toBe(0);
      expect(success.skippedTracks).toBeUndefined();
    });

    it("includes skipped tracks when some tracks not found", async () => {
      mockGetTidalTokens.mockResolvedValue({
        accessToken: "valid-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() + 3600000,
        scopes: ["playlists.write"],
        connectedAt: Date.now() - 10000,
      });
      mockIsTokenExpired.mockResolvedValue(false);

      const tidalService = createMockTidalService();
      // Only first track found
      (tidalService.batchFetchTracksByIsrc as any).mockResolvedValue(
        new Map([
          [
            "USUM71900765",
            { tidalId: "123", title: "Track 1", artist: "Artist 1" },
          ],
        ]),
      );
      (tidalService.createPlaylist as any).mockResolvedValue("playlist-uuid");
      (tidalService.addTracksToPlaylist as any).mockResolvedValue(undefined);

      const context = { tidalService, userId: "user_123" };

      const result = await playlistResolvers.Mutation.exportPlaylistToTidal(
        null,
        { input: validInput },
        context,
      );

      expect(result.__typename).toBe("ExportPlaylistSuccess");
      const success = result as any;
      expect(success.tracksAdded).toBe(1);
      expect(success.tracksSkipped).toBe(1);
      expect(success.skippedTracks).toHaveLength(1);
      expect(success.skippedTracks[0].isrc).toBe("USUG11902288");
    });
  });

  describe("Error Handling", () => {
    it("returns PlaylistCreationFailedError with retryable for rate limit", async () => {
      mockGetTidalTokens.mockResolvedValue({
        accessToken: "valid-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() + 3600000,
        scopes: ["playlists.write"],
        connectedAt: Date.now() - 10000,
      });
      mockIsTokenExpired.mockResolvedValue(false);

      const tidalService = createMockTidalService();
      (tidalService.batchFetchTracksByIsrc as any).mockResolvedValue(
        new Map([
          [
            "USUM71900765",
            { tidalId: "123", title: "Track 1", artist: "Artist 1" },
          ],
        ]),
      );
      // Use RateLimitError class for proper type checking
      (tidalService.createPlaylist as any).mockRejectedValue(
        new RateLimitError(10),
      );

      const context = { tidalService, userId: "user_123" };

      const result = await playlistResolvers.Mutation.exportPlaylistToTidal(
        null,
        { input: validInput },
        context,
      );

      expect(result.__typename).toBe("PlaylistCreationFailedError");
      const error = result as any;
      expect(error.code).toBe("rate_limit_exceeded");
      expect(error.retryable).toBe(true);
      expect(error.retryAfter).toBe(10);
    });

    it("returns PlaylistCreationFailedError for Tidal unavailable", async () => {
      mockGetTidalTokens.mockResolvedValue({
        accessToken: "valid-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() + 3600000,
        scopes: ["playlists.write"],
        connectedAt: Date.now() - 10000,
      });
      mockIsTokenExpired.mockResolvedValue(false);

      const tidalService = createMockTidalService();
      (tidalService.batchFetchTracksByIsrc as any).mockResolvedValue(
        new Map([
          [
            "USUM71900765",
            { tidalId: "123", title: "Track 1", artist: "Artist 1" },
          ],
        ]),
      );
      // Use ApiUnavailableError class for proper type checking
      (tidalService.createPlaylist as any).mockRejectedValue(
        new ApiUnavailableError("Tidal API is unavailable"),
      );

      const context = { tidalService, userId: "user_123" };

      const result = await playlistResolvers.Mutation.exportPlaylistToTidal(
        null,
        { input: validInput },
        context,
      );

      expect(result.__typename).toBe("PlaylistCreationFailedError");
      const error = result as any;
      expect(error.code).toBe("tidal_unavailable");
      expect(error.retryable).toBe(true);
    });
  });

  describe("Union Type Resolution", () => {
    it("resolves ExportPlaylistSuccess type", () => {
      const obj = { __typename: "ExportPlaylistSuccess" as const };
      const result =
        playlistResolvers.ExportPlaylistToTidalResult.__resolveType(obj as any);
      expect(result).toBe("ExportPlaylistSuccess");
    });

    it("resolves NoTidalConnectionError type", () => {
      const obj = { __typename: "NoTidalConnectionError" as const };
      const result =
        playlistResolvers.ExportPlaylistToTidalResult.__resolveType(obj as any);
      expect(result).toBe("NoTidalConnectionError");
    });

    it("resolves PlaylistCreationFailedError type", () => {
      const obj = { __typename: "PlaylistCreationFailedError" as const };
      const result =
        playlistResolvers.ExportPlaylistToTidalResult.__resolveType(obj as any);
      expect(result).toBe("PlaylistCreationFailedError");
    });
  });
});
