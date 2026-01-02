/**
 * Langfuse Tracing for Agent Tools
 *
 * Feature: 011-agent-tools
 *
 * Provides observability for agent tool invocations via Langfuse spans.
 * Each tool invocation creates a span under the parent chat trace.
 */

import type { Langfuse } from 'langfuse';
import { logger } from '../../utils/logger.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Langfuse trace (from chat stream service)
 */
export type LangfuseTrace = ReturnType<Langfuse['trace']>;

/**
 * Langfuse span
 */
export type LangfuseSpan = ReturnType<LangfuseTrace['span']>;

/**
 * Tool span options
 */
export interface ToolSpanOptions {
  toolName: string;
  toolCallId: string;
  input: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Tool span success result
 */
export interface ToolSpanSuccessResult {
  summary: string;
  resultCount: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

/**
 * Tool span error result
 */
export interface ToolSpanErrorResult {
  error: string;
  retryable: boolean;
  wasRetried: boolean;
  durationMs: number;
}

/**
 * Tool span wrapper with end methods
 */
export interface ToolSpanWrapper {
  /**
   * End span with success result
   */
  endSuccess: (result: ToolSpanSuccessResult) => void;

  /**
   * End span with error result
   */
  endError: (result: ToolSpanErrorResult) => void;
}

// -----------------------------------------------------------------------------
// Implementation
// -----------------------------------------------------------------------------

/**
 * Create a tool invocation span under the parent trace
 *
 * Returns a wrapper with endSuccess/endError methods for proper span closure.
 * If trace is null, returns a no-op wrapper.
 *
 * @param trace - Parent Langfuse trace (from chat stream)
 * @param options - Tool span options
 * @returns ToolSpanWrapper with end methods
 */
export function createToolSpan(
  trace: LangfuseTrace | null,
  options: ToolSpanOptions
): ToolSpanWrapper {
  // No-op wrapper if trace is null
  if (!trace) {
    return {
      endSuccess: () => {},
      endError: () => {},
    };
  }

  const startTime = Date.now();

  // Create span under parent trace
  const span = trace.span({
    name: `tool-${options.toolName}`,
    input: {
      toolCallId: options.toolCallId,
      toolName: options.toolName,
      input: sanitizeInput(options.input),
    },
    metadata: {
      ...options.metadata,
      toolType: 'agent_tool',
    },
  });

  return {
    endSuccess: (result: ToolSpanSuccessResult) => {
      try {
        span.end({
          output: {
            summary: result.summary,
            resultCount: result.resultCount,
          },
          metadata: {
            ...result.metadata,
            durationMs: result.durationMs,
            status: 'success',
          },
        });
      } catch (error) {
        logger.warn('tool_span_end_success_failed', {
          toolName: options.toolName,
          toolCallId: options.toolCallId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },

    endError: (result: ToolSpanErrorResult) => {
      try {
        span.end({
          output: {
            error: result.error,
          },
          level: 'ERROR',
          metadata: {
            durationMs: result.durationMs,
            retryable: result.retryable,
            wasRetried: result.wasRetried,
            status: 'error',
          },
        });
      } catch (error) {
        logger.warn('tool_span_end_error_failed', {
          toolName: options.toolName,
          toolCallId: options.toolCallId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
}

/**
 * Sanitize tool input for logging
 *
 * Removes or truncates potentially large fields like arrays.
 */
function sanitizeInput(input: unknown): unknown {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input !== 'object') {
    return input;
  }

  if (Array.isArray(input)) {
    // Truncate large arrays
    if (input.length > 10) {
      return {
        _type: 'array',
        _length: input.length,
        _sample: input.slice(0, 5),
      };
    }
    return input;
  }

  // Object - recursively sanitize
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    // Truncate query strings if too long
    if (key === 'query' && typeof value === 'string' && value.length > 500) {
      result[key] = value.slice(0, 500) + '...[truncated]';
    } else {
      result[key] = sanitizeInput(value);
    }
  }

  return result;
}

/**
 * Execute a tool function with Langfuse tracing
 *
 * Wraps tool execution in a Langfuse span, recording input/output/duration.
 * Handles both success and error cases.
 *
 * @param trace - Parent Langfuse trace
 * @param toolName - Name of the tool
 * @param toolCallId - Unique ID for this invocation
 * @param input - Tool input
 * @param fn - Tool execution function
 * @returns Tool result
 * @throws Error from tool execution
 */
export async function executeToolWithTracing<TInput, TOutput extends { summary: string; durationMs: number }>(
  trace: LangfuseTrace | null,
  toolName: string,
  toolCallId: string,
  input: TInput,
  fn: (input: TInput) => Promise<TOutput>
): Promise<TOutput> {
  const span = createToolSpan(trace, {
    toolName,
    toolCallId,
    input,
  });

  const startTime = Date.now();

  try {
    const result = await fn(input);

    // Extract result count based on output type
    const resultCount = getResultCount(result);

    span.endSuccess({
      summary: result.summary,
      resultCount,
      durationMs: result.durationMs,
    });

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const retryable = error instanceof Error && 'retryable' in error ? (error as any).retryable : true;
    const wasRetried = error instanceof Error && 'wasRetried' in error ? (error as any).wasRetried : false;

    span.endError({
      error: errorMessage,
      retryable,
      wasRetried,
      durationMs,
    });

    throw error;
  }
}

/**
 * Extract result count from tool output
 */
function getResultCount(output: unknown): number {
  if (output === null || output === undefined || typeof output !== 'object') {
    return 0;
  }

  const obj = output as Record<string, unknown>;

  // Check for common result array fields
  if ('tracks' in obj && Array.isArray(obj.tracks)) {
    return obj.tracks.length;
  }

  if ('albums' in obj && Array.isArray(obj.albums)) {
    return obj.albums.length;
  }

  if ('results' in obj && Array.isArray(obj.results)) {
    return obj.results.length;
  }

  if ('found' in obj && Array.isArray(obj.found)) {
    return obj.found.length;
  }

  if ('totalFound' in obj && typeof obj.totalFound === 'number') {
    return obj.totalFound;
  }

  if ('resultCount' in obj && typeof obj.resultCount === 'number') {
    return obj.resultCount;
  }

  return 0;
}
