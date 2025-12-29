/**
 * TEI (Text Embeddings Inference) Client
 *
 * Generates embeddings using locally-hosted mixedbread-ai/mxbai-embed-large-v1 model.
 * Runs in Docker via docker-compose.yml.
 */

import axios from "axios";
import { z } from "zod";
import { createAPIError } from "./errors.js";

/**
 * TEI service URL from environment
 */
const TEI_URL = process.env.TEI_URL ?? "http://localhost:8080";

/**
 * Expected embedding dimensions for mixedbread-ai/mxbai-embed-large-v1
 */
export const EMBEDDING_DIMENSIONS = 1024;

/**
 * TEI embed request schema
 */
export const TEIEmbedRequestSchema = z.object({
  inputs: z.union([z.string(), z.array(z.string())]),
});

export type TEIEmbedRequest = z.infer<typeof TEIEmbedRequestSchema>;

/**
 * TEI embed response schema
 * Returns array of embeddings (one per input)
 */
export const TEIEmbedResponseSchema = z.array(z.array(z.number()));

export type TEIEmbedResponse = z.infer<typeof TEIEmbedResponseSchema>;

/**
 * TEI client interface
 */
export interface TEIClient {
  /**
   * Generate embedding for text
   */
  embed(text: string): Promise<number[]>;

  /**
   * Generate embedding with instruction prefix (for queries)
   */
  embedWithInstruct(query: string, instruct: string): Promise<number[]>;
}

/**
 * Create a zero vector (1024 dimensions)
 *
 * Used when no lyrics are available for a track (instrumentals).
 */
export function createZeroVector(): number[] {
  return new Array(EMBEDDING_DIMENSIONS).fill(0);
}

/**
 * Validate embedding dimensions
 *
 * @param embedding - The embedding vector to validate
 * @throws Error if dimensions don't match expected 1024
 */
export function validateEmbeddingDimensions(embedding: number[]): void {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding must be exactly ${EMBEDDING_DIMENSIONS} dimensions, got ${embedding.length}`
    );
  }
}

/**
 * Create TEI embedding client
 *
 * @param baseUrl - Optional URL override (uses TEI_URL env var by default)
 * @returns TEI client instance
 */
export function createTEIClient(baseUrl?: string): TEIClient {
  const url = baseUrl ?? TEI_URL;

  async function embed(text: string): Promise<number[]> {
    try {
      const response = await axios.post(
        `${url}/embed`,
        { inputs: text },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 60000, // 60 second timeout (embedding can be slow on CPU)
          validateStatus: () => true,
        }
      );

      // Handle error status codes
      if (response.status >= 400) {
        // 503: Model not loaded yet
        if (response.status === 503) {
          throw createAPIError(
            503,
            "TEI",
            "TEI model not loaded. Wait for model download to complete."
          );
        }

        throw createAPIError(
          response.status,
          "TEI",
          `Failed to generate embedding: ${response.statusText}`
        );
      }

      // TEI returns array of embeddings even for single input
      // Extract the first (and only) embedding
      const data = response.data;

      // Handle both single embedding and array of embeddings response formats
      let embedding: number[];
      if (Array.isArray(data) && Array.isArray(data[0])) {
        // Array of embeddings: [[...numbers...]]
        embedding = data[0];
      } else if (Array.isArray(data) && typeof data[0] === "number") {
        // Single embedding: [...numbers...]
        embedding = data;
      } else {
        throw createAPIError(
          500,
          "TEI",
          `Unexpected response format from TEI: ${typeof data}`
        );
      }

      // Validate dimensions
      validateEmbeddingDimensions(embedding);

      return embedding;
    } catch (error) {
      // Re-throw APIError as-is
      if (error instanceof Error && error.name === "APIError") {
        throw error;
      }

      // Wrap other errors
      if (axios.isAxiosError(error)) {
        throw createAPIError(
          error.response?.status ?? 500,
          "TEI",
          error.message
        );
      }

      throw createAPIError(
        500,
        "TEI",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  return {
    embed,

    async embedWithInstruct(query: string, instruct: string): Promise<number[]> {
      // Format input with instruction prefix for mxbai-embed-large-v1
      // For retrieval queries, prepend the instruction
      const formattedInput = `${instruct} ${query}`;
      return embed(formattedInput);
    },
  };
}
