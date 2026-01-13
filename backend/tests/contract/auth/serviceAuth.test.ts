/**
 * Contract tests for Service Authentication Middleware
 *
 * Feature: ALG-77 - Cross-service agent tool invocation
 *
 * Tests the service authentication functions:
 * - isServiceAuthenticated: Validates API key against environment variable
 * - resolveAgentToolUserId: Handles dual auth (Clerk user auth + service API key)
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
import { GraphQLError } from "graphql";

// Mock logger first (before module import)
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

// Use dynamic import to allow env var to be set first
let isServiceAuthenticated: typeof import("../../../src/middleware/serviceAuth.js").isServiceAuthenticated;
let resolveAgentToolUserId: typeof import("../../../src/middleware/serviceAuth.js").resolveAgentToolUserId;
type ServiceAuthContext =
  import("../../../src/middleware/serviceAuth.js").ServiceAuthContext;

let logAuthFailure: typeof import("../../../src/utils/securityLogger.js").logAuthFailure;
let logger: typeof import("../../../src/utils/logger.js").logger;

describe("Service Authentication Middleware", () => {
  beforeAll(async () => {
    // Set env var BEFORE importing the module
    vi.stubEnv("SERVICE_API_KEY", "test-api-key-12345");

    // Reset modules to force fresh import with new env var
    vi.resetModules();

    // Re-import after env var is set
    const serviceAuth = await import("../../../src/middleware/serviceAuth.js");
    isServiceAuthenticated = serviceAuth.isServiceAuthenticated;
    resolveAgentToolUserId = serviceAuth.resolveAgentToolUserId;

    const securityLogger = await import("../../../src/utils/securityLogger.js");
    logAuthFailure = securityLogger.logAuthFailure;

    const loggerModule = await import("../../../src/utils/logger.js");
    logger = loggerModule.logger;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("isServiceAuthenticated", () => {
    it("returns true when API key matches environment variable", () => {
      expect(isServiceAuthenticated("test-api-key-12345")).toBe(true);
    });

    it("returns false when API key does not match", () => {
      expect(isServiceAuthenticated("wrong-api-key")).toBe(false);
    });

    it("returns false when API key is undefined", () => {
      expect(isServiceAuthenticated(undefined)).toBe(false);
    });

    it("returns false when API key is empty string", () => {
      expect(isServiceAuthenticated("")).toBe(false);
    });

    it("performs exact string comparison (no partial matches)", () => {
      expect(isServiceAuthenticated("test-api-key-123")).toBe(false);
      expect(isServiceAuthenticated("test-api-key-123456")).toBe(false);
      expect(isServiceAuthenticated("TEST-API-KEY-12345")).toBe(false);
    });
  });

  describe("resolveAgentToolUserId", () => {
    describe("User Auth (Clerk token)", () => {
      it("returns context userId when present (user auth takes precedence)", () => {
        const context: ServiceAuthContext = {
          userId: "clerk_user_123",
          serviceApiKey: "test-api-key-12345",
        };

        const result = resolveAgentToolUserId(
          context,
          "input_user_456",
          "testOperation",
        );

        expect(result).toBe("clerk_user_123");
      });

      it("returns context userId even without serviceApiKey", () => {
        const context: ServiceAuthContext = {
          userId: "clerk_user_123",
        };

        const result = resolveAgentToolUserId(context, null, "testOperation");

        expect(result).toBe("clerk_user_123");
      });

      it("logs user auth mode when using Clerk token", () => {
        const context: ServiceAuthContext = {
          userId: "clerk_user_123",
        };

        resolveAgentToolUserId(context, null, "agentSemanticSearch");

        expect(logger.debug).toHaveBeenCalledWith("agent_tool_user_auth", {
          operation: "agentSemanticSearch",
          userId: "clerk_user_123",
          authMode: "clerk",
        });
      });
    });

    describe("Service Auth (API key)", () => {
      it("returns input userId when service auth is valid and userId is provided", () => {
        const context: ServiceAuthContext = {
          serviceApiKey: "test-api-key-12345",
        };

        const result = resolveAgentToolUserId(
          context,
          "service_user_789",
          "testOperation",
        );

        expect(result).toBe("service_user_789");
      });

      it("logs service auth mode when using API key", () => {
        const context: ServiceAuthContext = {
          serviceApiKey: "test-api-key-12345",
        };

        resolveAgentToolUserId(context, "service_user_789", "agentTidalSearch");

        expect(logger.debug).toHaveBeenCalledWith("agent_tool_service_auth", {
          operation: "agentTidalSearch",
          userId: "service_user_789",
          authMode: "api_key",
        });
      });

      it("throws UNAUTHENTICATED when service auth is valid but userId is missing", () => {
        const context: ServiceAuthContext = {
          serviceApiKey: "test-api-key-12345",
        };

        expect(() =>
          resolveAgentToolUserId(context, undefined, "testOperation"),
        ).toThrow(GraphQLError);

        try {
          resolveAgentToolUserId(context, undefined, "testOperation");
        } catch (error) {
          const graphqlError = error as GraphQLError;
          expect(graphqlError.message).toBe(
            "userId is required in input for service authentication",
          );
          expect(graphqlError.extensions?.code).toBe("UNAUTHENTICATED");
        }
      });

      it("throws UNAUTHENTICATED when service auth is valid but userId is null", () => {
        const context: ServiceAuthContext = {
          serviceApiKey: "test-api-key-12345",
        };

        expect(() =>
          resolveAgentToolUserId(context, null, "testOperation"),
        ).toThrow(GraphQLError);
      });

      it("logs auth failure when userId is missing for service auth", () => {
        const context: ServiceAuthContext = {
          serviceApiKey: "test-api-key-12345",
        };

        try {
          resolveAgentToolUserId(context, null, "agentAlbumTracks");
        } catch {
          // Expected to throw
        }

        expect(logAuthFailure).toHaveBeenCalledWith(
          "agentAlbumTracks",
          "service",
        );
      });
    });

    describe("No Auth", () => {
      it("throws UNAUTHENTICATED when no auth is provided", () => {
        const context: ServiceAuthContext = {};

        expect(() =>
          resolveAgentToolUserId(context, null, "testOperation"),
        ).toThrow(GraphQLError);

        try {
          resolveAgentToolUserId(context, null, "testOperation");
        } catch (error) {
          const graphqlError = error as GraphQLError;
          expect(graphqlError.message).toBe("Authentication required");
          expect(graphqlError.extensions?.code).toBe("UNAUTHENTICATED");
        }
      });

      it("throws UNAUTHENTICATED when API key is invalid", () => {
        const context: ServiceAuthContext = {
          serviceApiKey: "invalid-key",
        };

        expect(() =>
          resolveAgentToolUserId(context, "user_123", "testOperation"),
        ).toThrow(GraphQLError);
      });

      it("logs auth failure with 'none' mode when no valid auth", () => {
        const context: ServiceAuthContext = {};

        try {
          resolveAgentToolUserId(context, null, "agentBatchMetadata");
        } catch {
          // Expected to throw
        }

        expect(logAuthFailure).toHaveBeenCalledWith(
          "agentBatchMetadata",
          "none",
        );
      });
    });

    describe("Auth Precedence", () => {
      it("user auth takes precedence over service auth", () => {
        // Even with valid API key and input userId, context userId wins
        const context: ServiceAuthContext = {
          userId: "clerk_user_primary",
          serviceApiKey: "test-api-key-12345",
        };

        const result = resolveAgentToolUserId(
          context,
          "input_user_secondary",
          "testOperation",
        );

        expect(result).toBe("clerk_user_primary");
        expect(logger.debug).toHaveBeenCalledWith(
          "agent_tool_user_auth",
          expect.objectContaining({ authMode: "clerk" }),
        );
      });
    });
  });

  describe("Integration patterns", () => {
    it("demonstrates typical agent tool resolver auth pattern", () => {
      // Simulates how the resolver would use resolveAgentToolUserId

      // Case 1: Frontend user with Clerk auth
      const frontendContext: ServiceAuthContext = {
        userId: "clerk_user_abc",
      };
      const frontendInput = { query: "happy songs", userId: null };

      const frontendUserId = resolveAgentToolUserId(
        frontendContext,
        frontendInput.userId,
        "agentSemanticSearch",
      );
      expect(frontendUserId).toBe("clerk_user_abc");

      // Case 2: Worker service with API key
      const workerContext: ServiceAuthContext = {
        serviceApiKey: "test-api-key-12345",
      };
      const workerInput = { query: "sad songs", userId: "target_user_xyz" };

      const workerUserId = resolveAgentToolUserId(
        workerContext,
        workerInput.userId,
        "agentSemanticSearch",
      );
      expect(workerUserId).toBe("target_user_xyz");
    });

    it("demonstrates error response format for UNAUTHENTICATED", () => {
      const context: ServiceAuthContext = {};

      try {
        resolveAgentToolUserId(context, null, "testOperation");
      } catch (error) {
        const graphqlError = error as GraphQLError;

        // This matches the expected GraphQL error response format
        const errorResponse = {
          errors: [
            {
              message: graphqlError.message,
              extensions: graphqlError.extensions,
            },
          ],
          data: null,
        };

        expect(errorResponse).toEqual({
          errors: [
            {
              message: "Authentication required",
              extensions: { code: "UNAUTHENTICATED" },
            },
          ],
          data: null,
        });
      }
    });
  });
});
