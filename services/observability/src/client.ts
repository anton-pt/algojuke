/**
 * Langfuse Observability Client
 *
 * Provides the main client for interacting with Langfuse.
 * Handles initialization, health checks, and shutdown.
 */

import { Langfuse } from "langfuse";
import { loadConfig, tryLoadConfig, type FullObservabilityConfig } from "./config.js";

/**
 * Health check response from Langfuse.
 */
export interface LangfuseHealthResponse {
  status: "OK" | "ERROR";
  version?: string;
  error?: string;
}

/**
 * Observability client wrapper.
 */
export interface ObservabilityClient {
  /** Langfuse client instance */
  langfuse: Langfuse;
  /** Whether observability is enabled */
  isEnabled: boolean;
  /** Configuration used */
  config: FullObservabilityConfig;
  /** Flush pending traces and shut down */
  shutdown: () => Promise<void>;
}

/**
 * Check Langfuse health endpoint.
 *
 * @returns Health status response
 */
export async function checkLangfuseHealth(): Promise<LangfuseHealthResponse> {
  const baseUrl = process.env.LANGFUSE_BASE_URL || "http://localhost:3000";

  try {
    const response = await fetch(`${baseUrl}/api/public/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        status: "ERROR",
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = (await response.json()) as { status: string; version?: string };
    return {
      status: data.status === "OK" ? "OK" : "ERROR",
      version: data.version,
    };
  } catch (error) {
    return {
      status: "ERROR",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create an observability client.
 *
 * @param runtimeOptions - Optional runtime configuration overrides
 * @returns Observability client instance
 */
export function createObservabilityClient(
  runtimeOptions?: Parameters<typeof loadConfig>[0]
): ObservabilityClient {
  const config = loadConfig(runtimeOptions);
  const isEnabled = config.env.LANGFUSE_ENABLED;

  const langfuse = new Langfuse({
    publicKey: config.env.LANGFUSE_PUBLIC_KEY,
    secretKey: config.env.LANGFUSE_SECRET_KEY,
    baseUrl: config.env.LANGFUSE_BASE_URL,
    flushAt: config.options.exportMode === "immediate" ? 1 : undefined,
    flushInterval: config.options.flushIntervalMs,
    enabled: isEnabled,
  });

  return {
    langfuse,
    isEnabled,
    config,
    shutdown: async () => {
      await langfuse.flushAsync();
      await langfuse.shutdownAsync();
    },
  };
}

/**
 * Try to create an observability client, returning null if configuration is invalid.
 * Useful for graceful degradation when observability is optional.
 *
 * @param runtimeOptions - Optional runtime configuration overrides
 * @returns Observability client or null
 */
export function tryCreateObservabilityClient(
  runtimeOptions?: Parameters<typeof loadConfig>[0]
): ObservabilityClient | null {
  const config = tryLoadConfig(runtimeOptions);
  if (!config) {
    return null;
  }

  const langfuse = new Langfuse({
    publicKey: config.env.LANGFUSE_PUBLIC_KEY,
    secretKey: config.env.LANGFUSE_SECRET_KEY,
    baseUrl: config.env.LANGFUSE_BASE_URL,
    flushAt: config.options.exportMode === "immediate" ? 1 : undefined,
    flushInterval: config.options.flushIntervalMs,
    enabled: config.env.LANGFUSE_ENABLED,
  });

  return {
    langfuse,
    isEnabled: config.env.LANGFUSE_ENABLED,
    config,
    shutdown: async () => {
      await langfuse.flushAsync();
      await langfuse.shutdownAsync();
    },
  };
}

/**
 * Global singleton client (lazy initialized).
 */
let globalClient: ObservabilityClient | null = null;

/**
 * Get or create the global observability client.
 *
 * @returns Global observability client
 */
export function getObservabilityClient(): ObservabilityClient {
  if (!globalClient) {
    globalClient = createObservabilityClient();
  }
  return globalClient;
}

/**
 * Shutdown the global observability client.
 */
export async function shutdownObservabilityClient(): Promise<void> {
  if (globalClient) {
    await globalClient.shutdown();
    globalClient = null;
  }
}
