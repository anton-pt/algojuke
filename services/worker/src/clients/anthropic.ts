/**
 * Anthropic LLM Client
 *
 * Generates lyric interpretations using Claude Sonnet 4.5 via Vercel AI SDK.
 */

import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createAPIError } from "./errors.js";
import { buildInterpretationPrompt } from "../prompts/lyricsInterpretation.js";

/**
 * Model identifier for Claude Sonnet 4.5
 */
export const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";

/**
 * Interpretation result from LLM
 */
export interface InterpretationResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * LLM client interface
 */
export interface LLMClient {
  generateInterpretation(
    title: string,
    artist: string,
    album: string,
    lyrics: string
  ): Promise<InterpretationResult>;
}

/**
 * Create Anthropic LLM client
 *
 * Uses Vercel AI SDK for standardized API access.
 * Requires ANTHROPIC_API_KEY environment variable.
 *
 * @returns LLM client instance
 */
export function createAnthropicClient(): LLMClient {
  // Verify API key is set
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  return {
    async generateInterpretation(
      title: string,
      artist: string,
      album: string,
      lyrics: string
    ): Promise<InterpretationResult> {
      try {
        const result = await generateText({
          model: anthropic(CLAUDE_MODEL),
          prompt: buildInterpretationPrompt(title, artist, album, lyrics),
          maxTokens: 1024,
        });

        // Validate response
        if (!result.text || result.text.trim().length === 0) {
          throw createAPIError(
            500,
            "Anthropic",
            "Empty interpretation received from LLM"
          );
        }

        return {
          text: result.text.trim(),
          model: CLAUDE_MODEL,
          inputTokens: result.usage?.promptTokens ?? 0,
          outputTokens: result.usage?.completionTokens ?? 0,
        };
      } catch (error) {
        // Re-throw APIError as-is
        if (error instanceof Error && error.name === "APIError") {
          throw error;
        }

        // Handle Vercel AI SDK errors
        if (error instanceof Error) {
          const message = error.message.toLowerCase();

          // Rate limit
          if (message.includes("rate limit") || message.includes("429")) {
            throw createAPIError(429, "Anthropic", "Rate limit exceeded");
          }

          // Authentication
          if (
            message.includes("authentication") ||
            message.includes("401") ||
            message.includes("api key")
          ) {
            throw createAPIError(401, "Anthropic", "Invalid Anthropic API key");
          }

          // Server errors (retryable)
          if (
            message.includes("500") ||
            message.includes("502") ||
            message.includes("503") ||
            message.includes("504")
          ) {
            throw createAPIError(
              500,
              "Anthropic",
              `Server error: ${error.message}`
            );
          }
        }

        throw createAPIError(
          500,
          "Anthropic",
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    },
  };
}
