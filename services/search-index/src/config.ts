/**
 * Search Index Configuration
 *
 * Feature: 043-gemini-embeddings
 *
 * Provides environment-based configuration for the search index service,
 * particularly for embedding dimensions that vary by provider.
 */

/**
 * Dimension constants
 */
export const LOCAL_DIMENSIONS = 1024;
export const GEMINI_DIMENSIONS = 3072;

/**
 * Default dimensions per provider (internal)
 */
const PROVIDER_DIMENSIONS = {
  gemini: GEMINI_DIMENSIONS,
  local: LOCAL_DIMENSIONS,
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
 * Create a zero vector of the appropriate dimensions
 *
 * Used when no lyrics are available for a track (instrumentals).
 *
 * @returns Zero vector with correct dimensions for current provider
 */
export function createZeroVector(): number[] {
  const dimensions = getEmbeddingDimensions();
  return new Array(dimensions).fill(0);
}
