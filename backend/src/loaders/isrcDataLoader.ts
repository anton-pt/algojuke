/**
 * ISRC DataLoader for batched indexed status checks
 *
 * Feature: 008-track-metadata-display
 * Date: 2025-12-30
 *
 * Uses DataLoader to batch multiple isIndexed field resolver calls
 * into a single Qdrant query. This satisfies FR-017 (batch endpoint)
 * via the GraphQL field resolver pattern.
 *
 * Per-request caching ensures that repeated lookups within a single
 * GraphQL request don't result in redundant Qdrant calls.
 */

import DataLoader from 'dataloader';
import { TrackMetadataService } from '../services/trackMetadataService.js';

/**
 * Creates a DataLoader for batching ISRC indexed status lookups
 *
 * The DataLoader batches all isIndexed field resolver calls within
 * a single GraphQL request and resolves them with one Qdrant query.
 *
 * @param trackMetadataService - Service for Qdrant operations
 * @returns DataLoader that batches ISRC lookups
 */
export function createIsrcDataLoader(
  trackMetadataService: TrackMetadataService
): DataLoader<string, boolean> {
  return new DataLoader<string, boolean>(
    async (isrcs: readonly string[]): Promise<boolean[]> => {
      // Batch check all ISRCs in a single Qdrant call
      const statusMap = await trackMetadataService.checkIsIndexed([...isrcs]);

      // Return results in the same order as input ISRCs
      return isrcs.map((isrc) => statusMap.get(isrc.toUpperCase()) ?? false);
    },
    {
      // Cache results within this request only
      cache: true,
      // Normalize keys to uppercase for consistent caching
      cacheKeyFn: (key) => key.toUpperCase(),
    }
  );
}

/**
 * Type for the isIndexed DataLoader
 */
export type IsrcDataLoader = DataLoader<string, boolean>;
