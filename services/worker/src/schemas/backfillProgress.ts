/**
 * Backfill Progress Schema
 *
 * Tracks progress of short description backfill for resumability.
 */

import { z } from "zod";

/**
 * Backfill progress state
 */
export const BackfillProgressSchema = z.object({
  /** Last processed point ID (Qdrant scroll offset) */
  lastPointId: z.string().uuid().nullable(),
  /** Total tracks processed so far */
  processedCount: z.number().int().nonnegative(),
  /** Tracks that successfully received short descriptions */
  successCount: z.number().int().nonnegative(),
  /** Tracks that failed to get short descriptions */
  errorCount: z.number().int().nonnegative(),
  /** Tracks skipped (already had short description) */
  skippedCount: z.number().int().nonnegative(),
  /** Timestamp when backfill started */
  startedAt: z.string().datetime(),
  /** Timestamp of last update */
  updatedAt: z.string().datetime(),
  /** Whether backfill is complete */
  isComplete: z.boolean(),
});

export type BackfillProgress = z.infer<typeof BackfillProgressSchema>;

/**
 * Create initial backfill progress state
 */
export function createInitialProgress(): BackfillProgress {
  const now = new Date().toISOString();
  return {
    lastPointId: null,
    processedCount: 0,
    successCount: 0,
    errorCount: 0,
    skippedCount: 0,
    startedAt: now,
    updatedAt: now,
    isComplete: false,
  };
}

/**
 * Validate backfill progress data
 */
export function validateBackfillProgress(data: unknown): BackfillProgress {
  return BackfillProgressSchema.parse(data);
}

/**
 * Safe validation that returns result object
 */
export function safeValidateBackfillProgress(data: unknown) {
  return BackfillProgressSchema.safeParse(data);
}
