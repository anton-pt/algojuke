/**
 * Langfuse Observability Integration
 *
 * Provides trace and span creation for pipeline observability.
 * Wraps Langfuse client for use in track ingestion pipeline.
 */

import { Langfuse } from "langfuse";

/**
 * Langfuse configuration from environment
 */
const LANGFUSE_PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY;
const LANGFUSE_SECRET_KEY = process.env.LANGFUSE_SECRET_KEY;
const LANGFUSE_BASE_URL = process.env.LANGFUSE_BASE_URL ?? "http://localhost:3000";
const LANGFUSE_ENABLED = process.env.LANGFUSE_ENABLED !== "false";

/**
 * Singleton Langfuse client instance
 */
let langfuseClient: Langfuse | null = null;

/**
 * Get or create Langfuse client
 * Returns null if observability is disabled or not configured
 */
export function getLangfuseClient(): Langfuse | null {
  if (!LANGFUSE_ENABLED) {
    return null;
  }

  if (!LANGFUSE_PUBLIC_KEY || !LANGFUSE_SECRET_KEY) {
    console.warn("Langfuse keys not configured, observability disabled");
    return null;
  }

  if (!langfuseClient) {
    langfuseClient = new Langfuse({
      publicKey: LANGFUSE_PUBLIC_KEY,
      secretKey: LANGFUSE_SECRET_KEY,
      baseUrl: LANGFUSE_BASE_URL,
    });
  }

  return langfuseClient;
}

/**
 * Create a trace for track ingestion
 */
export function createIngestionTrace(isrc: string, runId: string) {
  const client = getLangfuseClient();
  if (!client) {
    return null;
  }

  return client.trace({
    id: `ingestion-${isrc}-${runId}`,
    name: "track-ingestion",
    metadata: {
      isrc,
      runId,
    },
    tags: ["ingestion", "pipeline"],
  });
}

/**
 * Create a trace for short description backfill
 */
export function createBackfillTrace(runId: string) {
  const client = getLangfuseClient();
  if (!client) {
    return null;
  }

  return client.trace({
    id: `backfill-${runId}`,
    name: "short-description-backfill",
    metadata: {
      runId,
    },
    tags: ["backfill", "short-description"],
  });
}

/**
 * HTTP span options
 */
export interface HTTPSpanOptions {
  name: string;
  url: string;
  method: string;
  metadata?: Record<string, unknown>;
}

/**
 * HTTP span result
 */
export interface HTTPSpanResult {
  statusCode: number;
  durationMs: number;
  responseSize?: number;
}

/**
 * Create HTTP span for external API call
 */
export function createHTTPSpan(
  trace: ReturnType<Langfuse["trace"]> | null,
  options: HTTPSpanOptions
) {
  if (!trace) {
    return {
      end: (_result: HTTPSpanResult) => {},
    };
  }

  const span = trace.span({
    name: options.name,
    input: {
      url: options.url,
      method: options.method,
    },
    metadata: options.metadata,
  });

  return {
    end: (result: HTTPSpanResult) => {
      span.end({
        output: {
          statusCode: result.statusCode,
          durationMs: result.durationMs,
          responseSize: result.responseSize,
        },
      });
    },
  };
}

/**
 * Generation span options (for LLM calls)
 */
export interface GenerationSpanOptions {
  name: string;
  model: string;
  prompt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Generation span result
 */
export interface GenerationSpanResult {
  completion: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Create generation span for LLM call
 */
export function createGenerationSpan(
  trace: ReturnType<Langfuse["trace"]> | null,
  options: GenerationSpanOptions
) {
  if (!trace) {
    return {
      end: (_result: GenerationSpanResult) => {},
    };
  }

  const generation = trace.generation({
    name: options.name,
    model: options.model,
    input: options.prompt,
    metadata: options.metadata,
  });

  return {
    end: (result: GenerationSpanResult) => {
      generation.end({
        output: result.completion,
        usage: {
          input: result.inputTokens,
          output: result.outputTokens,
        },
      });
    },
  };
}

/**
 * Search span options (for vector operations)
 */
export interface SearchSpanOptions {
  name: string;
  collection: string;
  operation: "upsert" | "search" | "delete" | "scroll";
  metadata?: Record<string, unknown>;
}

/**
 * Search span result
 */
export interface SearchSpanResult {
  pointCount: number;
  durationMs: number;
}

/**
 * Create search span for vector operation
 */
export function createSearchSpan(
  trace: ReturnType<Langfuse["trace"]> | null,
  options: SearchSpanOptions
) {
  if (!trace) {
    return {
      end: (_result: SearchSpanResult) => {},
    };
  }

  const span = trace.span({
    name: options.name,
    input: {
      collection: options.collection,
      operation: options.operation,
    },
    metadata: options.metadata,
  });

  return {
    end: (result: SearchSpanResult) => {
      span.end({
        output: {
          pointCount: result.pointCount,
          durationMs: result.durationMs,
        },
      });
    },
  };
}

/**
 * Flush pending events to Langfuse
 */
export async function flushLangfuse(): Promise<void> {
  const client = getLangfuseClient();
  if (client) {
    await client.flushAsync();
  }
}

/**
 * Shutdown Langfuse client
 */
export async function shutdownLangfuse(): Promise<void> {
  const client = getLangfuseClient();
  if (client) {
    await client.shutdownAsync();
    langfuseClient = null;
  }
}
