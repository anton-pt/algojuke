/**
 * Anthropic Client for Query Expansion
 *
 * Feature: 009-semantic-discovery-search
 * Date: 2025-12-30
 *
 * Uses Claude Haiku 4.5 to expand user queries into 1-3 optimized search queries.
 */

import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { z } from "zod";
import type { QueryExpansionResult } from "../types/discovery.js";
import { logger } from "../utils/logger.js";
import { buildQueryExpansionPrompt } from "../prompts/queryExpansion.js";

/**
 * Claude Haiku 4.5 model ID
 */
export const QUERY_EXPANSION_MODEL = "claude-haiku-4-5-20251001";

/**
 * Schema for query expansion response
 */
export const QueryExpansionResponseSchema = z.array(z.string()).min(1).max(3);

/**
 * Anthropic client interface for query expansion
 */
export interface AnthropicClient {
  /**
   * Expand a user query into 1-3 optimized search queries
   */
  expandQuery(userQuery: string): Promise<QueryExpansionResult>;

  /**
   * Health check for Anthropic API
   */
  isHealthy(): Promise<boolean>;
}

/**
 * Anthropic error class
 */
export class AnthropicError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "AnthropicError";
  }
}

/**
 * Create Anthropic client for query expansion
 *
 * @returns Anthropic client instance
 */
export function createAnthropicClient(): AnthropicClient {
  // Verify API key is set
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AnthropicError(
      "ANTHROPIC_API_KEY environment variable is required",
      401,
      false
    );
  }

  return {
    async expandQuery(userQuery: string): Promise<QueryExpansionResult> {
      try {
        const result = await generateText({
          model: anthropic(QUERY_EXPANSION_MODEL),
          prompt: buildQueryExpansionPrompt(userQuery),
          maxTokens: 200,
        });

        const { text, usage } = result;

        // Parse the JSON response
        let queries: string[];
        try {
          const parsed = JSON.parse(text.trim());
          queries = QueryExpansionResponseSchema.parse(parsed);
        } catch (parseError) {
          // If JSON parsing fails, try to extract queries from the text
          // Sometimes the model wraps the response or adds explanation
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            queries = QueryExpansionResponseSchema.parse(parsed);
          } else {
            logger.warn("query_expansion_parse_failed", {
              event: "parse_error",
              text: text.substring(0, 200),
              error: parseError instanceof Error ? parseError.message : String(parseError),
            });
            // Fallback: use the original query if parsing fails
            queries = [userQuery];
          }
        }

        return {
          queries,
          model: QUERY_EXPANSION_MODEL,
          inputTokens: usage.promptTokens,
          outputTokens: usage.completionTokens,
        };
      } catch (error) {
        // Handle API errors
        if (error instanceof Error) {
          const message = error.message.toLowerCase();

          // Rate limiting
          if (message.includes("rate limit") || message.includes("429")) {
            throw new AnthropicError(
              "Anthropic API rate limit exceeded",
              429,
              true
            );
          }

          // Authentication
          if (message.includes("unauthorized") || message.includes("401")) {
            throw new AnthropicError(
              "Invalid Anthropic API key",
              401,
              false
            );
          }

          // Service errors
          if (message.includes("500") || message.includes("503")) {
            throw new AnthropicError(
              "Anthropic API service error",
              503,
              true
            );
          }

          logger.error("query_expansion_failed", {
            event: "anthropic_error",
            error: error.message,
          });
        }

        throw new AnthropicError(
          error instanceof Error ? error.message : "Unknown error during query expansion",
          500,
          true
        );
      }
    },

    async isHealthy(): Promise<boolean> {
      try {
        // Simple health check: try to expand a test query
        await this.expandQuery("test");
        return true;
      } catch {
        return false;
      }
    },
  };
}

/**
 * Singleton Anthropic client instance
 */
let _anthropicClient: AnthropicClient | null = null;

/**
 * Get or create the singleton Anthropic client
 */
export function getAnthropicClient(): AnthropicClient {
  if (!_anthropicClient) {
    _anthropicClient = createAnthropicClient();
  }
  return _anthropicClient;
}

/**
 * Reset the singleton (for testing)
 */
export function resetAnthropicClient(): void {
  _anthropicClient = null;
}
