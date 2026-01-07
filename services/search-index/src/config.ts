/**
 * Search Index Configuration
 *
 * Feature: 043-gemini-embeddings
 *
 * Provides environment-based configuration for the search index service,
 * particularly for embedding dimensions that vary by provider.
 */

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
