/**
 * ISRC Validation Utilities
 *
 * ISO 3901 International Standard Recording Code (ISRC) format:
 * - Exactly 12 alphanumeric characters
 * - Case-insensitive (normalized to uppercase)
 * - Format: CC-XXX-YY-NNNNN (without hyphens)
 *   - CC: Country code (2 chars)
 *   - XXX: Registrant code (3 chars)
 *   - YY: Year of reference (2 digits)
 *   - NNNNN: Designation code (5 digits)
 */

/**
 * ISRC validation regex pattern
 * Matches exactly 12 alphanumeric characters (case-insensitive)
 */
const ISRC_PATTERN = /^[A-Z0-9]{12}$/i;

/**
 * Validate ISRC format
 *
 * @param isrc - ISRC string to validate
 * @returns true if valid, false otherwise
 */
export function isValidIsrc(isrc: string | null | undefined): isrc is string {
  if (!isrc || typeof isrc !== "string") {
    return false;
  }
  return ISRC_PATTERN.test(isrc);
}

/**
 * Normalize ISRC to uppercase
 *
 * @param isrc - ISRC string to normalize
 * @returns Uppercase ISRC string
 * @throws Error if ISRC is invalid
 */
export function normalizeIsrc(isrc: string): string {
  if (!isValidIsrc(isrc)) {
    throw new Error(`Invalid ISRC format: ${isrc}`);
  }
  return isrc.toUpperCase();
}

/**
 * Validate and normalize ISRC in one operation
 *
 * @param isrc - ISRC string to process
 * @returns Normalized uppercase ISRC or null if invalid
 */
export function validateAndNormalizeIsrc(
  isrc: string | null | undefined
): string | null {
  if (!isValidIsrc(isrc)) {
    return null;
  }
  return isrc.toUpperCase();
}
