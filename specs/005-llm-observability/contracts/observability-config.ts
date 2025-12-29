/**
 * Observability Service Configuration Contract
 *
 * Defines the configuration interface for the Langfuse-based observability service.
 * This contract specifies how the observability infrastructure is configured
 * and what options are available to consuming services.
 */

import { z } from "zod";

/**
 * Environment variable configuration schema.
 * These are read at startup and cannot be changed at runtime.
 */
export const LangfuseEnvConfigSchema = z.object({
  /** Langfuse server base URL */
  LANGFUSE_BASE_URL: z.string().url().default("http://localhost:3000"),

  /** Langfuse public API key */
  LANGFUSE_PUBLIC_KEY: z.string().min(1),

  /** Langfuse secret API key */
  LANGFUSE_SECRET_KEY: z.string().min(1),

  /** Enable/disable observability (useful for testing) */
  LANGFUSE_ENABLED: z
    .string()
    .transform((v) => v === "true")
    .default("true"),
});

export type LangfuseEnvConfig = z.infer<typeof LangfuseEnvConfigSchema>;

/**
 * Runtime configuration options for the observability client.
 */
export const ObservabilityConfigSchema = z.object({
  /** Flush interval in milliseconds (default: 1000ms) */
  flushIntervalMs: z.number().positive().default(1000),

  /** Export mode: "batched" for efficiency, "immediate" for serverless */
  exportMode: z.enum(["batched", "immediate"]).default("batched"),
});

export type ObservabilityConfig = z.infer<typeof ObservabilityConfigSchema>;

/**
 * Combined configuration (env + runtime options).
 */
export interface FullObservabilityConfig {
  env: LangfuseEnvConfig;
  options: ObservabilityConfig;
}
