/**
 * Embedding Client Abstraction
 *
 * Feature: 043-gemini-embeddings
 *
 * Provides a unified interface for embedding generation that supports multiple providers:
 * - Gemini (gemini-embedding-001 via Vertex AI) for production
 * - Local TEI (mxbai-embed-large-v1) for development
 *
 * The provider is selected via EMBEDDING_PROVIDER environment variable.
 */

import { createGeminiEmbeddingClient } from "./geminiEmbedding.js";
import { createTEIEmbeddingClient } from "./localEmbedding.js";

/**
 * Embedding error class for unified error handling
 */
export class EmbeddingError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly retryable: boolean,
    public readonly provider: string,
  ) {
    super(message);
    this.name = "EmbeddingError";
  }
}

/**
 * Task types for embedding generation
 *
 * - RETRIEVAL_DOCUMENT: For indexing content (track interpretations)
 * - RETRIEVAL_QUERY: For search queries
 */
export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

/**
 * Unified embedding client interface
 */
export interface EmbeddingClient {
  /**
   * Generate embedding for text
   *
   * @param text - Text to embed
   * @param taskType - Task type for asymmetric search optimization
   * @returns Embedding vector
   */
  embed(text: string, taskType?: EmbeddingTaskType): Promise<number[]>;

  /**
   * Get the dimension size for this provider
   */
  getDimensions(): number;

  /**
   * Check if the embedding service is healthy
   */
  isHealthy(): Promise<boolean>;

  /**
   * Get the provider name for logging/tracing
   */
  getProviderName(): string;

  /**
   * Get the model name for logging/tracing
   */
  getModelName(): string;
}

/**
 * Default dimensions per provider
 */
const PROVIDER_DIMENSIONS = {
  gemini: 3072,
  local: 1024,
} as const;

/**
 * Get the embedding dimensions based on environment configuration
 *
 * Uses EMBEDDING_DIMENSIONS if explicitly set, otherwise defaults based on provider:
 * - gemini: 3072
 * - local: 1024
 *
 * @returns Embedding dimension size
 */
export function getEmbeddingDimensions(): number {
  const explicit = process.env.EMBEDDING_DIMENSIONS;
  if (explicit) {
    const parsed = parseInt(explicit, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  const provider = process.env.EMBEDDING_PROVIDER || "local";
  return provider === "gemini"
    ? PROVIDER_DIMENSIONS.gemini
    : PROVIDER_DIMENSIONS.local;
}

/**
 * Get the current embedding provider from environment
 *
 * @returns "gemini" or "local"
 */
export function getEmbeddingProvider(): "gemini" | "local" {
  const provider = process.env.EMBEDDING_PROVIDER || "local";
  return provider === "gemini" ? "gemini" : "local";
}

/**
 * Create an embedding client based on EMBEDDING_PROVIDER environment variable
 *
 * @returns Embedding client instance
 */
export function createEmbeddingClient(): EmbeddingClient {
  const provider = getEmbeddingProvider();

  if (provider === "gemini") {
    return createGeminiEmbeddingClient();
  }

  return createTEIEmbeddingClient();
}

/**
 * Create a zero vector of the appropriate dimensions
 *
 * Used when no lyrics are available for a track (instrumentals).
 *
 * @returns Zero vector with correct dimensions for current provider
 */
export function createZeroVector(): number[] {
  const dimensions = getEmbeddingDimensions();
  return new Array<number>(dimensions).fill(0);
}

/**
 * Validate embedding dimensions match expected size
 *
 * @param embedding - The embedding vector to validate
 * @throws Error if dimensions don't match expected size
 */
export function validateEmbeddingDimensions(embedding: number[]): void {
  const expected = getEmbeddingDimensions();
  if (embedding.length !== expected) {
    throw new Error(
      `Embedding must be exactly ${expected} dimensions, got ${embedding.length}`,
    );
  }
}

/**
 * Singleton embedding client instance
 */
let _embeddingClient: EmbeddingClient | null = null;

/**
 * Get or create the singleton embedding client
 */
export function getEmbeddingClient(): EmbeddingClient {
  if (!_embeddingClient) {
    _embeddingClient = createEmbeddingClient();
  }
  return _embeddingClient;
}

/**
 * Reset the singleton (for testing)
 */
export function resetEmbeddingClient(): void {
  _embeddingClient = null;
}
