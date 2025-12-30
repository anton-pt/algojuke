/**
 * TEI (Text Embeddings Inference) Client for Discovery Search
 *
 * Feature: 009-semantic-discovery-search
 * Date: 2025-12-30
 *
 * Generates embeddings using locally-hosted mixedbread-ai/mxbai-embed-large-v1 model.
 * Mirrored from services/worker/src/clients/tei.ts for backend use.
 */

import axios from "axios";
import { z } from "zod";
import { EMBEDDING_DIMENSION } from "../types/discovery.js";
import { logger } from "../utils/logger.js";

/**
 * TEI service URL from environment
 */
const TEI_URL = process.env.TEI_URL ?? "http://localhost:8080";

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
   * Uses asymmetric search pattern for mxbai-embed-large-v1
   */
  embedWithInstruct(query: string, instruct: string): Promise<number[]>;

  /**
   * Health check for TEI service
   */
  isHealthy(): Promise<boolean>;
}

/**
 * TEI error class
 */
export class TEIError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "TEIError";
  }
}

/**
 * Validate embedding dimensions
 *
 * @param embedding - The embedding vector to validate
 * @throws Error if dimensions don't match expected 1024
 */
export function validateEmbeddingDimensions(embedding: number[]): void {
  if (embedding.length !== EMBEDDING_DIMENSION) {
    throw new TEIError(
      `Embedding must be exactly ${EMBEDDING_DIMENSION} dimensions, got ${embedding.length}`,
      500,
      false
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
          throw new TEIError(
            "TEI model not loaded. Wait for model download to complete.",
            503,
            true
          );
        }

        const retryable = [429, 500, 502, 503, 504, 408].includes(response.status);
        throw new TEIError(
          `Failed to generate embedding: ${response.statusText}`,
          response.status,
          retryable
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
        throw new TEIError(
          `Unexpected response format from TEI: ${typeof data}`,
          500,
          false
        );
      }

      // Validate dimensions
      validateEmbeddingDimensions(embedding);

      return embedding;
    } catch (error) {
      // Re-throw TEIError as-is
      if (error instanceof TEIError) {
        throw error;
      }

      // Wrap other errors
      if (axios.isAxiosError(error)) {
        const retryable = error.code === "ECONNREFUSED" ||
          error.code === "ECONNRESET" ||
          error.code === "ETIMEDOUT";

        logger.warn("tei_request_failed", {
          event: "tei_error",
          error: error.message,
          code: error.code,
        });

        throw new TEIError(
          error.message,
          error.response?.status ?? 500,
          retryable
        );
      }

      throw new TEIError(
        error instanceof Error ? error.message : "Unknown error",
        500,
        false
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

    async isHealthy(): Promise<boolean> {
      try {
        const response = await axios.get(`${url}/health`, {
          timeout: 5000,
          validateStatus: () => true,
        });
        return response.status === 200;
      } catch {
        return false;
      }
    },
  };
}

/**
 * Default instruction for query embedding
 * Used for asymmetric search with mxbai-embed-large-v1
 */
export const QUERY_EMBED_INSTRUCTION =
  "Instruct: Find music tracks matching this description\nQuery:";

/**
 * TEI model name for tracing
 */
export const TEI_MODEL_NAME = "mixedbread-ai/mxbai-embed-large-v1";

/**
 * Singleton TEI client instance
 */
let _teiClient: TEIClient | null = null;

/**
 * Get or create the singleton TEI client
 */
export function getTEIClient(): TEIClient {
  if (!_teiClient) {
    _teiClient = createTEIClient();
  }
  return _teiClient;
}

/**
 * Reset the singleton (for testing)
 */
export function resetTEIClient(): void {
  _teiClient = null;
}
