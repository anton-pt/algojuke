/**
 * Track Existence Check Contract
 *
 * This file defines the TypeScript interface contract for track existence
 * checking in the Qdrant vector index.
 *
 * Implementation location: services/search-index/src/client/existence.ts
 */

import { z } from 'zod';

// ============================================================================
// Input Schemas
// ============================================================================

/**
 * ISRC validation schema
 */
export const IsrcSchema = z.string().length(12).regex(/^[A-Z0-9]{12}$/i, {
  message: 'ISRC must be 12 alphanumeric characters',
});

/**
 * Batch existence check request
 */
export const ExistenceCheckRequestSchema = z.object({
  /** Array of ISRCs to check */
  isrcs: z.array(IsrcSchema).min(1).max(1000),
  /** Collection name (defaults to 'tracks') */
  collection: z.string().optional(),
});

export type ExistenceCheckRequest = z.infer<typeof ExistenceCheckRequestSchema>;

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result of batch existence check
 */
export interface ExistenceCheckResult {
  /** Map of ISRC to existence boolean */
  exists: Map<string, boolean>;
  /** Number of ISRCs checked */
  total: number;
  /** Number of ISRCs found in index */
  found: number;
  /** Whether the check encountered errors */
  hasError: boolean;
  /** Error message if check failed */
  error?: string;
}

// ============================================================================
// Service Interface Contract
// ============================================================================

/**
 * Track existence checker interface
 *
 * Implementation requirements:
 * - MUST use hashIsrcToUuid() for consistent point ID generation
 * - MUST handle Qdrant unavailability gracefully (return empty map)
 * - MUST support batch checking up to 1000 ISRCs
 * - SHOULD complete within 1 second for 100 ISRCs
 */
export interface ITrackExistenceChecker {
  /**
   * Check if a single track exists in the index
   *
   * @param isrc - Track ISRC
   * @returns true if track exists, false otherwise
   */
  exists(isrc: string): Promise<boolean>;

  /**
   * Check if multiple tracks exist in the index
   *
   * @param isrcs - Array of ISRCs to check
   * @returns Map of ISRC to existence boolean
   *
   * Behavior:
   * - Converts ISRCs to UUIDs using hashIsrcToUuid
   * - Queries Qdrant retrieve endpoint with IDs
   * - Returns Map with all ISRCs; missing from response = false
   * - On error, logs and returns empty Map (fail-open)
   */
  checkBatch(isrcs: string[]): Promise<Map<string, boolean>>;

  /**
   * Check existence with full result details
   *
   * @param request - Existence check request
   * @returns Detailed result including error info
   */
  checkWithDetails(request: ExistenceCheckRequest): Promise<ExistenceCheckResult>;
}

// ============================================================================
// ISRC to UUID Conversion
// ============================================================================

/**
 * Contract for ISRC to UUID conversion
 *
 * Must match implementation in services/search-index/src/utils/isrcHash.ts
 * and services/worker/src/inngest/functions/trackIngestion.ts
 */
export interface IsrcHasher {
  /**
   * Convert ISRC to deterministic UUID
   *
   * Algorithm:
   * 1. Normalize ISRC to uppercase
   * 2. Hash with SHA-256 using namespace UUID
   * 3. Format as UUID v5 style string
   *
   * @param isrc - 12-character ISRC
   * @returns UUID string
   */
  hashIsrcToUuid(isrc: string): string;
}

/**
 * Namespace UUID for ISRC hashing
 * Must match value in trackIngestion.ts
 */
export const ISRC_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
