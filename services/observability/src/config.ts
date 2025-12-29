/**
 * Observability Service Configuration
 *
 * Defines the configuration interface for the Langfuse-based observability service.
 * Supports both environment-based and runtime configuration.
 */

import { z } from "zod";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

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

/**
 * Load configuration from environment variables and optional runtime options.
 *
 * @param runtimeOptions - Optional runtime configuration overrides
 * @returns Full observability configuration
 * @throws ZodError if required environment variables are missing or invalid
 */
export function loadConfig(
  runtimeOptions?: Partial<ObservabilityConfig>
): FullObservabilityConfig {
  // Parse environment configuration
  const envConfig = LangfuseEnvConfigSchema.parse({
    LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL,
    LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
    LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
    LANGFUSE_ENABLED: process.env.LANGFUSE_ENABLED,
  });

  // Parse runtime options with defaults
  const options = ObservabilityConfigSchema.parse(runtimeOptions ?? {});

  return {
    env: envConfig,
    options,
  };
}

/**
 * Try to load configuration, returning null if it fails.
 * Useful for graceful degradation when observability is optional.
 *
 * @param runtimeOptions - Optional runtime configuration overrides
 * @returns Full observability configuration or null if invalid/missing
 */
export function tryLoadConfig(
  runtimeOptions?: Partial<ObservabilityConfig>
): FullObservabilityConfig | null {
  try {
    return loadConfig(runtimeOptions);
  } catch {
    return null;
  }
}
