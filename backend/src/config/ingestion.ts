/**
 * Ingestion Configuration Module
 *
 * Centralized configuration for ingestion scheduling infrastructure.
 * Provides typed access to environment variables with defaults.
 *
 * Required environment variables:
 * - QDRANT_URL: Qdrant server URL (default: http://localhost:6333)
 * - QDRANT_COLLECTION: Qdrant collection name (default: tracks)
 * - INNGEST_EVENT_KEY: Inngest event key for production (optional in dev)
 *
 * Optional environment variables:
 * - INGESTION_CONCURRENCY: Max parallel scheduling operations (default: 10)
 * - INGESTION_SLA_MS: SLA threshold for scheduling (default: 5000)
 */

import { z } from "zod";

/**
 * Ingestion configuration schema
 */
const IngestionConfigSchema = z.object({
  /**
   * Qdrant server configuration
   */
  qdrant: z.object({
    url: z.string().url().default("http://localhost:6333"),
    collection: z.string().min(1).default("tracks"),
  }),

  /**
   * Inngest configuration
   */
  inngest: z.object({
    eventKey: z.string().optional(),
    appId: z.string().default("algojuke-backend"),
  }),

  /**
   * Scheduling configuration
   */
  scheduling: z.object({
    concurrency: z.number().int().min(1).max(50).default(10),
    slaMs: z.number().int().min(1000).max(60000).default(5000),
  }),
});

export type IngestionConfig = z.infer<typeof IngestionConfigSchema>;

/**
 * Load ingestion configuration from environment
 *
 * @returns Validated ingestion configuration
 */
export function loadIngestionConfig(): IngestionConfig {
  return IngestionConfigSchema.parse({
    qdrant: {
      url: process.env.QDRANT_URL,
      collection: process.env.QDRANT_COLLECTION,
    },
    inngest: {
      eventKey: process.env.INNGEST_EVENT_KEY,
      appId: process.env.INNGEST_APP_ID,
    },
    scheduling: {
      concurrency: process.env.INGESTION_CONCURRENCY
        ? parseInt(process.env.INGESTION_CONCURRENCY, 10)
        : undefined,
      slaMs: process.env.INGESTION_SLA_MS
        ? parseInt(process.env.INGESTION_SLA_MS, 10)
        : undefined,
    },
  });
}

/**
 * Singleton configuration instance
 */
let _config: IngestionConfig | null = null;

/**
 * Get ingestion configuration (lazy loaded singleton)
 *
 * @returns Validated ingestion configuration
 */
export function getIngestionConfig(): IngestionConfig {
  if (!_config) {
    _config = loadIngestionConfig();
  }
  return _config;
}

/**
 * Reset configuration (for testing)
 */
export function resetIngestionConfig(): void {
  _config = null;
}
