import { EmptyQueryError, InvalidQueryError } from '../types/errors.js';

/**
 * Validates search query input per FR-010 and FR-011
 *
 * Rules:
 * - Must be 1-200 characters after trimming
 * - Supports full UTF-8 (international characters, special characters)
 * - Rejects empty or whitespace-only queries
 */
export function validateQuery(query: string): string {
  // Trim whitespace
  const trimmed = query.trim();

  // Check for empty after trim
  if (trimmed.length === 0) {
    throw new EmptyQueryError();
  }

  // Check length constraints
  if (trimmed.length > 200) {
    throw new InvalidQueryError('Search query must not exceed 200 characters');
  }

  return trimmed;
}

/**
 * Validates pagination limit
 */
export function validateLimit(limit: number | undefined): number {
  const validatedLimit = limit ?? 20;

  if (validatedLimit < 1) {
    return 1;
  }

  if (validatedLimit > 50) {
    return 50;
  }

  return validatedLimit;
}

/**
 * Validates pagination offset
 */
export function validateOffset(offset: number | undefined): number {
  const validatedOffset = offset ?? 0;

  if (validatedOffset < 0) {
    return 0;
  }

  return validatedOffset;
}

/**
 * Validates country code (basic check for 2-letter ISO 3166-1 format)
 */
export function validateCountryCode(countryCode: string | undefined): string {
  const code = countryCode ?? 'US';

  if (code.length !== 2) {
    return 'US';
  }

  return code.toUpperCase();
}
