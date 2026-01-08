/**
 * Integration tests for incomplete Tidal flow
 *
 * Tests the user experience when Tidal connection is interrupted.
 *
 * Updated for Feature #45: Open Access - Removed allowlist/approval references.
 * Any authenticated user can proceed to connect Tidal.
 */

import { describe, it, expect } from "vitest";
import {
  AuthStatusSchema,
  TidalTokenStatusSchema,
} from "../../../src/schemas/auth.js";

describe("Incomplete Tidal Flow Integration", () => {
  describe("Authenticated user without Tidal connection", () => {
    it("identifies user state correctly", () => {
      // Authenticated user who has not completed Tidal connection
      const authStatus = {
        isAuthenticated: true,
        hasTidalConnection: false,
        email: "user@example.com",
        userId: "user_123",
      };

      const result = AuthStatusSchema.safeParse(authStatus);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isAuthenticated).toBe(true);
        expect(result.data.hasTidalConnection).toBe(false);
      }
    });

    it("returns no tokens for user without Tidal connection", () => {
      const tokenStatus = {
        hasTokens: false,
      };

      const result = TidalTokenStatusSchema.safeParse(tokenStatus);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hasTokens).toBe(false);
        expect(result.data.expiresAt).toBeUndefined();
        expect(result.data.scopes).toBeUndefined();
      }
    });
  });

  describe("Returning user flow", () => {
    it("user authentication persists across sessions", () => {
      // Auth status shows authenticated but no Tidal
      const authStatus = {
        isAuthenticated: true,
        hasTidalConnection: false,
        email: "user@example.com",
        userId: "user_456",
      };

      const result = AuthStatusSchema.safeParse(authStatus);
      expect(result.success).toBe(true);
    });

    it("handles transition from no tokens to connected", () => {
      // State before connection
      const beforeConnection = {
        hasTokens: false,
      };
      expect(TidalTokenStatusSchema.parse(beforeConnection).hasTokens).toBe(
        false,
      );

      // State after connection
      const afterConnection = {
        hasTokens: true,
        expiresAt: Date.now() + 86400000,
        isExpired: false,
        scopes: ["collection.read", "playlists.read"],
      };
      const parsed = TidalTokenStatusSchema.parse(afterConnection);
      expect(parsed.hasTokens).toBe(true);
      expect(parsed.isExpired).toBe(false);
    });
  });

  describe("OAuth cancellation scenarios", () => {
    it("handles cancelled OAuth flow", () => {
      // User cancelled OAuth - returns to authenticated but no Tidal state
      const authStatus = {
        isAuthenticated: true,
        hasTidalConnection: false,
        email: "user@example.com",
        userId: "user_789",
      };

      const result = AuthStatusSchema.safeParse(authStatus);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hasTidalConnection).toBe(false);
      }
    });

    it("handles failed OAuth with retry option", () => {
      // After failed OAuth attempt, status remains authenticated without Tidal
      // User should be able to retry connection
      const tokenStatus = {
        hasTokens: false,
      };

      const result = TidalTokenStatusSchema.safeParse(tokenStatus);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hasTokens).toBe(false);
        // Frontend should show retry button based on this state
      }
    });
  });
});
