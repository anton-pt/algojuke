/**
 * HTTP Span Wrapper
 *
 * Provides utilities for creating and managing HTTP request spans.
 * Used when tracing external API calls.
 */

import type { LangfuseTraceClient, LangfuseSpanClient } from "langfuse";
import {
  HTTPSpanMetadataSchema,
  HTTPResponseMetadataSchema,
} from "./schemas/http.js";

/**
 * Options for creating an HTTP span.
 */
export interface HTTPSpanOptions {
  /** Human-readable name for the HTTP call */
  name: string;

  /** HTTP method */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

  /** Request URL */
  url: string;

  /** Request headers (optional) */
  headers?: Record<string, string>;

  /** Request body (optional) */
  body?: unknown;

  /** Additional metadata (optional) */
  metadata?: Record<string, unknown>;

  /** Searchable tags (optional) */
  tags?: string[];
}

/**
 * Options for ending an HTTP span.
 */
export interface HTTPEndOptions {
  /** HTTP status code */
  statusCode: number;

  /** Response time in milliseconds */
  durationMs: number;

  /** Response body (optional) */
  body?: unknown;

  /** Response headers (optional) */
  headers?: Record<string, string>;

  /** Error if request failed (optional) */
  error?: Error | null;

  /** Log level (optional) */
  level?: "DEBUG" | "DEFAULT" | "WARNING" | "ERROR";
}

/**
 * Wrapper around Langfuse Span for HTTP operations.
 */
export interface HTTPSpan {
  /** Unique span ID */
  id: string;

  /** End the HTTP span with response */
  end: (options: HTTPEndOptions) => void;

  /** Update span metadata */
  update: (data: Partial<HTTPSpanOptions>) => void;

  /** Raw Langfuse span client */
  raw: LangfuseSpanClient;
}

/**
 * Create an HTTP span for tracking external API calls.
 *
 * @param parent - Parent trace or span
 * @param options - HTTP options
 * @returns HTTP span wrapper
 *
 * @example
 * ```typescript
 * const trace = client.langfuse.trace({ name: "data-enrichment" });
 * const http = createHTTPSpan(trace, {
 *   name: "tidal-api-call",
 *   method: "GET",
 *   url: "https://api.tidal.com/v1/search",
 *   headers: { Authorization: "Bearer token" },
 * });
 *
 * // Make HTTP call...
 *
 * http.end({
 *   statusCode: 200,
 *   durationMs: 150,
 *   body: responseData,
 * });
 * ```
 */
export function createHTTPSpan(
  parent: LangfuseTraceClient | LangfuseSpanClient,
  options: HTTPSpanOptions
): HTTPSpan {
  // Validate metadata
  HTTPSpanMetadataSchema.parse({
    method: options.method,
    url: options.url,
    headers: options.headers,
  });

  // Create the span using Langfuse's span method
  const span = parent.span({
    name: options.name,
    input: {
      method: options.method,
      url: options.url,
      headers: options.headers,
      body: options.body,
    },
    metadata: {
      ...options.metadata,
      method: options.method,
      url: options.url,
    },
  });

  return {
    id: span.id,

    end: (endOptions: HTTPEndOptions) => {
      // Validate response
      HTTPResponseMetadataSchema.parse({
        statusCode: endOptions.statusCode,
        headers: endOptions.headers,
        durationMs: endOptions.durationMs,
      });

      // Determine level based on status code and error
      let level = endOptions.level;
      if (!level) {
        if (endOptions.error || endOptions.statusCode >= 500) {
          level = "ERROR";
        } else if (endOptions.statusCode >= 400) {
          level = "WARNING";
        }
      }

      span.end({
        output: {
          statusCode: endOptions.statusCode,
          body: endOptions.body,
          headers: endOptions.headers,
          durationMs: endOptions.durationMs,
        },
        level,
        statusMessage: endOptions.error?.message,
      });
    },

    update: (data: Partial<HTTPSpanOptions>) => {
      span.update({
        name: data.name,
        input: data.body
          ? {
              method: data.method,
              url: data.url,
              headers: data.headers,
              body: data.body,
            }
          : undefined,
        metadata: {
          ...data.metadata,
          method: data.method,
          url: data.url,
        },
      });
    },

    raw: span,
  };
}
