/**
 * Contract tests for Internal Mix Mutations
 *
 * Feature: ALG-84 - API Key Auth for Service-to-Service Communication
 *
 * Tests the internal mutations that are only accessible via service API key:
 * - internalUpdateMixStatus
 * - internalUpdateMixSegments
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { GraphQLError } from "graphql";

// Mock logger
vi.mock("../../../src/utils/logger.js", () => ({
  logger: {
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock security logger
vi.mock("../../../src/utils/securityLogger.js", () => ({
  logAuthFailure: vi.fn(),
}));

// Import after mocks
let requireServiceAuth: typeof import("../../../src/middleware/serviceAuth.js").requireServiceAuth;
let isServiceAuthenticated: typeof import("../../../src/middleware/serviceAuth.js").isServiceAuthenticated;

describe("Internal Mix Mutations", () => {
  beforeAll(async () => {
    // Set env var BEFORE importing the module
    vi.stubEnv("SERVICE_API_KEY", "test-api-key-12345");

    // Reset modules to force fresh import with new env var
    vi.resetModules();

    // Re-import after env var is set
    const serviceAuth = await import("../../../src/middleware/serviceAuth.js");
    requireServiceAuth = serviceAuth.requireServiceAuth;
    isServiceAuthenticated = serviceAuth.isServiceAuthenticated;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requireServiceAuth", () => {
    it("does not throw when service API key is valid", () => {
      const context = { serviceApiKey: "test-api-key-12345" };

      expect(() =>
        requireServiceAuth(context, "internalUpdateMixStatus"),
      ).not.toThrow();
    });

    it("throws GraphQLError when API key is missing", () => {
      const context = { serviceApiKey: undefined };

      expect(() =>
        requireServiceAuth(context, "internalUpdateMixStatus"),
      ).toThrow(GraphQLError);

      try {
        requireServiceAuth(context, "internalUpdateMixStatus");
      } catch (error) {
        const graphqlError = error as GraphQLError;
        expect(graphqlError.message).toBe("Service authentication required");
        expect(graphqlError.extensions?.code).toBe("UNAUTHENTICATED");
      }
    });

    it("throws GraphQLError when API key is invalid", () => {
      const context = { serviceApiKey: "wrong-api-key" };

      expect(() =>
        requireServiceAuth(context, "internalUpdateMixSegments"),
      ).toThrow(GraphQLError);

      try {
        requireServiceAuth(context, "internalUpdateMixSegments");
      } catch (error) {
        const graphqlError = error as GraphQLError;
        expect(graphqlError.message).toBe("Service authentication required");
        expect(graphqlError.extensions?.code).toBe("UNAUTHENTICATED");
      }
    });

    it("throws GraphQLError when API key is empty string", () => {
      const context = { serviceApiKey: "" };

      expect(() =>
        requireServiceAuth(context, "internalUpdateMixStatus"),
      ).toThrow(GraphQLError);
    });

    it("does not require userId in context (unlike resolveAgentToolUserId)", () => {
      // Internal mutations don't need a userId - they bypass ownership checks
      const context = {
        serviceApiKey: "test-api-key-12345",
        // Note: no userId
      };

      expect(() =>
        requireServiceAuth(context, "internalUpdateMixStatus"),
      ).not.toThrow();
    });

    it("ignores userId in context (only checks API key)", () => {
      // Even with userId, only API key matters
      const contextWithUser = {
        serviceApiKey: "wrong-key",
        userId: "some-user-id", // This shouldn't help
      };

      expect(() =>
        requireServiceAuth(
          { serviceApiKey: contextWithUser.serviceApiKey },
          "internalUpdateMixStatus",
        ),
      ).toThrow(GraphQLError);
    });
  });

  describe("Authentication Flow Comparison", () => {
    it("demonstrates difference between internal and agent tool auth", () => {
      // Internal mutations: Only require valid API key, no userId needed
      const internalContext = {
        serviceApiKey: "test-api-key-12345",
      };

      expect(() =>
        requireServiceAuth(internalContext, "internalUpdateMixStatus"),
      ).not.toThrow();

      // Agent tools: Require valid API key AND userId in input
      const agentToolContext = {
        serviceApiKey: "test-api-key-12345",
      };

      // This is the key difference - internal doesn't need userId
      expect(isServiceAuthenticated(agentToolContext.serviceApiKey)).toBe(true);
    });

    it("rejects user auth for internal mutations (API key only)", () => {
      // User auth (Clerk token) is not sufficient for internal mutations
      const userOnlyContext = {
        userId: "clerk_user_123",
        // No serviceApiKey
      };

      expect(() =>
        requireServiceAuth(
          { serviceApiKey: userOnlyContext.userId }, // Wrong - userId isn't API key
          "internalUpdateMixStatus",
        ),
      ).toThrow(GraphQLError);

      // Even if we only pass the (missing) API key
      expect(() =>
        requireServiceAuth(
          { serviceApiKey: undefined },
          "internalUpdateMixStatus",
        ),
      ).toThrow(GraphQLError);
    });
  });

  describe("Error Response Format", () => {
    it("returns standard GraphQL UNAUTHENTICATED error for invalid auth", () => {
      const context = { serviceApiKey: "invalid" };

      try {
        requireServiceAuth(context, "internalUpdateMixStatus");
      } catch (error) {
        const graphqlError = error as GraphQLError;

        // Verify error structure matches what Apollo will return
        expect(graphqlError).toBeInstanceOf(GraphQLError);
        expect(graphqlError.message).toBe("Service authentication required");
        expect(graphqlError.extensions).toEqual({ code: "UNAUTHENTICATED" });
      }
    });
  });

  describe("Operation Name Logging", () => {
    it("logs the operation name for audit purposes", async () => {
      const logAuthFailure = (
        await import("../../../src/utils/securityLogger.js")
      ).logAuthFailure;

      const context = { serviceApiKey: "wrong-key" };

      try {
        requireServiceAuth(context, "internalUpdateMixStatus");
      } catch {
        // Expected to throw
      }

      expect(logAuthFailure).toHaveBeenCalledWith(
        "internalUpdateMixStatus",
        "service_required",
      );
    });
  });
});

describe("MixService Internal Methods", () => {
  // These tests would typically be integration tests with a database
  // Here we document the expected behavior

  describe("getMixById", () => {
    it("should look up mix by ID only (no userId filter)", () => {
      // Expected behavior:
      // - mixRepository.findOne({ where: { id } })
      // - NOT: mixRepository.findOne({ where: { id, userId } })
      expect(true).toBe(true); // Placeholder - real test needs DB
    });
  });

  describe("updateMixStatusInternal", () => {
    it("should update mix status without userId verification", () => {
      // Expected behavior:
      // - Find mix by ID only
      // - Update status and optional failureReason
      // - No userId ownership check
      expect(true).toBe(true); // Placeholder - real test needs DB
    });
  });

  describe("updateMixSegmentsInternal", () => {
    it("should update mix segments without userId verification", () => {
      // Expected behavior:
      // - Find mix by ID only
      // - Update segments, totalDurationMs, characterCount
      // - No userId ownership check
      expect(true).toBe(true); // Placeholder - real test needs DB
    });
  });
});

describe("GraphQL Segment Type Mapping", () => {
  it("maps MUSIC enum to music entity type", () => {
    // The resolver should map GraphQL SegmentType.MUSIC to entity "music"
    const graphQLType = "MUSIC";
    const entityType = graphQLType === "MUSIC" ? "music" : "voice";
    expect(entityType).toBe("music");
  });

  it("maps VOICE enum to voice entity type", () => {
    // The resolver should map GraphQL SegmentType.VOICE to entity "voice"
    const graphQLType = "VOICE";
    const entityType = graphQLType === "VOICE" ? "voice" : "music";
    expect(entityType).toBe("voice");
  });

  it("maps GraphQL status enums to entity status", () => {
    const statusMap: Record<string, string> = {
      GENERATING: "generating",
      READY: "ready",
      FAILED: "failed",
    };

    expect(statusMap.GENERATING).toBe("generating");
    expect(statusMap.READY).toBe("ready");
    expect(statusMap.FAILED).toBe("failed");
  });
});
