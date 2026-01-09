/**
 * Contract tests for Tidal Library Sync GraphQL Resolver
 *
 * Feature: ALG-32 - Tidal Library Synchronisation Flow
 *
 * Tests the GraphQL resolver for Tidal library sync operations.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { tidalSyncResolvers } from "../../src/resolvers/tidalSyncResolver.js";
import {
  TidalLibrarySyncService,
  TidalConnectionError,
  TidalSyncApiError,
} from "../../src/services/tidalLibrarySyncService.js";

describe("Tidal Sync Resolver", () => {
  // Create a mock TidalLibrarySyncService
  const createMockSyncService = () =>
    ({
      getAlbumDiff: vi.fn(),
      getTrackDiff: vi.fn(),
      importItems: vi.fn(),
    }) as unknown as TidalLibrarySyncService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTidalAlbumDiff Query", () => {
    it("returns TidalSyncConnectionError when userId is not provided", async () => {
      const syncService = createMockSyncService();
      const context = {
        tidalLibrarySyncService: syncService,
        userId: undefined,
      };

      const result = await tidalSyncResolvers.Query.getTidalAlbumDiff(
        null,
        {},
        context,
      );

      expect(result.__typename).toBe("TidalSyncConnectionError");
      expect((result as any).requiresReconnect).toBe(true);
    });

    it("returns TidalAlbumDiffResult with albums on success", async () => {
      const syncService = createMockSyncService();
      const mockAlbums = [
        {
          tidalId: "album123",
          title: "Test Album",
          artistName: "Test Artist",
          coverArtUrl: "https://example.com/cover.jpg",
          trackCount: 10,
          releaseDate: "2024-01-01",
          addedToTidal: "2024-06-01T00:00:00Z",
        },
      ];
      (syncService.getAlbumDiff as any).mockResolvedValue({
        items: mockAlbums,
        nextCursor: "cursor123",
        hasMore: true,
      });

      const context = {
        tidalLibrarySyncService: syncService,
        userId: "user_123",
      };

      const result = await tidalSyncResolvers.Query.getTidalAlbumDiff(
        null,
        { limit: 50 },
        context,
      );

      expect(result.__typename).toBe("TidalAlbumDiffResult");
      const success = result as any;
      expect(success.items).toHaveLength(1);
      expect(success.items[0].title).toBe("Test Album");
      expect(success.nextCursor).toBe("cursor123");
      expect(success.hasMore).toBe(true);
    });

    it("returns TidalSyncConnectionError on TidalConnectionError", async () => {
      const syncService = createMockSyncService();
      (syncService.getAlbumDiff as any).mockRejectedValue(
        new TidalConnectionError("Token expired", true),
      );

      const context = {
        tidalLibrarySyncService: syncService,
        userId: "user_123",
      };

      const result = await tidalSyncResolvers.Query.getTidalAlbumDiff(
        null,
        {},
        context,
      );

      expect(result.__typename).toBe("TidalSyncConnectionError");
      expect((result as any).requiresReconnect).toBe(true);
    });

    it("returns TidalSyncApiError on TidalSyncApiError", async () => {
      const syncService = createMockSyncService();
      (syncService.getAlbumDiff as any).mockRejectedValue(
        new TidalSyncApiError("API unavailable", true),
      );

      const context = {
        tidalLibrarySyncService: syncService,
        userId: "user_123",
      };

      const result = await tidalSyncResolvers.Query.getTidalAlbumDiff(
        null,
        {},
        context,
      );

      expect(result.__typename).toBe("TidalSyncApiError");
      expect((result as any).retryable).toBe(true);
    });

    it("passes cursor parameter to service", async () => {
      const syncService = createMockSyncService();
      (syncService.getAlbumDiff as any).mockResolvedValue({
        items: [],
        nextCursor: null,
        hasMore: false,
      });

      const context = {
        tidalLibrarySyncService: syncService,
        userId: "user_123",
      };

      await tidalSyncResolvers.Query.getTidalAlbumDiff(
        null,
        { cursor: "abc123", limit: 25 },
        context,
      );

      expect(syncService.getAlbumDiff).toHaveBeenCalledWith("user_123", {
        cursor: "abc123",
        limit: 25,
      });
    });
  });

  describe("getTidalTrackDiff Query", () => {
    it("returns TidalSyncConnectionError when userId is not provided", async () => {
      const syncService = createMockSyncService();
      const context = {
        tidalLibrarySyncService: syncService,
        userId: undefined,
      };

      const result = await tidalSyncResolvers.Query.getTidalTrackDiff(
        null,
        {},
        context,
      );

      expect(result.__typename).toBe("TidalSyncConnectionError");
      expect((result as any).requiresReconnect).toBe(true);
    });

    it("returns TidalTrackDiffResult with tracks on success", async () => {
      const syncService = createMockSyncService();
      const mockTracks = [
        {
          tidalId: "track123",
          title: "Test Track",
          artistName: "Test Artist",
          albumName: "Test Album",
          coverArtUrl: "https://example.com/cover.jpg",
          duration: 210,
          addedToTidal: "2024-06-01T00:00:00Z",
        },
      ];
      (syncService.getTrackDiff as any).mockResolvedValue({
        items: mockTracks,
        nextCursor: null,
        hasMore: false,
      });

      const context = {
        tidalLibrarySyncService: syncService,
        userId: "user_123",
      };

      const result = await tidalSyncResolvers.Query.getTidalTrackDiff(
        null,
        {},
        context,
      );

      expect(result.__typename).toBe("TidalTrackDiffResult");
      const success = result as any;
      expect(success.items).toHaveLength(1);
      expect(success.items[0].title).toBe("Test Track");
      expect(success.hasMore).toBe(false);
    });

    it("returns TidalSyncConnectionError on TidalConnectionError", async () => {
      const syncService = createMockSyncService();
      (syncService.getTrackDiff as any).mockRejectedValue(
        new TidalConnectionError("No Tidal connection", true),
      );

      const context = {
        tidalLibrarySyncService: syncService,
        userId: "user_123",
      };

      const result = await tidalSyncResolvers.Query.getTidalTrackDiff(
        null,
        {},
        context,
      );

      expect(result.__typename).toBe("TidalSyncConnectionError");
    });
  });

  describe("importFromTidal Mutation", () => {
    it("returns TidalSyncConnectionError when userId is not provided", async () => {
      const syncService = createMockSyncService();
      const context = {
        tidalLibrarySyncService: syncService,
        userId: undefined,
      };

      const result = await tidalSyncResolvers.Mutation.importFromTidal(
        null,
        { items: [] },
        context,
      );

      expect(result.__typename).toBe("TidalSyncConnectionError");
      expect((result as any).requiresReconnect).toBe(true);
    });

    it("returns TidalImportSuccess with correct counts", async () => {
      const syncService = createMockSyncService();
      (syncService.importItems as any).mockResolvedValue({
        imported: 2,
        skipped: 1,
        failed: 0,
        results: [
          { tidalId: "album1", type: "album", success: true },
          { tidalId: "album2", type: "album", success: true },
          { tidalId: "track1", type: "track", success: true },
        ],
      });

      const context = {
        tidalLibrarySyncService: syncService,
        userId: "user_123",
      };

      const result = await tidalSyncResolvers.Mutation.importFromTidal(
        null,
        {
          items: [
            { type: "ALBUM", tidalId: "album1" },
            { type: "ALBUM", tidalId: "album2" },
            { type: "TRACK", tidalId: "track1" },
          ],
        },
        context,
      );

      expect(result.__typename).toBe("TidalImportSuccess");
      const success = result as any;
      expect(success.imported).toBe(2);
      expect(success.skipped).toBe(1);
      expect(success.failed).toBe(0);
      expect(success.results).toHaveLength(3);
    });

    it("converts GraphQL enum types to service format", async () => {
      const syncService = createMockSyncService();
      (syncService.importItems as any).mockResolvedValue({
        imported: 1,
        skipped: 0,
        failed: 0,
        results: [{ tidalId: "album1", type: "album", success: true }],
      });

      const context = {
        tidalLibrarySyncService: syncService,
        userId: "user_123",
      };

      await tidalSyncResolvers.Mutation.importFromTidal(
        null,
        {
          items: [
            { type: "ALBUM", tidalId: "album1" },
            { type: "TRACK", tidalId: "track1" },
          ],
        },
        context,
      );

      expect(syncService.importItems).toHaveBeenCalledWith("user_123", [
        { type: "album", tidalId: "album1" },
        { type: "track", tidalId: "track1" },
      ]);
    });

    it("converts service result types to GraphQL enum format", async () => {
      const syncService = createMockSyncService();
      (syncService.importItems as any).mockResolvedValue({
        imported: 2,
        skipped: 0,
        failed: 0,
        results: [
          { tidalId: "album1", type: "album", success: true },
          { tidalId: "track1", type: "track", success: true },
        ],
      });

      const context = {
        tidalLibrarySyncService: syncService,
        userId: "user_123",
      };

      const result = await tidalSyncResolvers.Mutation.importFromTidal(
        null,
        { items: [{ type: "ALBUM", tidalId: "album1" }] },
        context,
      );

      expect(result.__typename).toBe("TidalImportSuccess");
      const success = result as any;
      expect(success.results[0].type).toBe("ALBUM");
      expect(success.results[1].type).toBe("TRACK");
    });

    it("returns TidalSyncConnectionError on TidalConnectionError", async () => {
      const syncService = createMockSyncService();
      (syncService.importItems as any).mockRejectedValue(
        new TidalConnectionError("Token refresh failed", true),
      );

      const context = {
        tidalLibrarySyncService: syncService,
        userId: "user_123",
      };

      const result = await tidalSyncResolvers.Mutation.importFromTidal(
        null,
        { items: [{ type: "ALBUM", tidalId: "album1" }] },
        context,
      );

      expect(result.__typename).toBe("TidalSyncConnectionError");
      expect((result as any).requiresReconnect).toBe(true);
    });

    it("returns TidalSyncApiError on unexpected errors", async () => {
      const syncService = createMockSyncService();
      (syncService.importItems as any).mockRejectedValue(
        new Error("Unexpected error"),
      );

      const context = {
        tidalLibrarySyncService: syncService,
        userId: "user_123",
      };

      const result = await tidalSyncResolvers.Mutation.importFromTidal(
        null,
        { items: [{ type: "ALBUM", tidalId: "album1" }] },
        context,
      );

      expect(result.__typename).toBe("TidalSyncApiError");
      expect((result as any).retryable).toBe(true);
    });
  });

  describe("Union Type Resolution", () => {
    it("resolves TidalAlbumDiffResult type", () => {
      const obj = { __typename: "TidalAlbumDiffResult" as const };
      const result = tidalSyncResolvers.TidalAlbumDiffUnion.__resolveType(
        obj as any,
      );
      expect(result).toBe("TidalAlbumDiffResult");
    });

    it("resolves TidalSyncConnectionError type", () => {
      const obj = { __typename: "TidalSyncConnectionError" as const };
      const result = tidalSyncResolvers.TidalAlbumDiffUnion.__resolveType(
        obj as any,
      );
      expect(result).toBe("TidalSyncConnectionError");
    });

    it("resolves TidalTrackDiffResult type", () => {
      const obj = { __typename: "TidalTrackDiffResult" as const };
      const result = tidalSyncResolvers.TidalTrackDiffUnion.__resolveType(
        obj as any,
      );
      expect(result).toBe("TidalTrackDiffResult");
    });

    it("resolves TidalImportSuccess type", () => {
      const obj = { __typename: "TidalImportSuccess" as const };
      const result = tidalSyncResolvers.TidalImportResult.__resolveType(
        obj as any,
      );
      expect(result).toBe("TidalImportSuccess");
    });

    it("resolves TidalSyncApiError type", () => {
      const obj = { __typename: "TidalSyncApiError" as const };
      const result = tidalSyncResolvers.TidalImportResult.__resolveType(
        obj as any,
      );
      expect(result).toBe("TidalSyncApiError");
    });
  });
});
