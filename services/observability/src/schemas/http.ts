/**
 * HTTP Span Schema
 *
 * Defines the metadata schemas for HTTP request spans.
 * Used when tracing external API calls.
 */

import { z } from "zod";

/**
 * HTTP request span metadata.
 * Used when tracing external API calls.
 */
export const HTTPSpanMetadataSchema = z.object({
  /** HTTP method */
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),

  /** Request URL */
  url: z.string().url(),

  /** Request headers */
  headers: z.record(z.string()).optional(),
});

export type HTTPSpanMetadata = z.infer<typeof HTTPSpanMetadataSchema>;

/**
 * HTTP response metadata.
 */
export const HTTPResponseMetadataSchema = z.object({
  /** HTTP status code */
  statusCode: z.number().int(),

  /** Response headers */
  headers: z.record(z.string()).optional(),

  /** Response time in milliseconds */
  durationMs: z.number().nonnegative(),
});

export type HTTPResponseMetadata = z.infer<typeof HTTPResponseMetadataSchema>;
