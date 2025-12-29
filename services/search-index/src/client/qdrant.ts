/**
 * Qdrant client configuration for vector search index
 */

import { QdrantClient } from '@qdrant/js-client-rest';

/**
 * Environment variables for Qdrant connection
 */
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY; // Optional for local Docker

/**
 * Create and configure Qdrant client instance
 */
export function createQdrantClient(): QdrantClient {
  const config: ConstructorParameters<typeof QdrantClient>[0] = {
    url: QDRANT_URL,
    checkCompatibility: false, // Disable version check for development
  };

  // Add API key if provided (not needed for local Docker instance)
  if (QDRANT_API_KEY) {
    config.apiKey = QDRANT_API_KEY;
  }

  return new QdrantClient(config);
}

/**
 * Singleton Qdrant client instance
 */
export const qdrantClient = createQdrantClient();

/**
 * Verify Qdrant server is reachable
 * @throws Error if connection fails
 */
export async function verifyConnection(): Promise<void> {
  try {
    await qdrantClient.getCollections();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to connect to Qdrant at ${QDRANT_URL}: ${message}`);
  }
}
