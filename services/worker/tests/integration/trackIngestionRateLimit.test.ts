/**
 * Track Ingestion Rate Limiting Tests
 *
 * Tests that verify throttle configuration and rate limit handling.
 * These tests validate:
 * - Throttle configuration is applied to function
 * - 429 responses from external APIs are retryable
 * - Rate limiting protects against quota exhaustion
 *
 * Note: Full throttle testing requires Inngest Dev Server.
 * See quickstart.md for manual validation steps.
 */

import { describe, it, expect } from "vitest";
import { trackIngestion } from "../../src/inngest/functions/trackIngestion.js";
import { isRetryableError, createAPIError } from "../../src/clients/errors.js";

describe("Track Ingestion Rate Limiting", () => {
  describe("Throttle Configuration", () => {
    it("should have throttle limit configured", () => {
      // Access the function configuration
      const config = (trackIngestion as unknown as { opts: { throttle?: { limit: number; period: string } } }).opts;

      // Verify throttle is configured
      expect(config.throttle).toBeDefined();
      expect(config.throttle?.limit).toBe(10);
      expect(config.throttle?.period).toBe("1m");
    });

    it("should have reasonable concurrency limit", () => {
      const config = (trackIngestion as unknown as { opts: { concurrency?: { limit: number } } }).opts;

      expect(config.concurrency).toBeDefined();
      expect(config.concurrency?.limit).toBe(10);
    });

    it("should have retry configuration", () => {
      const config = (trackIngestion as unknown as { opts: { retries?: number } }).opts;

      expect(config.retries).toBeDefined();
      expect(config.retries).toBe(5);
    });

    it("should have idempotency key on ISRC", () => {
      const config = (trackIngestion as unknown as { opts: { idempotency?: string } }).opts;

      expect(config.idempotency).toBe("event.data.isrc");
    });
  });

  describe("Rate Limit Error Handling", () => {
    it("should mark 429 errors as retryable", () => {
      const rateLimitError = createAPIError(429, "TestService", "Rate limit exceeded");

      expect(isRetryableError(rateLimitError)).toBe(true);
    });

    it("should not mark 401 errors as retryable", () => {
      const authError = createAPIError(401, "TestService", "Unauthorized");

      expect(isRetryableError(authError)).toBe(false);
    });

    it("should not mark 404 errors as retryable", () => {
      const notFoundError = createAPIError(404, "TestService", "Not found");

      expect(isRetryableError(notFoundError)).toBe(false);
    });

    it("should mark 500+ errors as retryable", () => {
      const serverError = createAPIError(500, "TestService", "Internal server error");
      const gatewayError = createAPIError(502, "TestService", "Bad gateway");
      const serviceError = createAPIError(503, "TestService", "Service unavailable");

      expect(isRetryableError(serverError)).toBe(true);
      expect(isRetryableError(gatewayError)).toBe(true);
      expect(isRetryableError(serviceError)).toBe(true);
    });
  });

  describe("ReccoBeats Rate Limiting", () => {
    it("should create retryable error for 429 response", () => {
      // Test the error classification logic
      const error = createAPIError(429, "ReccoBeats", "Rate limit exceeded");

      expect(error.statusCode).toBe(429);
      expect(error.service).toBe("ReccoBeats");
      expect(error.retryable).toBe(true);
    });
  });

  describe("Musixmatch Rate Limiting", () => {
    it("should create retryable error for 429 response", () => {
      // Test the error classification logic
      const error = createAPIError(429, "Musixmatch", "Rate limit exceeded");

      expect(error.statusCode).toBe(429);
      expect(error.service).toBe("Musixmatch");
      expect(error.retryable).toBe(true);
    });
  });

  describe("Throttle Behavior", () => {
    /**
     * This test documents expected throttle behavior.
     * Full validation requires running with Inngest Dev Server:
     *
     * 1. Start Inngest: docker compose up inngest -d
     * 2. Start worker: npm run dev
     * 3. Queue 30 tasks rapidly via curl
     * 4. Observe in Inngest dashboard that execution rate stays at 10/minute
     *
     * See scripts/test-rate-limits.sh for automated validation.
     */
    it("should document throttle configuration (10 per minute)", () => {
      const config = (trackIngestion as unknown as { opts: { throttle?: { limit: number; period: string } } }).opts;

      // Document the expected behavior
      expect(config.throttle).toEqual({
        limit: 10,
        period: "1m",
      });
    });
  });
});
