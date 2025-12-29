/**
 * LLM Generation Span Wrapper
 *
 * Provides utilities for creating and managing LLM Generation spans.
 * Langfuse uses "Generation" to refer to LLM invocation spans.
 */

import type { LangfuseTraceClient, LangfuseSpanClient, LangfuseGenerationClient } from "langfuse";
import {
  LLMGenerationMetadataSchema,
  UsageDetailsSchema,
} from "./schemas/generation.js";

/**
 * Options for creating a Generation span.
 */
export interface GenerationSpanOptions {
  /** Human-readable name for the generation */
  name: string;

  /** Model identifier (e.g., "claude-opus-4-20250514") */
  model: string;

  /** Input messages/prompt */
  input: unknown;

  /** Model parameters (optional) */
  modelParameters?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stopSequences?: string[];
  };

  /** Additional metadata (optional) */
  metadata?: Record<string, unknown>;

  /** Searchable tags (optional) */
  tags?: string[];
}

/**
 * Options for ending a Generation span.
 */
export interface GenerationEndOptions {
  /** LLM output/completion */
  output: unknown;

  /** Usage details (optional) */
  usage?: {
    input: number;
    output: number;
    total?: number;
    inputCost?: number;
    outputCost?: number;
    totalCost?: number;
  };

  /** Error if generation failed (optional) */
  error?: Error | null;

  /** Log level (optional) */
  level?: "DEBUG" | "DEFAULT" | "WARNING" | "ERROR";
}

/**
 * Wrapper around Langfuse Generation with convenient methods.
 */
export interface GenerationSpan {
  /** Unique generation ID */
  id: string;

  /** End the generation with output and usage */
  end: (options: GenerationEndOptions) => void;

  /** Update generation metadata */
  update: (data: Partial<GenerationSpanOptions>) => void;

  /** Raw Langfuse generation client */
  raw: LangfuseGenerationClient;
}

/**
 * Create a Generation span for tracking LLM invocations.
 *
 * @param parent - Parent trace or span
 * @param options - Generation options
 * @returns Generation span wrapper
 *
 * @example
 * ```typescript
 * const trace = client.langfuse.trace({ name: "user-query" });
 * const generation = createGenerationSpan(trace, {
 *   name: "llm-call",
 *   model: "claude-opus-4-20250514",
 *   input: [{ role: "user", content: "Hello!" }],
 * });
 *
 * // Make LLM call...
 *
 * generation.end({
 *   output: { role: "assistant", content: "Hi there!" },
 *   usage: { input: 10, output: 20 },
 * });
 * ```
 */
export function createGenerationSpan(
  parent: LangfuseTraceClient | LangfuseSpanClient,
  options: GenerationSpanOptions
): GenerationSpan {
  // Validate metadata if provided
  if (options.modelParameters) {
    LLMGenerationMetadataSchema.parse({
      model: options.model,
      modelParameters: options.modelParameters,
    });
  }

  // Create the generation using Langfuse's generation method
  const generation = parent.generation({
    name: options.name,
    model: options.model,
    input: options.input,
    modelParameters: options.modelParameters,
    metadata: options.metadata,
  });

  return {
    id: generation.id,

    end: (endOptions: GenerationEndOptions) => {
      // Validate usage if provided
      if (endOptions.usage) {
        UsageDetailsSchema.parse(endOptions.usage);
      }

      generation.end({
        output: endOptions.output,
        usage: endOptions.usage
          ? {
              input: endOptions.usage.input,
              output: endOptions.usage.output,
              total: endOptions.usage.total,
              inputCost: endOptions.usage.inputCost,
              outputCost: endOptions.usage.outputCost,
              totalCost: endOptions.usage.totalCost,
            }
          : undefined,
        level: endOptions.error ? "ERROR" : endOptions.level,
        statusMessage: endOptions.error?.message,
      });
    },

    update: (data: Partial<GenerationSpanOptions>) => {
      generation.update({
        name: data.name,
        model: data.model,
        input: data.input,
        modelParameters: data.modelParameters,
        metadata: data.metadata,
      });
    },

    raw: generation,
  };
}
