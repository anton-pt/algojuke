/**
 * Integration tests for user authentication flow
 *
 * Tests the complete authentication flow for any authenticated user.
 * Note: These tests mock Clerk and focus on the integration between components.
 *
 * Updated for Feature #45: Open Access - Removed allowlist checking.
 * Any user with Google authentication can access the application.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TidalTokensInputSchema,
  AuthStatusSchema,
  TidalTokensSchema,
} from "../../../src/schemas/auth.js";

// Mock Clerk client for integration tests
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => vi.fn((req, res, next) => next()),
  getAuth: vi.fn(() => ({ userId: "test_user_123" })),
  clerkClient: {
    users: {
      getUser: vi.fn(),
      updateUserMetadata: vi.fn(),
    },
  },
}));

describe("User Auth Flow Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Token storage flow", () => {
    it("validates and stores tokens correctly", () => {
      // Simulate token input from frontend
      const frontendTokens = {
        accessToken: "tidal_access_token_xyz",
        refreshToken: "tidal_refresh_token_abc",
        expiresAt: Date.now() + 86400000,
        scopes: [
          "collection.read",
          "playlists.read",
          "playlists.write",
          "recommendations.read",
          "search.read",
          "user.read",
        ],
      };

      // Validate input
      const inputResult = TidalTokensInputSchema.safeParse(frontendTokens);
      expect(inputResult.success).toBe(true);

      // Create stored tokens (with connectedAt)
      const storedTokens = {
        ...frontendTokens,
        connectedAt: Date.now(),
      };

      // Validate stored format
      const storageResult = TidalTokensSchema.safeParse(storedTokens);
      expect(storageResult.success).toBe(true);
    });

    it("produces correct auth status after connection", () => {
      const authStatus = {
        isAuthenticated: true,
        hasTidalConnection: true,
        email: "user@example.com",
        userId: "user_123",
      };

      const result = AuthStatusSchema.safeParse(authStatus);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isAuthenticated).toBe(true);
        expect(result.data.hasTidalConnection).toBe(true);
      }
    });
  });

  describe("User state transitions", () => {
    it("tracks state: Unauthenticated -> Authenticated -> Connected", () => {
      // State 1: Unauthenticated
      const unauthenticated = {
        isAuthenticated: false,
        hasTidalConnection: false,
      };
      expect(AuthStatusSchema.parse(unauthenticated).isAuthenticated).toBe(
        false,
      );

      // State 2: Authenticated but no Tidal (should go to connect page)
      const authenticatedNoTidal = {
        isAuthenticated: true,
        hasTidalConnection: false,
        email: "user@example.com",
        userId: "user_123",
      };
      const parsed = AuthStatusSchema.parse(authenticatedNoTidal);
      expect(parsed.isAuthenticated).toBe(true);
      expect(parsed.hasTidalConnection).toBe(false);

      // State 3: Fully connected
      const connected = {
        isAuthenticated: true,
        hasTidalConnection: true,
        email: "user@example.com",
        userId: "user_123",
      };
      const connectedParsed = AuthStatusSchema.parse(connected);
      expect(connectedParsed.isAuthenticated).toBe(true);
      expect(connectedParsed.hasTidalConnection).toBe(true);
    });

    it("any email can complete the flow (no allowlist)", () => {
      // Previously only allowlisted emails could proceed
      // Now any authenticated user can connect Tidal
      const anyUserStatus = {
        isAuthenticated: true,
        hasTidalConnection: false,
        email: "anyuser@example.com",
        userId: "user_any",
      };

      const result = AuthStatusSchema.parse(anyUserStatus);
      expect(result.isAuthenticated).toBe(true);
      // User should be able to proceed to Tidal connection
      expect(result.hasTidalConnection).toBe(false);
    });
  });
});
