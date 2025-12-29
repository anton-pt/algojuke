/**
 * Qdrant collection schema for track documents
 *
 * Defines the vector configuration, HNSW index parameters, and payload indexes
 * for the tracks collection supporting hybrid search (dense + sparse vectors).
 */

import type { Schemas } from '@qdrant/js-client-rest';

/**
 * Collection name for production tracks index
 */
export const PRODUCTION_COLLECTION_NAME = 'tracks';

/**
 * Vector configuration for track collection
 *
 * Includes dense vector (interpretation_embedding): 4096-dim semantic search with float16 vectors
 */
export const VECTOR_CONFIG = {
  interpretation_embedding: {
    size: 4096,
    distance: 'Cosine',
    on_disk: false, // Keep in memory for performance
    datatype: 'float16', // Use float16 for embedding vectors
  },
};

/**
 * HNSW index configuration
 *
 * Tuned for 100k corpus:
 * - m=16: Bi-directional links per node (trade-off between recall and memory)
 * - ef_construct=200: Construction-time search depth (higher = better quality, slower indexing)
 * - hnsw_ef=128: Query-time search depth (higher = better recall, slower search)
 * - full_scan_threshold=10000: Use brute force below this size for better accuracy
 */
export const HNSW_CONFIG: Schemas['HnswConfigDiff'] = {
  m: 16,
  ef_construct: 200,
  on_disk: false,
};

/**
 * Optimizer configuration
 *
 * Controls when and how segments are optimized:
 * - indexing_threshold: Rebuild index when >20k unindexed points
 * - memmap_threshold: Memory-map segments >50k points
 * - max_segment_size: Split segments above 200k points
 */
export const OPTIMIZER_CONFIG: Schemas['OptimizersConfigDiff'] = {
  indexing_threshold: 20000,
  memmap_threshold: 50000,
  max_segment_size: 200000,
};

/**
 * Payload fields that should have indexes for filtering and lookup
 *
 * - isrc: Keyword index for exact ISRC lookups
 * - title, artist, lyrics, interpretation: Text indexes for BM25 search
 */
export const PAYLOAD_INDEXES = {
  isrc: 'keyword' as const,
  title: 'text' as const,
  artist: 'text' as const,
  lyrics: 'text' as const,
  interpretation: 'text' as const,
};

/**
 * Complete collection creation configuration
 */
export function getCollectionConfig(_collectionName: string): Schemas['CreateCollection'] {
  return {
    vectors: VECTOR_CONFIG as any, // Type assertion needed for complex schema
    hnsw_config: HNSW_CONFIG,
    optimizers_config: OPTIMIZER_CONFIG,
    // Sparse vectors configuration for BM25 keyword search
    // IDF modifier enables BM25-style weighting
    sparse_vectors: {
      text_sparse: {
        modifier: 'idf' as any, // BM25 weighting (required for keyword search)
      },
    },
  };
}
