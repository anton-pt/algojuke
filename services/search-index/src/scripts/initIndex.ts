#!/usr/bin/env node
/**
 * Index Initialization Script
 *
 * Initializes a Qdrant collection with the track document schema, vector
 * configuration, and indexes. Idempotent operation safe to re-run.
 *
 * Usage:
 *   npx tsx src/scripts/initIndex.ts <collection-name>
 *
 * Examples:
 *   npx tsx src/scripts/initIndex.ts tracks
 *   npx tsx src/scripts/initIndex.ts tracks-test-abc123
 */

import { qdrantClient, verifyConnection } from '../client/qdrant.js';
import {
  getCollectionConfig,
  PAYLOAD_INDEXES,
} from '../schema/trackCollection.js';

/**
 * Validate collection name format
 * @param name - Collection name to validate
 * @returns true if valid, false otherwise
 */
function isValidCollectionName(name: string): boolean {
  // Allow alphanumeric, hyphens, underscores
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

/**
 * Check if collection exists
 * @param collectionName - Collection to check
 * @returns true if exists, false otherwise
 */
async function collectionExists(collectionName: string): Promise<boolean> {
  try {
    await qdrantClient.getCollection(collectionName);
    return true;
  } catch (error) {
    // Handle 404 errors (collection not found)
    if (error instanceof Error &&
        (error.message.includes('Not found') ||
         error.message.includes('Not Found') ||
         error.message.includes('404'))) {
      return false;
    }
    throw error;
  }
}

/**
 * Create collection with full schema
 * @param collectionName - Name for the new collection
 */
async function createCollection(collectionName: string): Promise<void> {
  console.log(`[initIndex] INFO: Creating collection '${collectionName}'...`);

  const config = getCollectionConfig(collectionName);

  await qdrantClient.createCollection(collectionName, config);

  console.log(
    `[initIndex] INFO: Created collection '${collectionName}' with 4096-dim dense + sparse vectors`
  );
}

/**
 * Create payload indexes for filtering and text search
 * @param collectionName - Target collection
 */
async function createPayloadIndexes(collectionName: string): Promise<void> {
  console.log('[initIndex] INFO: Creating payload indexes...');

  for (const [field, indexType] of Object.entries(PAYLOAD_INDEXES)) {
    try {
      await qdrantClient.createPayloadIndex(collectionName, {
        field_name: field,
        field_schema: indexType,
      });
      console.log(`[initIndex] INFO: Created ${indexType} index on '${field}'`);
    } catch (error) {
      // Ignore "already exists" errors (idempotent operation)
      if (
        error instanceof Error &&
        error.message.includes('already exists')
      ) {
        console.log(
          `[initIndex] INFO: Index on '${field}' already exists (skipped)`
        );
      } else {
        throw error;
      }
    }
  }
}

/**
 * Verify collection schema matches expected configuration
 * @param collectionName - Collection to verify
 */
async function verifyCollectionSchema(
  collectionName: string
): Promise<void> {
  const collection = await qdrantClient.getCollection(collectionName);

  // Check vector count
  const pointsCount = collection.points_count || 0;
  console.log(`[initIndex] INFO: Collection has ${pointsCount} vectors`);

  // Verify vector config exists
  if (!collection.config?.params?.vectors) {
    throw new Error('Collection missing vector configuration');
  }

  console.log('[initIndex] INFO: Collection schema verified');
}

/**
 * Initialize Qdrant collection
 * @param collectionName - Name of collection to initialize
 */
async function initIndex(collectionName: string): Promise<void> {
  console.log('[initIndex] INFO: Connecting to Qdrant at', process.env.QDRANT_URL || 'http://localhost:6333');

  // Verify connection
  await verifyConnection();
  console.log('[initIndex] INFO: Connected to Qdrant successfully');

  // Check if collection exists
  const exists = await collectionExists(collectionName);

  if (exists) {
    console.log(
      `[initIndex] INFO: Collection '${collectionName}' already exists`
    );
    await verifyCollectionSchema(collectionName);
    console.log(
      `[initIndex] INFO: ✓ Collection '${collectionName}' verified successfully`
    );
  } else {
    // Create new collection
    await createCollection(collectionName);

    // Create payload indexes
    await createPayloadIndexes(collectionName);

    // Verify creation
    await verifyCollectionSchema(collectionName);

    console.log(
      `[initIndex] INFO: ✓ Collection '${collectionName}' initialized successfully`
    );
    console.log(`[initIndex] INFO:   Indexes: ${Object.keys(PAYLOAD_INDEXES).length}`);
  }
}

/**
 * CLI entry point
 */
async function main() {
  // Parse command-line arguments
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('[initIndex] ERROR: Missing collection name argument');
    console.error('');
    console.error('Usage: npx tsx src/scripts/initIndex.ts <collection-name>');
    console.error('');
    console.error('Examples:');
    console.error('  npx tsx src/scripts/initIndex.ts tracks');
    console.error('  npx tsx src/scripts/initIndex.ts tracks-test-abc123');
    process.exit(1);
  }

  const collectionName = args[0];

  // Validate collection name
  if (!isValidCollectionName(collectionName)) {
    console.error(
      `[initIndex] ERROR: Invalid collection name: ${collectionName}`
    );
    console.error(
      '[initIndex] ERROR: Collection name must contain only alphanumeric characters, hyphens, and underscores'
    );
    process.exit(1);
  }

  try {
    await initIndex(collectionName);
    process.exit(0);
  } catch (error) {
    // Error logging with context
    if (error instanceof Error) {
      console.error('[initIndex] ERROR:', error.message);
      console.error('[initIndex] Stack:', error.stack);
    } else {
      console.error('[initIndex] ERROR:', String(error));
    }

    // Provide actionable guidance
    console.error('');
    console.error('Troubleshooting:');
    console.error(
      '  - Ensure Qdrant is running: docker compose up qdrant -d'
    );
    console.error('  - Check QDRANT_URL environment variable');
    console.error('  - Verify network connectivity to Qdrant server');

    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('[initIndex] FATAL:', error);
    process.exit(1);
  });
}

// Export for testing
export { initIndex, isValidCollectionName, collectionExists };
