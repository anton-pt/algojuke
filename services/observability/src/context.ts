/**
 * Trace Context Utilities
 *
 * Provides utilities for trace correlation and context propagation.
 * Enables linking related operations across the request lifecycle.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/**
 * Trace context for correlating operations.
 */
export interface TraceContext {
  /** Unique trace identifier */
  traceId: string;

  /** Current span identifier (optional) */
  spanId?: string;

  /** Parent span identifier (optional) */
  parentSpanId?: string;

  /** Additional context metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for creating a trace context.
 */
export interface TraceContextOptions {
  /** Custom trace ID (auto-generated if not provided) */
  traceId?: string;

  /** Parent span ID for nested context */
  parentSpanId?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// AsyncLocalStorage for context propagation
const contextStorage = new AsyncLocalStorage<TraceContext>();

/**
 * Create a new trace context.
 *
 * @param options - Context options
 * @returns New trace context
 *
 * @example
 * ```typescript
 * const context = createTraceContext({
 *   metadata: { userId: "user-123" },
 * });
 * ```
 */
export function createTraceContext(options?: TraceContextOptions): TraceContext {
  return {
    traceId: options?.traceId ?? randomUUID(),
    spanId: randomUUID(),
    parentSpanId: options?.parentSpanId,
    metadata: options?.metadata,
  };
}

/**
 * Execute a function within a trace context.
 *
 * @param context - Trace context
 * @param fn - Function to execute
 * @returns Result of function
 *
 * @example
 * ```typescript
 * const context = createTraceContext();
 *
 * await withTraceContext(context, async () => {
 *   // Operations here will have access to the trace context
 *   const traceId = getTraceId();
 *   console.log(`Running in trace: ${traceId}`);
 * });
 * ```
 */
export function withTraceContext<T>(
  context: TraceContext,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return contextStorage.run(context, fn);
}

/**
 * Get the current trace ID from context.
 *
 * @returns Current trace ID or undefined if no context
 */
export function getTraceId(): string | undefined {
  return contextStorage.getStore()?.traceId;
}

/**
 * Get the current span ID from context.
 *
 * @returns Current span ID or undefined if no context
 */
export function getSpanId(): string | undefined {
  return contextStorage.getStore()?.spanId;
}

/**
 * Get the current parent span ID from context.
 *
 * @returns Current parent span ID or undefined if no context
 */
export function getParentSpanId(): string | undefined {
  return contextStorage.getStore()?.parentSpanId;
}

/**
 * Get the current trace context.
 *
 * @returns Current trace context or undefined if no context
 */
export function getCurrentContext(): TraceContext | undefined {
  return contextStorage.getStore();
}

/**
 * Create a child context from the current context.
 *
 * @param metadata - Additional metadata for child context
 * @returns New child trace context with parent span ID set
 */
export function createChildContext(
  metadata?: Record<string, unknown>
): TraceContext | undefined {
  const current = contextStorage.getStore();
  if (!current) return undefined;

  return {
    traceId: current.traceId,
    spanId: randomUUID(),
    parentSpanId: current.spanId,
    metadata: {
      ...current.metadata,
      ...metadata,
    },
  };
}
