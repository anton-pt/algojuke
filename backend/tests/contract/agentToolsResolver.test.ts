/**
 * Contract tests for Agent Tools GraphQL Resolvers
 *
 * Feature: ALG-77 - Cross-service agent tool invocation
 *
 * Tests the GraphQL resolvers for agent tool queries with dual authentication.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
} from "vitest";

// Mock logger
vi.mock("../../src/utils/logger.js", () => ({
  logger: {
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock security logger
vi.mock("../../src/utils/securityLogger.js", () => ({
  logAuthFailure: vi.fn(),
}));

// Mock all agent tool executors
vi.mock("../../src/services/agentTools/semanticSearchTool.js", () => ({
  executeSemanticSearch: vi.fn(),
}));

vi.mock("../../src/services/agentTools/tidalSearchTool.js", () => ({
  executeTidalSearch: vi.fn(),
}));

vi.mock("../../src/services/agentTools/albumTracksTool.js", () => ({
  executeAlbumTracks: vi.fn(),
}));

vi.mock("../../src/services/agentTools/batchMetadataTool.js", () => ({
  executeBatchMetadata: vi.fn(),
}));

// Use dynamic import to set env var first
let agentToolsResolvers: typeof import("../../src/resolvers/agentToolsResolver.js").agentToolsResolvers;
let mockExecuteSemanticSearch: ReturnType<
  typeof vi.mocked<
    typeof import("../../src/services/agentTools/semanticSearchTool.js").executeSemanticSearch
  >
>;
let mockExecuteTidalSearch: ReturnType<
  typeof vi.mocked<
    typeof import("../../src/services/agentTools/tidalSearchTool.js").executeTidalSearch
  >
>;
let mockExecuteAlbumTracks: ReturnType<
  typeof vi.mocked<
    typeof import("../../src/services/agentTools/albumTracksTool.js").executeAlbumTracks
  >
>;
let mockExecuteBatchMetadata: ReturnType<
  typeof vi.mocked<
    typeof import("../../src/services/agentTools/batchMetadataTool.js").executeBatchMetadata
  >
>;

// Type for test context
interface TestContext {
  userId?: string;
  serviceApiKey?: string;
  tidalService: unknown;
  discoveryService: unknown;
  trackMetadataService: unknown;
  qdrantClient: unknown;
  dataSources: {
    db: {
      getRepository: () => unknown;
    };
  };
}

describe("Agent Tools GraphQL Resolvers", () => {
  const createMockContext = (
    overrides: Partial<TestContext> = {},
  ): TestContext => ({
    tidalService: {},
    discoveryService: {},
    trackMetadataService: {},
    qdrantClient: {},
    dataSources: {
      db: {
        getRepository: () => ({}),
      },
    },
    ...overrides,
  });

  beforeAll(async () => {
    // Set env var BEFORE importing modules
    vi.stubEnv("SERVICE_API_KEY", "test-api-key-12345");
    vi.resetModules();

    // Dynamic imports after env var is set
    const resolverModule =
      await import("../../src/resolvers/agentToolsResolver.js");
    agentToolsResolvers = resolverModule.agentToolsResolvers;

    const semanticSearch =
      await import("../../src/services/agentTools/semanticSearchTool.js");
    mockExecuteSemanticSearch = vi.mocked(semanticSearch.executeSemanticSearch);

    const tidalSearch =
      await import("../../src/services/agentTools/tidalSearchTool.js");
    mockExecuteTidalSearch = vi.mocked(tidalSearch.executeTidalSearch);

    const albumTracks =
      await import("../../src/services/agentTools/albumTracksTool.js");
    mockExecuteAlbumTracks = vi.mocked(albumTracks.executeAlbumTracks);

    const batchMetadata =
      await import("../../src/services/agentTools/batchMetadataTool.js");
    mockExecuteBatchMetadata = vi.mocked(batchMetadata.executeBatchMetadata);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Authentication", () => {
    describe("agentSemanticSearch", () => {
      it("returns AgentToolError with UNAUTHENTICATED when no auth provided", async () => {
        const context = createMockContext();

        const result = await agentToolsResolvers.Query.agentSemanticSearch(
          null,
          { input: { query: "happy songs" } },
          context as any,
        );

        expect(result.__typename).toBe("AgentToolError");
        expect((result as any).code).toBe("UNAUTHENTICATED");
        expect((result as any).retryable).toBe(false);
      });

      it("succeeds with Clerk user auth (userId in context)", async () => {
        const context = createMockContext({ userId: "clerk_user_123" });
        mockExecuteSemanticSearch.mockResolvedValue({
          tracks: [],
          query: "happy songs",
          totalFound: 0,
          summary: "No tracks found",
          durationMs: 50,
        });

        const result = await agentToolsResolvers.Query.agentSemanticSearch(
          null,
          { input: { query: "happy songs" } },
          context as any,
        );

        expect(result.__typename).toBe("AgentSemanticSearchResponse");
        expect(mockExecuteSemanticSearch).toHaveBeenCalledWith(
          { query: "happy songs", limit: 50 },
          expect.objectContaining({ userId: "clerk_user_123" }),
        );
      });

      it("succeeds with service auth (API key + userId in input)", async () => {
        const context = createMockContext({
          serviceApiKey: "test-api-key-12345",
        });
        mockExecuteSemanticSearch.mockResolvedValue({
          tracks: [],
          query: "sad songs",
          totalFound: 0,
          summary: "No tracks found",
          durationMs: 50,
        });

        const result = await agentToolsResolvers.Query.agentSemanticSearch(
          null,
          { input: { query: "sad songs", userId: "target_user_456" } },
          context as any,
        );

        expect(result.__typename).toBe("AgentSemanticSearchResponse");
        expect(mockExecuteSemanticSearch).toHaveBeenCalledWith(
          { query: "sad songs", limit: 50 },
          expect.objectContaining({ userId: "target_user_456" }),
        );
      });

      it("returns AgentToolError when service auth but no userId in input", async () => {
        const context = createMockContext({
          serviceApiKey: "test-api-key-12345",
        });

        const result = await agentToolsResolvers.Query.agentSemanticSearch(
          null,
          { input: { query: "happy songs" } },
          context as any,
        );

        expect(result.__typename).toBe("AgentToolError");
        expect((result as any).code).toBe("UNAUTHENTICATED");
        expect((result as any).message).toContain("userId is required");
      });

      it("user auth takes precedence over service auth", async () => {
        const context = createMockContext({
          userId: "clerk_user_primary",
          serviceApiKey: "test-api-key-12345",
        });
        mockExecuteSemanticSearch.mockResolvedValue({
          tracks: [],
          query: "test",
          totalFound: 0,
          summary: "No tracks found",
          durationMs: 50,
        });

        await agentToolsResolvers.Query.agentSemanticSearch(
          null,
          { input: { query: "test", userId: "input_user_secondary" } },
          context as any,
        );

        // Should use context userId (Clerk), not input userId
        expect(mockExecuteSemanticSearch).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ userId: "clerk_user_primary" }),
        );
      });
    });

    describe("agentTidalSearch", () => {
      it("returns AgentToolError with UNAUTHENTICATED when no auth provided", async () => {
        const context = createMockContext();

        const result = await agentToolsResolvers.Query.agentTidalSearch(
          null,
          { input: { query: "radiohead", searchType: "albums" } },
          context as any,
        );

        expect(result.__typename).toBe("AgentToolError");
        expect((result as any).code).toBe("UNAUTHENTICATED");
      });

      it("succeeds with valid auth", async () => {
        const context = createMockContext({ userId: "user_123" });
        mockExecuteTidalSearch.mockResolvedValue({
          tracks: [],
          albums: [],
          query: "radiohead",
          totalFound: { tracks: 0, albums: 0 },
          summary: "No results found",
          durationMs: 100,
        });

        const result = await agentToolsResolvers.Query.agentTidalSearch(
          null,
          { input: { query: "radiohead", searchType: "albums" } },
          context as any,
        );

        expect(result.__typename).toBe("AgentTidalSearchResponse");
      });
    });

    describe("agentAlbumTracks", () => {
      it("returns AgentToolError with UNAUTHENTICATED when no auth provided", async () => {
        const context = createMockContext();

        const result = await agentToolsResolvers.Query.agentAlbumTracks(
          null,
          { input: { albumId: "12345678" } },
          context as any,
        );

        expect(result.__typename).toBe("AgentToolError");
        expect((result as any).code).toBe("UNAUTHENTICATED");
      });

      it("succeeds with valid auth", async () => {
        const context = createMockContext({ userId: "user_123" });
        mockExecuteAlbumTracks.mockResolvedValue({
          albumId: "12345678",
          albumTitle: "OK Computer",
          artist: "Radiohead",
          tracks: [],
          summary: "Album has 12 tracks",
          durationMs: 150,
        });

        const result = await agentToolsResolvers.Query.agentAlbumTracks(
          null,
          { input: { albumId: "12345678" } },
          context as any,
        );

        expect(result.__typename).toBe("AgentAlbumTracksResponse");
      });
    });

    describe("agentBatchMetadata", () => {
      it("returns AgentToolError with UNAUTHENTICATED when no auth provided", async () => {
        const context = createMockContext();

        const result = await agentToolsResolvers.Query.agentBatchMetadata(
          null,
          { input: { isrcs: ["USUM71900765"] } },
          context as any,
        );

        expect(result.__typename).toBe("AgentToolError");
        expect((result as any).code).toBe("UNAUTHENTICATED");
      });

      it("succeeds with valid auth", async () => {
        const context = createMockContext({ userId: "user_123" });
        mockExecuteBatchMetadata.mockResolvedValue({
          tracks: [],
          found: [],
          notFound: ["USUM71900765"],
          summary: "0 of 1 ISRCs found",
          durationMs: 80,
        });

        const result = await agentToolsResolvers.Query.agentBatchMetadata(
          null,
          { input: { isrcs: ["USUM71900765"] } },
          context as any,
        );

        expect(result.__typename).toBe("AgentBatchMetadataResponse");
      });
    });
  });

  describe("Error Handling", () => {
    it("maps VALIDATION_ERROR from tool", async () => {
      const context = createMockContext({ userId: "user_123" });
      mockExecuteSemanticSearch.mockRejectedValue({
        message: "Invalid query",
        code: "VALIDATION_ERROR",
        retryable: false,
      });

      const result = await agentToolsResolvers.Query.agentSemanticSearch(
        null,
        { input: { query: "" } },
        context as any,
      );

      expect(result.__typename).toBe("AgentToolError");
      expect((result as any).code).toBe("VALIDATION_ERROR");
      expect((result as any).retryable).toBe(false);
    });

    it("maps RATE_LIMIT error from tool", async () => {
      const context = createMockContext({ userId: "user_123" });
      mockExecuteTidalSearch.mockRejectedValue({
        message: "Rate limit exceeded",
        code: "RATE_LIMIT",
        retryable: true,
      });

      const result = await agentToolsResolvers.Query.agentTidalSearch(
        null,
        { input: { query: "test", searchType: "tracks" } },
        context as any,
      );

      expect(result.__typename).toBe("AgentToolError");
      expect((result as any).code).toBe("RATE_LIMIT");
      expect((result as any).retryable).toBe(true);
    });

    it("maps NOT_FOUND error from tool", async () => {
      const context = createMockContext({ userId: "user_123" });
      mockExecuteAlbumTracks.mockRejectedValue({
        message: "Album not found",
        code: "NOT_FOUND",
        retryable: false,
      });

      const result = await agentToolsResolvers.Query.agentAlbumTracks(
        null,
        { input: { albumId: "nonexistent" } },
        context as any,
      );

      expect(result.__typename).toBe("AgentToolError");
      expect((result as any).code).toBe("NOT_FOUND");
      expect((result as any).retryable).toBe(false);
    });

    it("maps TIMEOUT error from tool", async () => {
      const context = createMockContext({ userId: "user_123" });
      mockExecuteBatchMetadata.mockRejectedValue({
        message: "Request timed out",
        code: "TIMEOUT",
        retryable: true,
      });

      const result = await agentToolsResolvers.Query.agentBatchMetadata(
        null,
        { input: { isrcs: ["ISRC1", "ISRC2"] } },
        context as any,
      );

      expect(result.__typename).toBe("AgentToolError");
      expect((result as any).code).toBe("TIMEOUT");
      expect((result as any).retryable).toBe(true);
    });

    it("maps unknown errors to INTERNAL_ERROR", async () => {
      const context = createMockContext({ userId: "user_123" });
      mockExecuteSemanticSearch.mockRejectedValue(
        new Error("Unexpected failure"),
      );

      const result = await agentToolsResolvers.Query.agentSemanticSearch(
        null,
        { input: { query: "test" } },
        context as any,
      );

      expect(result.__typename).toBe("AgentToolError");
      expect((result as any).code).toBe("INTERNAL_ERROR");
    });
  });

  describe("Input Handling", () => {
    it("passes query and limit to semanticSearch", async () => {
      const context = createMockContext({ userId: "user_123" });
      mockExecuteSemanticSearch.mockResolvedValue({
        tracks: [],
        query: "energetic",
        totalFound: 0,
        summary: "No tracks found",
        durationMs: 50,
      });

      await agentToolsResolvers.Query.agentSemanticSearch(
        null,
        { input: { query: "energetic", limit: 25 } },
        context as any,
      );

      expect(mockExecuteSemanticSearch).toHaveBeenCalledWith(
        { query: "energetic", limit: 25 },
        expect.anything(),
      );
    });

    it("uses default limit of 50 for semanticSearch when not specified", async () => {
      const context = createMockContext({ userId: "user_123" });
      mockExecuteSemanticSearch.mockResolvedValue({
        tracks: [],
        query: "test",
        totalFound: 0,
        summary: "No tracks found",
        durationMs: 50,
      });

      await agentToolsResolvers.Query.agentSemanticSearch(
        null,
        { input: { query: "test" } },
        context as any,
      );

      expect(mockExecuteSemanticSearch).toHaveBeenCalledWith(
        { query: "test", limit: 50 },
        expect.anything(),
      );
    });

    it("uses default limit of 20 for tidalSearch when not specified", async () => {
      const context = createMockContext({ userId: "user_123" });
      mockExecuteTidalSearch.mockResolvedValue({
        tracks: [],
        albums: [],
        query: "test",
        totalFound: { tracks: 0, albums: 0 },
        summary: "No results",
        durationMs: 50,
      });

      await agentToolsResolvers.Query.agentTidalSearch(
        null,
        { input: { query: "test", searchType: "both" } },
        context as any,
      );

      expect(mockExecuteTidalSearch).toHaveBeenCalledWith(
        { query: "test", searchType: "both", limit: 20 },
        expect.anything(),
      );
    });

    it("passes albumId to albumTracks", async () => {
      const context = createMockContext({ userId: "user_123" });
      mockExecuteAlbumTracks.mockResolvedValue({
        albumId: "album123",
        albumTitle: "Test",
        artist: "Test Artist",
        tracks: [],
        summary: "Album loaded",
        durationMs: 50,
      });

      await agentToolsResolvers.Query.agentAlbumTracks(
        null,
        { input: { albumId: "album123" } },
        context as any,
      );

      expect(mockExecuteAlbumTracks).toHaveBeenCalledWith(
        { albumId: "album123" },
        expect.anything(),
      );
    });

    it("passes isrcs array to batchMetadata", async () => {
      const context = createMockContext({ userId: "user_123" });
      mockExecuteBatchMetadata.mockResolvedValue({
        tracks: [],
        found: [],
        notFound: ["ISRC1", "ISRC2"],
        summary: "0 found",
        durationMs: 50,
      });

      await agentToolsResolvers.Query.agentBatchMetadata(
        null,
        { input: { isrcs: ["ISRC1", "ISRC2"] } },
        context as any,
      );

      expect(mockExecuteBatchMetadata).toHaveBeenCalledWith(
        { isrcs: ["ISRC1", "ISRC2"] },
        expect.anything(),
      );
    });
  });

  describe("Union Type Resolvers", () => {
    it("resolves AgentSemanticSearchResult based on __typename", () => {
      const successResult = { __typename: "AgentSemanticSearchResponse" };
      const errorResult = { __typename: "AgentToolError" };

      expect(
        agentToolsResolvers.AgentSemanticSearchResult.__resolveType(
          successResult,
        ),
      ).toBe("AgentSemanticSearchResponse");
      expect(
        agentToolsResolvers.AgentSemanticSearchResult.__resolveType(
          errorResult,
        ),
      ).toBe("AgentToolError");
    });

    it("resolves AgentTidalSearchResult based on __typename", () => {
      const successResult = { __typename: "AgentTidalSearchResponse" };
      const errorResult = { __typename: "AgentToolError" };

      expect(
        agentToolsResolvers.AgentTidalSearchResult.__resolveType(successResult),
      ).toBe("AgentTidalSearchResponse");
      expect(
        agentToolsResolvers.AgentTidalSearchResult.__resolveType(errorResult),
      ).toBe("AgentToolError");
    });

    it("resolves AgentAlbumTracksResult based on __typename", () => {
      const successResult = { __typename: "AgentAlbumTracksResponse" };
      const errorResult = { __typename: "AgentToolError" };

      expect(
        agentToolsResolvers.AgentAlbumTracksResult.__resolveType(successResult),
      ).toBe("AgentAlbumTracksResponse");
      expect(
        agentToolsResolvers.AgentAlbumTracksResult.__resolveType(errorResult),
      ).toBe("AgentToolError");
    });

    it("resolves AgentBatchMetadataResult based on __typename", () => {
      const successResult = { __typename: "AgentBatchMetadataResponse" };
      const errorResult = { __typename: "AgentToolError" };

      expect(
        agentToolsResolvers.AgentBatchMetadataResult.__resolveType(
          successResult,
        ),
      ).toBe("AgentBatchMetadataResponse");
      expect(
        agentToolsResolvers.AgentBatchMetadataResult.__resolveType(errorResult),
      ).toBe("AgentToolError");
    });
  });
});
