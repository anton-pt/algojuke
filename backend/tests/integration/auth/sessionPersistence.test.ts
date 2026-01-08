/**
 * Integration tests for session persistence
 *
 * Tests that Clerk session survives browser refresh (FR-012).
 *
 * Note: These are contract-level tests validating the session data structure.
 * Actual browser refresh behavior is handled by Clerk SDK and requires E2E testing.
 *
 * Updated for Feature #45: Open Access - Removed isApproved field and allowlist checks.
 * All authenticated users are implicitly approved.
 */

import { describe, it, expect } from "vitest";
import {
  AuthStatusSchema,
  TidalTokenStatusSchema,
} from "../../../src/schemas/auth.js";

describe("Session Persistence Integration", () => {
  describe("Auth status across requests", () => {
    it("returns consistent auth status for authenticated user", () => {
      // Simulates multiple requests from same authenticated session
      const authStatus = {
        isAuthenticated: true,
        hasTidalConnection: true,
        email: "user@example.com",
        userId: "user_persistent_123",
      };

      // First request
      const result1 = AuthStatusSchema.safeParse(authStatus);
      expect(result1.success).toBe(true);

      // Second request (simulating page refresh - same data returned)
      const result2 = AuthStatusSchema.safeParse(authStatus);
      expect(result2.success).toBe(true);

      // Results should be identical
      if (result1.success && result2.success) {
        expect(result1.data.userId).toBe(result2.data.userId);
        expect(result1.data.isAuthenticated).toBe(result2.data.isAuthenticated);
      }
    });
  });

  describe("Tidal token persistence", () => {
    it("maintains Tidal connection status across requests", () => {
      // Tidal tokens stored in Clerk metadata persist across sessions
      const tokenStatus = {
        hasTokens: true,
        expiresAt: Date.now() + 86400000, // 24 hours
        isExpired: false,
        scopes: ["collection.read", "playlists.read", "user.read"],
      };

      // First request
      const result1 = TidalTokenStatusSchema.safeParse(tokenStatus);
      expect(result1.success).toBe(true);

      // Subsequent request (after refresh)
      const result2 = TidalTokenStatusSchema.safeParse(tokenStatus);
      expect(result2.success).toBe(true);

      if (result1.success && result2.success) {
        expect(result1.data.hasTokens).toBe(result2.data.hasTokens);
        expect(result1.data.expiresAt).toBe(result2.data.expiresAt);
      }
    });

    it("detects expired tokens correctly after session resume", () => {
      // Simulates returning to app after token expiration
      const expiredTokenStatus = {
        hasTokens: true,
        expiresAt: Date.now() - 3600000, // 1 hour ago
        isExpired: true,
        scopes: ["collection.read"],
      };

      const result = TidalTokenStatusSchema.safeParse(expiredTokenStatus);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isExpired).toBe(true);
      }
    });
  });

  describe("Session state transitions", () => {
    it("handles unauthenticated state correctly", () => {
      // Before sign-in or after sign-out
      const unauthStatus = {
        isAuthenticated: false,
        hasTidalConnection: false,
      };

      const result = AuthStatusSchema.safeParse(unauthStatus);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isAuthenticated).toBe(false);
        expect(result.data.email).toBeUndefined();
        expect(result.data.userId).toBeUndefined();
      }
    });

    it("handles authenticated but no Tidal state", () => {
      // User who hasn't connected Tidal yet
      const noTidalStatus = {
        isAuthenticated: true,
        hasTidalConnection: false,
        email: "user@example.com",
        userId: "user_no_tidal_789",
      };

      const result = AuthStatusSchema.safeParse(noTidalStatus);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isAuthenticated).toBe(true);
        expect(result.data.hasTidalConnection).toBe(false);
      }
    });

    it("handles fully connected state", () => {
      // Full access user
      const fullyConnectedStatus = {
        isAuthenticated: true,
        hasTidalConnection: true,
        email: "user@example.com",
        userId: "user_full_101",
      };

      const result = AuthStatusSchema.safeParse(fullyConnectedStatus);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isAuthenticated).toBe(true);
        expect(result.data.hasTidalConnection).toBe(true);
      }
    });
  });

  describe("Clerk session validation", () => {
    it("session contains required fields for routing decisions", () => {
      // Frontend routing depends on these fields
      const authStatus = {
        isAuthenticated: true,
        hasTidalConnection: false,
        email: "user@example.com",
        userId: "user_route_202",
      };

      const result = AuthStatusSchema.safeParse(authStatus);
      expect(result.success).toBe(true);
      if (result.success) {
        // ProtectedRoute uses these to determine redirect
        expect(typeof result.data.isAuthenticated).toBe("boolean");
        expect(typeof result.data.hasTidalConnection).toBe("boolean");
      }
    });

    it("session fields are nullable for unauthenticated users", () => {
      const unauthStatus = {
        isAuthenticated: false,
        hasTidalConnection: false,
      };

      const result = AuthStatusSchema.safeParse(unauthStatus);
      expect(result.success).toBe(true);
      // email and userId should not be present for unauthenticated users
      if (result.success) {
        expect(result.data.email).toBeUndefined();
        expect(result.data.userId).toBeUndefined();
      }
    });
  });
});
