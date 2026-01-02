/**
 * Langfuse Observability Integration for Backend
 *
 * Provides trace and span creation for discovery search observability.
 */

import { Langfuse } from "langfuse";

/**
 * Langfuse configuration from environment
 */
const LANGFUSE_PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY;
const LANGFUSE_SECRET_KEY = process.env.LANGFUSE_SECRET_KEY;
const LANGFUSE_BASE_URL =
  process.env.LANGFUSE_BASE_URL ?? "http://localhost:3000";
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
 * Discovery search trace type
 */
export type DiscoveryTrace = ReturnType<Langfuse["trace"]>;

/**
 * Create a trace for discovery search
 */
export function createDiscoveryTrace(
  query: string,
  sessionId?: string
): DiscoveryTrace | null {
  const client = getLangfuseClient();
  if (!client) {
    return null;
  }

  return client.trace({
    name: "discovery-search",
    metadata: {
      query,
    },
    sessionId,
    tags: ["discovery", "search"],
  });
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
  trace: DiscoveryTrace | null,
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
  operation: "search" | "hybrid_search" | "hybrid_search_optimized";
  queryCount?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Search span result
 */
export interface SearchSpanResult {
  resultCount: number;
  durationMs: number;
}

/**
 * Create search span for vector operation
 */
export function createSearchSpan(
  trace: DiscoveryTrace | null,
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
      queryCount: options.queryCount,
    },
    metadata: options.metadata,
  });

  return {
    end: (result: SearchSpanResult) => {
      span.end({
        output: {
          resultCount: result.resultCount,
          durationMs: result.durationMs,
        },
      });
    },
  };
}

/**
 * Embedding span options
 */
export interface EmbeddingSpanOptions {
  name: string;
  model: string;
  inputCount: number;
  metadata?: Record<string, unknown>;
}

/**
 * Embedding span result
 */
export interface EmbeddingSpanResult {
  dimensions: number;
  durationMs: number;
}

/**
 * Create embedding span for TEI calls
 */
export function createEmbeddingSpan(
  trace: DiscoveryTrace | null,
  options: EmbeddingSpanOptions
) {
  if (!trace) {
    return {
      end: (_result: EmbeddingSpanResult) => {},
    };
  }

  const span = trace.span({
    name: options.name,
    input: {
      model: options.model,
      inputCount: options.inputCount,
    },
    metadata: options.metadata,
  });

  return {
    end: (result: EmbeddingSpanResult) => {
      span.end({
        output: {
          dimensions: result.dimensions,
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
