/**
 * Retry Logic for Agent Tools
 *
 * Feature: 011-agent-tools
 *
 * Provides retry functionality for transient errors in tool execution.
 * Implements single retry with 1000ms delay for specific error types.
 */

import { createToolError, type ToolError } from '../../types/agentTools.js';
import { logger } from '../../utils/logger.js';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

/**
 * Delay before retry in milliseconds
 */
const RETRY_DELAY_MS = 1000;

/**
 * HTTP status codes that should trigger retry
 */
const RETRYABLE_STATUS_CODES = [429, 503, 504];

/**
 * Error codes/messages that indicate transient errors
 */
const RETRYABLE_ERROR_PATTERNS = [
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ENETUNREACH',
  'ECONNRESET',
  'socket hang up',
  'network',
  'timeout',
  'rate limit',
  'temporarily unavailable',
];

/**
 * Error codes/messages that should NOT retry (validation, auth, etc.)
 */
const NON_RETRYABLE_ERROR_PATTERNS = [
  'validation',
  'invalid',
  'unauthorized',
  'forbidden',
  'not found',
  'bad request',
];

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Check if an error is retryable based on its message and properties
 */
function isRetryableError(error: unknown): boolean {
  // Check if it's a ToolError with retryable flag
  if (error instanceof Error && 'retryable' in error) {
    return (error as ToolError).retryable;
  }

  // Check for HTTP status codes
  if (error instanceof Error && 'status' in error) {
    const status = (error as any).status;
    if (RETRYABLE_STATUS_CODES.includes(status)) {
      return true;
    }
    // 400, 401, 403, 404 are not retryable
    if (status >= 400 && status < 500) {
      return false;
    }
  }

  // Check error message for patterns
  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  // Check for non-retryable patterns first
  for (const pattern of NON_RETRYABLE_ERROR_PATTERNS) {
    if (errorMessage.includes(pattern.toLowerCase())) {
      return false;
    }
  }

  // Check for retryable patterns
  for (const pattern of RETRYABLE_ERROR_PATTERNS) {
    if (errorMessage.includes(pattern.toLowerCase())) {
      return true;
    }
  }

  // Default: retry on unknown server errors
  return true;
}

/**
 * Sleep for the specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Map common error types to user-friendly messages
 */
function getUserFriendlyMessage(error: unknown, toolName: string): string {
  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (errorMessage.includes('econnrefused') || errorMessage.includes('enetunreach')) {
    return `${formatToolName(toolName)} service is currently unavailable`;
  }

  if (errorMessage.includes('etimedout') || errorMessage.includes('timeout')) {
    return `${formatToolName(toolName)} operation timed out`;
  }

  if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
    return 'Rate limit exceeded. Please wait a moment and try again.';
  }

  if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
    return error instanceof Error ? error.message : 'Invalid input';
  }

  return `${formatToolName(toolName)} is temporarily unavailable`;
}

/**
 * Format tool name for display
 */
function formatToolName(toolName: string): string {
  switch (toolName) {
    case 'semanticSearch':
      return 'Vector search';
    case 'tidalSearch':
      return 'Tidal search';
    case 'batchMetadata':
      return 'Metadata lookup';
    case 'albumTracks':
      return 'Album tracks';
    default:
      return toolName;
  }
}

// -----------------------------------------------------------------------------
// Main Retry Function
// -----------------------------------------------------------------------------

/**
 * Execute a tool function with retry logic
 *
 * Implements single retry with 1000ms delay for transient errors.
 * Does not retry validation errors or permanent failures.
 *
 * @param fn - Async function to execute
 * @param toolName - Name of the tool (for logging and error messages)
 * @returns Result of the function execution
 * @throws ToolError with wasRetried flag indicating if retry was attempted
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  toolName: string
): Promise<{ result: T; wasRetried: boolean }> {
  try {
    // First attempt
    const result = await fn();
    return { result, wasRetried: false };
  } catch (firstError) {
    // Check if error is retryable
    if (!isRetryableError(firstError)) {
      logger.debug('tool_retry_not_retryable', {
        toolName,
        error: firstError instanceof Error ? firstError.message : String(firstError),
      });

      // Wrap in ToolError if not already
      if (firstError instanceof Error && 'retryable' in firstError) {
        throw firstError;
      }

      throw createToolError(
        getUserFriendlyMessage(firstError, toolName),
        false,
        false,
        'NON_RETRYABLE_ERROR'
      );
    }

    // Log retry attempt
    logger.info('tool_retry_attempting', {
      toolName,
      delayMs: RETRY_DELAY_MS,
      error: firstError instanceof Error ? firstError.message : String(firstError),
    });

    // Wait before retry
    await sleep(RETRY_DELAY_MS);

    try {
      // Second attempt
      const result = await fn();
      logger.info('tool_retry_succeeded', { toolName });
      return { result, wasRetried: true };
    } catch (secondError) {
      // Both attempts failed
      logger.warn('tool_retry_failed', {
        toolName,
        error: secondError instanceof Error ? secondError.message : String(secondError),
      });

      // Return error with wasRetried = true
      if (secondError instanceof Error && 'retryable' in secondError) {
        const toolError = secondError as ToolError;
        throw createToolError(
          toolError.message,
          toolError.retryable,
          true, // wasRetried
          toolError.code
        );
      }

      throw createToolError(
        getUserFriendlyMessage(secondError, toolName),
        isRetryableError(secondError),
        true, // wasRetried
        'RETRY_EXHAUSTED'
      );
    }
  }
}

/**
 * Check if an error indicates a retriable condition
 *
 * Exposed for testing and external use
 */
export { isRetryableError };

/**
 * Get user-friendly error message for a given error
 *
 * Exposed for testing and external use
 */
export { getUserFriendlyMessage };
