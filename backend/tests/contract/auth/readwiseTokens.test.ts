/**
 * Contract tests for Readwise token schema
 *
 * Tests the Readwise tokens schema validation.
 */

import { describe, it, expect } from "vitest";
import {
  ReadwiseTokensSchema,
  ReadwiseErrorCodeSchema,
} from "../../../src/schemas/auth.js";

describe("Readwise token contracts", () => {
  describe("ReadwiseTokensSchema", () => {
    it("validates valid token data", () => {
      const input = {
        accessToken: "readwise_token_123",
        connectedAt: Date.now(),
      };

      const result = ReadwiseTokensSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects empty access token", () => {
      const input = {
        accessToken: "",
        connectedAt: Date.now(),
      };

      const result = ReadwiseTokensSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects missing access token", () => {
      const input = {
        connectedAt: Date.now(),
      };

      const result = ReadwiseTokensSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects negative connectedAt", () => {
      const input = {
        accessToken: "readwise_token_123",
        connectedAt: -1,
      };

      const result = ReadwiseTokensSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects zero connectedAt", () => {
      const input = {
        accessToken: "readwise_token_123",
        connectedAt: 0,
      };

      const result = ReadwiseTokensSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects missing connectedAt", () => {
      const input = {
        accessToken: "readwise_token_123",
      };

      const result = ReadwiseTokensSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("ReadwiseErrorCodeSchema", () => {
    it("validates INVALID_TOKEN", () => {
      const result = ReadwiseErrorCodeSchema.safeParse("INVALID_TOKEN");
      expect(result.success).toBe(true);
    });

    it("validates TOKEN_REVOKED", () => {
      const result = ReadwiseErrorCodeSchema.safeParse("TOKEN_REVOKED");
      expect(result.success).toBe(true);
    });

    it("validates NETWORK_ERROR", () => {
      const result = ReadwiseErrorCodeSchema.safeParse("NETWORK_ERROR");
      expect(result.success).toBe(true);
    });

    it("validates TIMEOUT", () => {
      const result = ReadwiseErrorCodeSchema.safeParse("TIMEOUT");
      expect(result.success).toBe(true);
    });

    it("validates UNKNOWN", () => {
      const result = ReadwiseErrorCodeSchema.safeParse("UNKNOWN");
      expect(result.success).toBe(true);
    });

    it("rejects invalid error codes", () => {
      const result = ReadwiseErrorCodeSchema.safeParse("INVALID_CODE");
      expect(result.success).toBe(false);
    });

    it("rejects empty string", () => {
      const result = ReadwiseErrorCodeSchema.safeParse("");
      expect(result.success).toBe(false);
    });
  });
});
