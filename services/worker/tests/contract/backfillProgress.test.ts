/**
 * Contract tests for BackfillProgress schema
 *
 * Validates the Zod schema for tracking short description backfill progress.
 */

import { describe, it, expect } from "vitest";
import {
  BackfillProgressSchema,
  createInitialProgress,
  validateBackfillProgress,
  safeValidateBackfillProgress,
} from "../../src/schemas/backfillProgress.js";

describe("BackfillProgressSchema", () => {
  describe("valid progress states", () => {
    it("should accept initial progress state", () => {
      const progress = createInitialProgress();
      const result = BackfillProgressSchema.safeParse(progress);
      expect(result.success).toBe(true);
    });

    it("should accept progress with lastPointId", () => {
      const progress = {
        lastPointId: "123e4567-e89b-12d3-a456-426614174000",
        processedCount: 100,
        successCount: 95,
        errorCount: 3,
        skippedCount: 2,
        startedAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T01:00:00.000Z",
        isComplete: false,
      };
      const result = BackfillProgressSchema.safeParse(progress);
      expect(result.success).toBe(true);
    });

    it("should accept completed progress", () => {
      const progress = {
        lastPointId: "123e4567-e89b-12d3-a456-426614174000",
        processedCount: 1000,
        successCount: 980,
        errorCount: 10,
        skippedCount: 10,
        startedAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T02:00:00.000Z",
        isComplete: true,
      };
      const result = BackfillProgressSchema.safeParse(progress);
      expect(result.success).toBe(true);
    });

    it("should accept null lastPointId for initial state", () => {
      const progress = {
        lastPointId: null,
        processedCount: 0,
        successCount: 0,
        errorCount: 0,
        skippedCount: 0,
        startedAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
        isComplete: false,
      };
      const result = BackfillProgressSchema.safeParse(progress);
      expect(result.success).toBe(true);
    });
  });

  describe("count validation", () => {
    it("should reject negative processedCount", () => {
      const progress = {
        lastPointId: null,
        processedCount: -1,
        successCount: 0,
        errorCount: 0,
        skippedCount: 0,
        startedAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
        isComplete: false,
      };
      const result = BackfillProgressSchema.safeParse(progress);
      expect(result.success).toBe(false);
    });

    it("should reject negative successCount", () => {
      const progress = {
        lastPointId: null,
        processedCount: 0,
        successCount: -1,
        errorCount: 0,
        skippedCount: 0,
        startedAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
        isComplete: false,
      };
      const result = BackfillProgressSchema.safeParse(progress);
      expect(result.success).toBe(false);
    });

    it("should reject negative errorCount", () => {
      const progress = {
        lastPointId: null,
        processedCount: 0,
        successCount: 0,
        errorCount: -1,
        skippedCount: 0,
        startedAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
        isComplete: false,
      };
      const result = BackfillProgressSchema.safeParse(progress);
      expect(result.success).toBe(false);
    });

    it("should reject negative skippedCount", () => {
      const progress = {
        lastPointId: null,
        processedCount: 0,
        successCount: 0,
        errorCount: 0,
        skippedCount: -1,
        startedAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
        isComplete: false,
      };
      const result = BackfillProgressSchema.safeParse(progress);
      expect(result.success).toBe(false);
    });
  });

  describe("timestamp validation", () => {
    it("should reject invalid startedAt timestamp", () => {
      const progress = {
        lastPointId: null,
        processedCount: 0,
        successCount: 0,
        errorCount: 0,
        skippedCount: 0,
        startedAt: "not-a-date",
        updatedAt: "2025-01-01T00:00:00.000Z",
        isComplete: false,
      };
      const result = BackfillProgressSchema.safeParse(progress);
      expect(result.success).toBe(false);
    });

    it("should reject invalid updatedAt timestamp", () => {
      const progress = {
        lastPointId: null,
        processedCount: 0,
        successCount: 0,
        errorCount: 0,
        skippedCount: 0,
        startedAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "not-a-date",
        isComplete: false,
      };
      const result = BackfillProgressSchema.safeParse(progress);
      expect(result.success).toBe(false);
    });
  });

  describe("lastPointId validation", () => {
    it("should reject invalid UUID format", () => {
      const progress = {
        lastPointId: "not-a-uuid",
        processedCount: 0,
        successCount: 0,
        errorCount: 0,
        skippedCount: 0,
        startedAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
        isComplete: false,
      };
      const result = BackfillProgressSchema.safeParse(progress);
      expect(result.success).toBe(false);
    });
  });
});

describe("createInitialProgress", () => {
  it("should return valid initial progress", () => {
    const progress = createInitialProgress();

    expect(progress.lastPointId).toBeNull();
    expect(progress.processedCount).toBe(0);
    expect(progress.successCount).toBe(0);
    expect(progress.errorCount).toBe(0);
    expect(progress.skippedCount).toBe(0);
    expect(progress.isComplete).toBe(false);
    expect(progress.startedAt).toBeDefined();
    expect(progress.updatedAt).toBeDefined();
  });

  it("should set timestamps to current time", () => {
    const before = new Date();
    const progress = createInitialProgress();
    const after = new Date();

    const startedAt = new Date(progress.startedAt);
    expect(startedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(startedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

describe("validateBackfillProgress", () => {
  it("should return validated progress for valid input", () => {
    const progress = createInitialProgress();
    const result = validateBackfillProgress(progress);
    expect(result.processedCount).toBe(0);
  });

  it("should throw for invalid input", () => {
    expect(() => validateBackfillProgress({ invalid: true })).toThrow();
  });
});

describe("safeValidateBackfillProgress", () => {
  it("should return success for valid input", () => {
    const progress = createInitialProgress();
    const result = safeValidateBackfillProgress(progress);
    expect(result.success).toBe(true);
  });

  it("should return error for invalid input", () => {
    const result = safeValidateBackfillProgress({ invalid: true });
    expect(result.success).toBe(false);
  });
});
