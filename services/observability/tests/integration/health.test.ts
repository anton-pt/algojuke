/**
 * Integration tests for Langfuse Health Check
 *
 * TDD: These tests are written FIRST and should FAIL until client.ts is implemented.
 * Requires Langfuse to be running (docker compose up).
 */

import { describe, it, expect, beforeAll } from "vitest";

// Import will fail until implementation exists
import {
  createObservabilityClient,
  checkLangfuseHealth,
  type ObservabilityClient,
} from "../../src/client.js";

describe("Langfuse Health Check", () => {
  beforeAll(() => {
    // Set up test environment
    process.env.LANGFUSE_BASE_URL = "http://localhost:3000";
    process.env.LANGFUSE_PUBLIC_KEY = "pk-lf-local-dev";
    process.env.LANGFUSE_SECRET_KEY = "sk-lf-local-dev";
    process.env.LANGFUSE_ENABLED = "true";
  });

  it("should return healthy status when Langfuse is running", async () => {
    const health = await checkLangfuseHealth();

    expect(health.status).toBe("OK");
    expect(health.version).toBeDefined();
  });

  it("should handle connection errors gracefully", async () => {
    // Temporarily use invalid URL
    const originalUrl = process.env.LANGFUSE_BASE_URL;
    process.env.LANGFUSE_BASE_URL = "http://localhost:9999";

    const health = await checkLangfuseHealth();

    expect(health.status).toBe("ERROR");
    expect(health.error).toBeDefined();

    // Restore
    process.env.LANGFUSE_BASE_URL = originalUrl;
  });
});

describe("ObservabilityClient", () => {
  let client: ObservabilityClient;

  beforeAll(() => {
    process.env.LANGFUSE_BASE_URL = "http://localhost:3000";
    process.env.LANGFUSE_PUBLIC_KEY = "pk-lf-local-dev";
    process.env.LANGFUSE_SECRET_KEY = "sk-lf-local-dev";
    process.env.LANGFUSE_ENABLED = "true";
  });

  it("should create client successfully with valid config", () => {
    client = createObservabilityClient();

    expect(client).toBeDefined();
    expect(client.langfuse).toBeDefined();
    expect(client.isEnabled).toBe(true);
  });

  it("should create disabled client when LANGFUSE_ENABLED is false", () => {
    process.env.LANGFUSE_ENABLED = "false";

    client = createObservabilityClient();

    expect(client).toBeDefined();
    expect(client.isEnabled).toBe(false);

    // Restore
    process.env.LANGFUSE_ENABLED = "true";
  });

  it("should flush pending traces on shutdown", async () => {
    client = createObservabilityClient();

    // Should not throw
    await client.shutdown();
  });

  it("should create trace with proper metadata", async () => {
    client = createObservabilityClient();

    const trace = client.langfuse.trace({
      name: "test-trace",
      metadata: { test: true },
      tags: ["integration-test"],
    });

    expect(trace).toBeDefined();
    expect(trace.id).toBeDefined();

    // Flush and cleanup
    await client.shutdown();
  });
});
