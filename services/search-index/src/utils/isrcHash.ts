/**
 * ISRC to UUID hashing utility for deterministic point IDs
 */

import { createHash } from 'crypto';

/**
 * Namespace UUID for ISRC hashing (UUID v5)
 * Generated once for algojuke project using DNS namespace
 */
const ISRC_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // Standard DNS namespace

/**
 * Hash ISRC to deterministic UUID
 *
 * Uses SHA-256 hash of ISRC to generate a UUID v5-compatible identifier.
 * Same ISRC always produces same UUID, enabling idempotent upserts.
 *
 * @param isrc - International Standard Recording Code (12 alphanumeric chars)
 * @returns UUID string for use as Qdrant point ID
 * @example
 * ```ts
 * const pointId = hashIsrcToUuid('USRC17607839');
 * // Always returns same UUID for same ISRC
 * ```
 */
export function hashIsrcToUuid(isrc: string): string {
  // Validate ISRC format (12 alphanumeric characters)
  if (!/^[A-Z0-9]{12}$/i.test(isrc)) {
    throw new Error(`Invalid ISRC format: ${isrc}. Expected 12 alphanumeric characters.`);
  }

  // Normalize to uppercase for consistent hashing
  const normalizedIsrc = isrc.toUpperCase();

  // Create deterministic hash from ISRC with namespace
  const hash = createHash('sha256')
    .update(ISRC_NAMESPACE)
    .update(normalizedIsrc)
    .digest('hex');

  // Format as UUID v5 (8-4-4-4-12)
  const uuid = [
    hash.substring(0, 8),
    hash.substring(8, 12),
    hash.substring(12, 16),
    hash.substring(16, 20),
    hash.substring(20, 32),
  ].join('-');

  return uuid;
}

/**
 * Validate ISRC format without hashing
 * @param isrc - ISRC string to validate
 * @returns true if valid, false otherwise
 */
export function isValidIsrc(isrc: string): boolean {
  return /^[A-Z0-9]{12}$/i.test(isrc);
}
