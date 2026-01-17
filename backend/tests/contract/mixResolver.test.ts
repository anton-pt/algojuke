/**
 * Contract tests for Mix GraphQL Resolvers
 *
 * Feature: ALG-81 - Mix GraphQL API
 *
 * Tests the GraphQL resolvers for mix queries and mutations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

// Import after mocks
import {
  mixResolvers,
  type MixContext,
} from "../../src/resolvers/mixResolver.js";
import { Mix, MixSegment } from "../../src/entities/Mix.js";

// Helper to create test mix
function createTestMix(overrides: Partial<Mix> = {}): Mix {
  return {
    id: "mix-uuid-123",
    userId: "user-123",
    title: "Test Mix",
    description: "A test mix",
    status: "ready",
    failureReason: null,
    segments: [],
    totalDurationMs: 300000,
    characterCount: 5000,
    conversationId: "conv-123",
    createdAt: new Date("2026-01-17T10:00:00Z"),
    updatedAt: new Date("2026-01-17T11:00:00Z"),
    ...overrides,
  } as Mix;
}

// Helper to create test segment
function createTestMusicSegment(
  overrides: Partial<MixSegment> = {},
): MixSegment {
  return {
    id: "segment-1",
    type: "music",
    startMs: 0,
    endMs: 180000,
    durationMs: 180000,
    tidalTrackId: "track-123",
    isrc: "USRC12345678",
    trackTitle: "Test Track",
    artistName: "Test Artist",
    albumArtUrl: "https://example.com/art.jpg",
    ...overrides,
  };
}

function createTestVoiceSegment(
  overrides: Partial<MixSegment> = {},
): MixSegment {
  return {
    id: "segment-2",
    type: "voice",
    startMs: 180000,
    endMs: 300000,
    durationMs: 120000,
    audioUrl: "https://storage.example.com/voice.mp3",
    sourceType: "article",
    sourceId: "article-123",
    sourceTitle: "Test Article",
    sourceUrl: "https://example.com/article",
    contentMode: "summary",
    ...overrides,
  };
}

// Type for mock MixService
interface MockMixService {
  getMixesByUser: ReturnType<typeof vi.fn>;
  getMix: ReturnType<typeof vi.fn>;
  deleteMix: ReturnType<typeof vi.fn>;
}

// Create mock context
function createMockContext(overrides: { userId?: string } = {}): MixContext {
  const mockMixService: MockMixService = {
    getMixesByUser: vi.fn(),
    getMix: vi.fn(),
    deleteMix: vi.fn(),
  };

  return {
    userId: overrides.userId,
    mixService: mockMixService as any,
  } as MixContext;
}

describe("Mix GraphQL Resolvers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Query: mixes", () => {
    it("returns MixList with mixes when authenticated", async () => {
      const context = createMockContext({ userId: "user-123" });
      const mockMixes = [
        createTestMix({ id: "mix-1", title: "Mix 1" }),
        createTestMix({ id: "mix-2", title: "Mix 2" }),
      ];
      (
        context.mixService.getMixesByUser as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockMixes);

      const result = await mixResolvers.Query.mixes(null, {}, context);

      expect(result.__typename).toBe("MixList");
      expect((result as any).mixes).toHaveLength(2);
      expect((result as any).totalCount).toBe(2);
      expect(context.mixService.getMixesByUser).toHaveBeenCalledWith(
        "user-123",
      );
    });

    it("returns empty MixList when user has no mixes", async () => {
      const context = createMockContext({ userId: "user-123" });
      (
        context.mixService.getMixesByUser as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      const result = await mixResolvers.Query.mixes(null, {}, context);

      expect(result.__typename).toBe("MixList");
      expect((result as any).mixes).toHaveLength(0);
      expect((result as any).totalCount).toBe(0);
    });

    it("returns MixError with UNAUTHORIZED when not authenticated", async () => {
      const context = createMockContext(); // No userId

      const result = await mixResolvers.Query.mixes(null, {}, context);

      expect(result.__typename).toBe("MixError");
      expect((result as any).code).toBe("UNAUTHORIZED");
      expect((result as any).retryable).toBe(false);
    });

    it("returns MixError with DATABASE_ERROR on service failure", async () => {
      const context = createMockContext({ userId: "user-123" });
      (
        context.mixService.getMixesByUser as ReturnType<typeof vi.fn>
      ).mockRejectedValue(new Error("Database connection failed"));

      const result = await mixResolvers.Query.mixes(null, {}, context);

      expect(result.__typename).toBe("MixError");
      expect((result as any).code).toBe("DATABASE_ERROR");
      expect((result as any).retryable).toBe(true);
    });

    it("transforms mix status to uppercase enum value", async () => {
      const context = createMockContext({ userId: "user-123" });
      const mockMixes = [
        createTestMix({ status: "generating" }),
        createTestMix({ status: "ready" }),
        createTestMix({ status: "failed" }),
      ];
      (
        context.mixService.getMixesByUser as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockMixes);

      const result = await mixResolvers.Query.mixes(null, {}, context);

      expect(result.__typename).toBe("MixList");
      const mixes = (result as any).mixes;
      expect(mixes[0].status).toBe("GENERATING");
      expect(mixes[1].status).toBe("READY");
      expect(mixes[2].status).toBe("FAILED");
    });

    it("formats dates as ISO strings", async () => {
      const context = createMockContext({ userId: "user-123" });
      (
        context.mixService.getMixesByUser as ReturnType<typeof vi.fn>
      ).mockResolvedValue([createTestMix()]);

      const result = await mixResolvers.Query.mixes(null, {}, context);

      const mix = (result as any).mixes[0];
      expect(mix.createdAt).toBe("2026-01-17T10:00:00.000Z");
      expect(mix.updatedAt).toBe("2026-01-17T11:00:00.000Z");
    });
  });

  describe("Query: mix", () => {
    it("returns Mix when found and owned by user", async () => {
      const context = createMockContext({ userId: "user-123" });
      const mockMix = createTestMix();
      (context.mixService.getMix as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockMix,
      );

      const result = await mixResolvers.Query.mix(
        null,
        { id: "mix-uuid-123" },
        context,
      );

      expect(result.__typename).toBe("Mix");
      expect((result as any).id).toBe("mix-uuid-123");
      expect((result as any).title).toBe("Test Mix");
      expect(context.mixService.getMix).toHaveBeenCalledWith(
        "mix-uuid-123",
        "user-123",
      );
    });

    it("returns MixError with NOT_FOUND when mix does not exist", async () => {
      const context = createMockContext({ userId: "user-123" });
      (context.mixService.getMix as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      const result = await mixResolvers.Query.mix(
        null,
        { id: "nonexistent" },
        context,
      );

      expect(result.__typename).toBe("MixError");
      expect((result as any).code).toBe("NOT_FOUND");
      expect((result as any).retryable).toBe(false);
    });

    it("returns MixError with NOT_FOUND for another user's mix (user isolation)", async () => {
      const context = createMockContext({ userId: "user-123" });
      // Service returns null when userId doesn't match (enforced by MixService)
      (context.mixService.getMix as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      const result = await mixResolvers.Query.mix(
        null,
        { id: "other-user-mix" },
        context,
      );

      expect(result.__typename).toBe("MixError");
      expect((result as any).code).toBe("NOT_FOUND");
    });

    it("returns MixError with UNAUTHORIZED when not authenticated", async () => {
      const context = createMockContext(); // No userId

      const result = await mixResolvers.Query.mix(
        null,
        { id: "mix-uuid-123" },
        context,
      );

      expect(result.__typename).toBe("MixError");
      expect((result as any).code).toBe("UNAUTHORIZED");
      expect((result as any).retryable).toBe(false);
    });

    it("returns MixError with DATABASE_ERROR on service failure", async () => {
      const context = createMockContext({ userId: "user-123" });
      (context.mixService.getMix as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Connection timeout"),
      );

      const result = await mixResolvers.Query.mix(
        null,
        { id: "mix-uuid-123" },
        context,
      );

      expect(result.__typename).toBe("MixError");
      expect((result as any).code).toBe("DATABASE_ERROR");
      expect((result as any).retryable).toBe(true);
    });

    it("returns Mix with segments transformed correctly", async () => {
      const context = createMockContext({ userId: "user-123" });
      const mockMix = createTestMix({
        segments: [createTestMusicSegment(), createTestVoiceSegment()],
      });
      (context.mixService.getMix as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockMix,
      );

      const result = await mixResolvers.Query.mix(
        null,
        { id: "mix-uuid-123" },
        context,
      );

      expect(result.__typename).toBe("Mix");
      const segments = (result as any).segments;
      expect(segments).toHaveLength(2);

      // Music segment
      expect(segments[0].__typename).toBe("MusicSegment");
      expect(segments[0].tidalTrackId).toBe("track-123");
      expect(segments[0].trackTitle).toBe("Test Track");

      // Voice segment
      expect(segments[1].__typename).toBe("VoiceSegment");
      expect(segments[1].audioUrl).toBe(
        "https://storage.example.com/voice.mp3",
      );
      expect(segments[1].sourceType).toBe("article");
    });

    it("returns Mix with empty segments array", async () => {
      const context = createMockContext({ userId: "user-123" });
      const mockMix = createTestMix({ segments: [] });
      (context.mixService.getMix as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockMix,
      );

      const result = await mixResolvers.Query.mix(
        null,
        { id: "mix-uuid-123" },
        context,
      );

      expect(result.__typename).toBe("Mix");
      expect((result as any).segments).toEqual([]);
    });
  });

  describe("Mutation: deleteMix", () => {
    it("returns DeleteMixSuccess when mix is deleted", async () => {
      const context = createMockContext({ userId: "user-123" });
      (
        context.mixService.deleteMix as ReturnType<typeof vi.fn>
      ).mockResolvedValue(true);

      const result = await mixResolvers.Mutation.deleteMix(
        null,
        { id: "mix-uuid-123" },
        context,
      );

      expect(result.__typename).toBe("DeleteMixSuccess");
      expect((result as any).deletedId).toBe("mix-uuid-123");
      expect((result as any).message).toBe("Mix deleted successfully");
      expect(context.mixService.deleteMix).toHaveBeenCalledWith(
        "mix-uuid-123",
        "user-123",
      );
    });

    it("returns MixError with NOT_FOUND when mix does not exist", async () => {
      const context = createMockContext({ userId: "user-123" });
      (
        context.mixService.deleteMix as ReturnType<typeof vi.fn>
      ).mockResolvedValue(false);

      const result = await mixResolvers.Mutation.deleteMix(
        null,
        { id: "nonexistent" },
        context,
      );

      expect(result.__typename).toBe("MixError");
      expect((result as any).code).toBe("NOT_FOUND");
      expect((result as any).retryable).toBe(false);
    });

    it("returns MixError with NOT_FOUND for another user's mix (user isolation)", async () => {
      const context = createMockContext({ userId: "user-123" });
      // Service returns false when userId doesn't match
      (
        context.mixService.deleteMix as ReturnType<typeof vi.fn>
      ).mockResolvedValue(false);

      const result = await mixResolvers.Mutation.deleteMix(
        null,
        { id: "other-user-mix" },
        context,
      );

      expect(result.__typename).toBe("MixError");
      expect((result as any).code).toBe("NOT_FOUND");
    });

    it("returns MixError with UNAUTHORIZED when not authenticated", async () => {
      const context = createMockContext(); // No userId

      const result = await mixResolvers.Mutation.deleteMix(
        null,
        { id: "mix-uuid-123" },
        context,
      );

      expect(result.__typename).toBe("MixError");
      expect((result as any).code).toBe("UNAUTHORIZED");
      expect((result as any).retryable).toBe(false);
    });

    it("returns MixError with DATABASE_ERROR on service failure", async () => {
      const context = createMockContext({ userId: "user-123" });
      (
        context.mixService.deleteMix as ReturnType<typeof vi.fn>
      ).mockRejectedValue(new Error("Deletion failed"));

      const result = await mixResolvers.Mutation.deleteMix(
        null,
        { id: "mix-uuid-123" },
        context,
      );

      expect(result.__typename).toBe("MixError");
      expect((result as any).code).toBe("DATABASE_ERROR");
      expect((result as any).retryable).toBe(true);
    });
  });

  describe("Union Type Resolvers", () => {
    it("resolves MixesResult based on __typename", () => {
      const listResult = { __typename: "MixList" };
      const errorResult = { __typename: "MixError" };

      expect(mixResolvers.MixesResult.__resolveType(listResult as any)).toBe(
        "MixList",
      );
      expect(mixResolvers.MixesResult.__resolveType(errorResult as any)).toBe(
        "MixError",
      );
    });

    it("resolves MixResult based on __typename", () => {
      const mixResult = { __typename: "Mix" };
      const errorResult = { __typename: "MixError" };

      expect(mixResolvers.MixResult.__resolveType(mixResult as any)).toBe(
        "Mix",
      );
      expect(mixResolvers.MixResult.__resolveType(errorResult as any)).toBe(
        "MixError",
      );
    });

    it("resolves DeleteMixResult based on __typename", () => {
      const successResult = { __typename: "DeleteMixSuccess" };
      const errorResult = { __typename: "MixError" };

      expect(
        mixResolvers.DeleteMixResult.__resolveType(successResult as any),
      ).toBe("DeleteMixSuccess");
      expect(
        mixResolvers.DeleteMixResult.__resolveType(errorResult as any),
      ).toBe("MixError");
    });

    it("resolves MixSegment based on __typename", () => {
      const musicResult = { __typename: "MusicSegment" };
      const voiceResult = { __typename: "VoiceSegment" };

      expect(mixResolvers.MixSegment.__resolveType(musicResult as any)).toBe(
        "MusicSegment",
      );
      expect(mixResolvers.MixSegment.__resolveType(voiceResult as any)).toBe(
        "VoiceSegment",
      );
    });
  });

  describe("Segment Transformation", () => {
    it("transforms music segment with all fields", async () => {
      const context = createMockContext({ userId: "user-123" });
      const segment = createTestMusicSegment();
      const mockMix = createTestMix({ segments: [segment] });
      (context.mixService.getMix as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockMix,
      );

      const result = await mixResolvers.Query.mix(
        null,
        { id: "mix-uuid-123" },
        context,
      );

      const musicSegment = (result as any).segments[0];
      expect(musicSegment.__typename).toBe("MusicSegment");
      expect(musicSegment.id).toBe("segment-1");
      expect(musicSegment.type).toBe("music");
      expect(musicSegment.startMs).toBe(0);
      expect(musicSegment.endMs).toBe(180000);
      expect(musicSegment.durationMs).toBe(180000);
      expect(musicSegment.tidalTrackId).toBe("track-123");
      expect(musicSegment.isrc).toBe("USRC12345678");
      expect(musicSegment.trackTitle).toBe("Test Track");
      expect(musicSegment.artistName).toBe("Test Artist");
      expect(musicSegment.albumArtUrl).toBe("https://example.com/art.jpg");
    });

    it("transforms voice segment with all fields", async () => {
      const context = createMockContext({ userId: "user-123" });
      const segment = createTestVoiceSegment();
      const mockMix = createTestMix({ segments: [segment] });
      (context.mixService.getMix as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockMix,
      );

      const result = await mixResolvers.Query.mix(
        null,
        { id: "mix-uuid-123" },
        context,
      );

      const voiceSegment = (result as any).segments[0];
      expect(voiceSegment.__typename).toBe("VoiceSegment");
      expect(voiceSegment.id).toBe("segment-2");
      expect(voiceSegment.type).toBe("voice");
      expect(voiceSegment.startMs).toBe(180000);
      expect(voiceSegment.endMs).toBe(300000);
      expect(voiceSegment.durationMs).toBe(120000);
      expect(voiceSegment.audioUrl).toBe(
        "https://storage.example.com/voice.mp3",
      );
      expect(voiceSegment.sourceType).toBe("article");
      expect(voiceSegment.sourceId).toBe("article-123");
      expect(voiceSegment.sourceTitle).toBe("Test Article");
      expect(voiceSegment.sourceUrl).toBe("https://example.com/article");
      expect(voiceSegment.contentMode).toBe("summary");
    });

    it("handles optional fields as null when undefined", async () => {
      const context = createMockContext({ userId: "user-123" });
      const segment: MixSegment = {
        id: "minimal-segment",
        type: "music",
        startMs: 0,
        endMs: 180000,
        durationMs: 180000,
        // All optional fields undefined
      };
      const mockMix = createTestMix({ segments: [segment] });
      (context.mixService.getMix as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockMix,
      );

      const result = await mixResolvers.Query.mix(
        null,
        { id: "mix-uuid-123" },
        context,
      );

      const musicSegment = (result as any).segments[0];
      expect(musicSegment.__typename).toBe("MusicSegment");
      expect(musicSegment.tidalTrackId).toBeNull();
      expect(musicSegment.isrc).toBeNull();
      expect(musicSegment.trackTitle).toBeNull();
      expect(musicSegment.artistName).toBeNull();
      expect(musicSegment.albumArtUrl).toBeNull();
    });
  });
});
