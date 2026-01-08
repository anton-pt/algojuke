/**
 * Contract tests for GET /api/auth/status endpoint
 *
 * Tests the authentication status endpoint response schema.
 *
 * Updated for Feature #45: Open Access - Removed isApproved field as
 * allowlist checking has been removed. All authenticated users are
 * implicitly approved.
 */

import { describe, it, expect } from "vitest";
import { AuthStatusSchema } from "../../../src/schemas/auth.js";

describe("GET /api/auth/status contract", () => {
  describe("AuthStatusSchema", () => {
    it("validates unauthenticated response", () => {
      const response = {
        isAuthenticated: false,
        hasTidalConnection: false,
      };

      const result = AuthStatusSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isAuthenticated).toBe(false);
        expect(result.data.hasTidalConnection).toBe(false);
        expect(result.data.email).toBeUndefined();
        expect(result.data.userId).toBeUndefined();
      }
    });

    it("validates authenticated user without Tidal response", () => {
      const response = {
        isAuthenticated: true,
        hasTidalConnection: false,
        email: "user@example.com",
        userId: "user_123",
      };

      const result = AuthStatusSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isAuthenticated).toBe(true);
        expect(result.data.hasTidalConnection).toBe(false);
        expect(result.data.email).toBe("user@example.com");
      }
    });

    it("validates fully connected user response", () => {
      const response = {
        isAuthenticated: true,
        hasTidalConnection: true,
        email: "user@example.com",
        userId: "user_456",
      };

      const result = AuthStatusSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isAuthenticated).toBe(true);
        expect(result.data.hasTidalConnection).toBe(true);
      }
    });

    it("validates response with tidalTokenExpired field", () => {
      const response = {
        isAuthenticated: true,
        hasTidalConnection: true,
        tidalTokenExpired: true,
        email: "user@example.com",
        userId: "user_456",
      };

      const result = AuthStatusSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tidalTokenExpired).toBe(true);
      }
    });

    it("rejects missing required fields", () => {
      const response = {
        isAuthenticated: true,
        // missing hasTidalConnection
      };

      const result = AuthStatusSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it("rejects invalid email format", () => {
      const response = {
        isAuthenticated: true,
        hasTidalConnection: true,
        email: "not-an-email",
        userId: "user_456",
      };

      const result = AuthStatusSchema.safeParse(response);
      expect(result.success).toBe(false);
    });
  });
});
