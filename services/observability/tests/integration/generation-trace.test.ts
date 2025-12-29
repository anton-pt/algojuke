/**
 * Integration tests for Generation Trace Capture
 *
 * TDD: These tests verify Generation spans can be created and sent to Langfuse.
 * Requires Langfuse to be running (docker compose up).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { createObservabilityClient, type ObservabilityClient } from "../../src/client.js";
import {
  createGenerationSpan,
  type GenerationSpanOptions,
} from "../../src/generation.js";

describe("Generation Trace Capture", () => {
  let client: ObservabilityClient;

  beforeAll(() => {
    process.env.LANGFUSE_BASE_URL = "http://localhost:3000";
    process.env.LANGFUSE_PUBLIC_KEY = "pk-lf-local-dev";
    process.env.LANGFUSE_SECRET_KEY = "sk-lf-local-dev";
    process.env.LANGFUSE_ENABLED = "true";

    client = createObservabilityClient();
  });

  afterAll(async () => {
    await client.shutdown();
  });

  it("should create a generation span with required fields", () => {
    const trace = client.langfuse.trace({ name: "test-generation-required" });

    const options: GenerationSpanOptions = {
      name: "llm-call",
      model: "claude-opus-4-20250514",
      input: [{ role: "user", content: "Hello, world!" }],
    };

    const generation = createGenerationSpan(trace, options);

    expect(generation).toBeDefined();
    expect(generation.id).toBeDefined();
  });

  it("should create a generation span with all fields", () => {
    const trace = client.langfuse.trace({ name: "test-generation-full" });

    const options: GenerationSpanOptions = {
      name: "llm-call-full",
      model: "claude-opus-4-20250514",
      input: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "What is 2+2?" },
      ],
      modelParameters: {
        temperature: 0.7,
        maxTokens: 100,
      },
      metadata: {
        feature: "test",
        version: "1.0",
      },
    };

    const generation = createGenerationSpan(trace, options);

    expect(generation).toBeDefined();
  });

  it("should end generation with output and usage", () => {
    const trace = client.langfuse.trace({ name: "test-generation-end" });

    const generation = createGenerationSpan(trace, {
      name: "llm-call-with-end",
      model: "claude-opus-4-20250514",
      input: [{ role: "user", content: "Test" }],
    });

    // Simulate LLM response
    generation.end({
      output: { role: "assistant", content: "Test response" },
      usage: {
        input: 10,
        output: 20,
        total: 30,
      },
    });

    expect(generation.id).toBeDefined();
  });

  it("should handle error status", () => {
    const trace = client.langfuse.trace({ name: "test-generation-error" });

    const generation = createGenerationSpan(trace, {
      name: "llm-call-error",
      model: "claude-opus-4-20250514",
      input: [{ role: "user", content: "Error test" }],
    });

    // Simulate error
    generation.end({
      output: null,
      error: new Error("API rate limit exceeded"),
      level: "ERROR",
    });

    expect(generation.id).toBeDefined();
  });

  it("should create nested generation within parent span", () => {
    const trace = client.langfuse.trace({ name: "test-generation-nested" });
    const parentSpan = trace.span({ name: "parent-operation" });

    const generation = createGenerationSpan(parentSpan, {
      name: "nested-llm-call",
      model: "claude-opus-4-20250514",
      input: [{ role: "user", content: "Nested test" }],
    });

    generation.end({
      output: { role: "assistant", content: "Nested response" },
      usage: { input: 5, output: 10 },
    });

    parentSpan.end();

    expect(generation.id).toBeDefined();
  });
});
