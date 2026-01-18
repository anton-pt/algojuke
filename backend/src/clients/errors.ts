/**
 * Error handling utilities for external API clients
 *
 * Provides typed errors for consistent handling across all API clients
 * and helpers to determine if errors should trigger retries.
 */

/**
 * APIError - Typed error for external API failures
 *
 * Used by API clients (GCS, etc.) to provide consistent error handling
 * and retry decisions.
 */
export class APIError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly service: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "APIError";
  }
}

/**
 * Retryable status codes
 *
 * - 429: Rate limit exceeded
 * - 500: Internal server error
 * - 502: Bad gateway
 * - 503: Service unavailable
 * - 504: Gateway timeout
 * - 408: Request timeout
 */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504, 408]);

/**
 * Determine if an error should trigger a retry
 *
 * @param error - The error to check
 * @returns true if the error is transient and should be retried
 */
export function isRetryableError(error: unknown): boolean {
  // APIError with explicit retryable flag
  if (error instanceof APIError) {
    return error.retryable;
  }

  // Network errors are retryable
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("econnrefused") ||
      message.includes("enotfound") ||
      message.includes("etimedout") ||
      message.includes("econnreset") ||
      message.includes("network") ||
      message.includes("socket hang up")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Create an APIError from an HTTP status code
 *
 * @param statusCode - HTTP status code
 * @param service - Name of the service (e.g., "GCS")
 * @param message - Error message
 * @returns APIError with appropriate retryable flag
 */
export function createAPIError(
  statusCode: number,
  service: string,
  message: string,
): APIError {
  const retryable = RETRYABLE_STATUS_CODES.has(statusCode);
  return new APIError(message, statusCode, service, retryable);
}

/**
 * Check if a status code indicates a successful response
 */
export function isSuccessStatus(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 300;
}

/**
 * Check if a status code indicates a not found response
 */
export function isNotFoundStatus(statusCode: number): boolean {
  return statusCode === 404;
}
