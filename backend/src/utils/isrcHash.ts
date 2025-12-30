/**
 * ISRC to UUID Hashing Utility
 *
 * Generates deterministic UUIDs from ISRCs using SHA-256 hashing.
 * This ensures the same ISRC always produces the same UUID,
 * enabling idempotent operations across systems.
 *
 * The namespace UUID is used to prevent collisions with other
 * UUID generation schemes.
 */

import { createHash } from "crypto";
import { normalizeIsrc } from "./isrc.js";

/**
 * ISRC namespace UUID for deterministic UUID generation
 * Same as used in worker service for consistency
 */
const ISRC_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

/**
 * Hash ISRC to deterministic UUID
 *
 * Generates a consistent UUID from an ISRC using SHA-256 hashing.
 * The ISRC is normalized to uppercase before hashing.
 *
 * @param isrc - ISO 3901 ISRC (12 alphanumeric characters)
 * @returns UUID string in format "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 * @throws Error if ISRC is invalid
 *
 * @example
 * hashIsrcToUuid("USRC11700001") // => "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 */
export function hashIsrcToUuid(isrc: string): string {
  const normalizedIsrc = normalizeIsrc(isrc);

  const hash = createHash("sha256")
    .update(ISRC_NAMESPACE)
    .update(normalizedIsrc)
    .digest("hex");

  // Format as UUID: 8-4-4-4-12
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    hash.substring(12, 16),
    hash.substring(16, 20),
    hash.substring(20, 32),
  ].join("-");
}

/**
 * Batch hash ISRCs to UUIDs
 *
 * @param isrcs - Array of ISRCs to hash
 * @returns Map of ISRC to UUID
 */
export function batchHashIsrcsToUuids(isrcs: string[]): Map<string, string> {
  const result = new Map<string, string>();

  for (const isrc of isrcs) {
    try {
      const uuid = hashIsrcToUuid(isrc);
      result.set(isrc.toUpperCase(), uuid);
    } catch {
      // Skip invalid ISRCs
    }
  }

  return result;
}
