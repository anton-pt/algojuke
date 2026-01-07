/**
 * Local TEI Embedding Client
 *
 * Feature: 043-gemini-embeddings
 *
 * Implements the EmbeddingClient interface by wrapping the existing TEI client.
 * Used for local development with the mxbai-embed-large-v1 model.
 */

import {
  createTEIClient as createRawTEIClient,
  QUERY_EMBED_INSTRUCTION,
} from "./teiClient.js";
import type { EmbeddingClient, EmbeddingTaskType } from "./embedding.js";

/**
 * Local TEI model name
 */
const LOCAL_MODEL = "mixedbread-ai/mxbai-embed-large-v1";

/**
 * Expected embedding dimensions for mxbai-embed-large-v1
 */
const LOCAL_DIMENSIONS = 1024;

/**
 * Create a local TEI embedding client
 *
 * Wraps the existing TEI client to implement the EmbeddingClient interface.
 * Uses instruction prefix for RETRIEVAL_QUERY task type.
 *
 * @returns EmbeddingClient implementation using local TEI
 */
export function createTEIEmbeddingClient(): EmbeddingClient {
  const tei = createRawTEIClient();

  return {
    async embed(
      text: string,
      taskType: EmbeddingTaskType = "RETRIEVAL_DOCUMENT",
    ): Promise<number[]> {
      if (taskType === "RETRIEVAL_QUERY") {
        // Use instruction prefix for query embeddings (asymmetric search)
        return tei.embedWithInstruct(text, QUERY_EMBED_INSTRUCTION);
      }

      // Direct embedding for document content
      return tei.embed(text);
    },

    getDimensions(): number {
      return LOCAL_DIMENSIONS;
    },

    async isHealthy(): Promise<boolean> {
      return tei.isHealthy();
    },

    getProviderName(): string {
      return "local";
    },

    getModelName(): string {
      return LOCAL_MODEL;
    },
  };
}
