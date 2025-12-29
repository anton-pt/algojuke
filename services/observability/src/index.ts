/**
 * Observability Service
 *
 * Langfuse-based observability for LLM, vector search, and HTTP tracing.
 *
 * @example
 * ```typescript
 * import { getObservabilityClient, createGenerationSpan } from "@algojuke/observability";
 *
 * const client = getObservabilityClient();
 *
 * // Create a trace with generation span
 * const trace = client.langfuse.trace({ name: "user-query" });
 * const generation = createGenerationSpan(trace, {
 *   name: "llm-call",
 *   model: "claude-opus-4-20250514",
 *   input: messages,
 * });
 *
 * // ... make LLM call ...
 *
 * generation.end({ output: response, usage: { input: 100, output: 50 } });
 * await client.shutdown();
 * ```
 */

// Configuration
export {
  LangfuseEnvConfigSchema,
  ObservabilityConfigSchema,
  loadConfig,
  tryLoadConfig,
  type LangfuseEnvConfig,
  type ObservabilityConfig,
  type FullObservabilityConfig,
} from "./config.js";

// Client
export {
  createObservabilityClient,
  tryCreateObservabilityClient,
  getObservabilityClient,
  shutdownObservabilityClient,
  checkLangfuseHealth,
  type ObservabilityClient,
  type LangfuseHealthResponse,
} from "./client.js";

// Generation (LLM) spans
export {
  createGenerationSpan,
  type GenerationSpan,
  type GenerationSpanOptions,
  type GenerationEndOptions,
} from "./generation.js";

// Search (Vector) spans
export {
  createSearchSpan,
  type SearchSpan,
  type SearchSpanOptions,
  type SearchEndOptions,
} from "./search.js";

// HTTP spans
export {
  createHTTPSpan,
  type HTTPSpan,
  type HTTPSpanOptions,
  type HTTPEndOptions,
} from "./http.js";

// Trace Context
export {
  createTraceContext,
  withTraceContext,
  getTraceId,
  getSpanId,
  getParentSpanId,
  getCurrentContext,
  createChildContext,
  type TraceContext,
  type TraceContextOptions,
} from "./context.js";

// Schemas
export {
  LLMGenerationMetadataSchema,
  UsageDetailsSchema,
  type LLMGenerationMetadata,
  type UsageDetails,
} from "./schemas/generation.js";

export {
  VectorSearchMetadataSchema,
  VectorSearchResultSchema,
  type VectorSearchMetadata,
  type VectorSearchResult,
} from "./schemas/search.js";

export {
  HTTPSpanMetadataSchema,
  HTTPResponseMetadataSchema,
  type HTTPSpanMetadata,
  type HTTPResponseMetadata,
} from "./schemas/http.js";

// Re-export Langfuse types for convenience
export { Langfuse } from "langfuse";
