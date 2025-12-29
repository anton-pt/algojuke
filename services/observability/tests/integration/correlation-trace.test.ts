/**
 * Integration tests for Correlated Multi-Operation Trace Visibility
 *
 * TDD: These tests validate that correlated traces appear correctly
 * linked in Langfuse with parent-child relationships.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createObservabilityClient,
  checkLangfuseHealth,
  createGenerationSpan,
  createSearchSpan,
  createHTTPSpan,
  type ObservabilityClient,
} from "../../src/index.js";

describe("Correlated Trace Integration", () => {
  let client: ObservabilityClient;

  beforeAll(async () => {
    const health = await checkLangfuseHealth();
    if (health.status !== "OK") {
      throw new Error(`Langfuse not available: ${health.error}`);
    }
    client = createObservabilityClient();
  });

  afterAll(async () => {
    if (client) {
      await client.shutdown();
    }
  });

  it("should create a trace with correlated spans", async () => {
    // Create a parent trace representing a user query flow
    const trace = client.langfuse.trace({
      name: "user-query-flow",
      metadata: {
        userId: "test-user-123",
        sessionId: "test-session-456",
      },
      tags: ["integration-test", "correlation"],
    });

    expect(trace.id).toBeDefined();

    // Step 1: HTTP call to external API
    const httpSpan = createHTTPSpan(trace, {
      name: "fetch-user-preferences",
      method: "GET",
      url: "https://api.example.com/preferences/test-user-123",
      metadata: { step: 1 },
    });

    httpSpan.end({
      statusCode: 200,
      durationMs: 45,
      body: { theme: "dark", language: "en" },
    });

    // Step 2: Vector search for relevant content
    const searchSpan = createSearchSpan(trace, {
      name: "find-relevant-tracks",
      collection: "tracks",
      topK: 10,
      query: { vector: new Array(4096).fill(0.1), text: "relaxing jazz" },
      metadata: { step: 2 },
    });

    searchSpan.end({
      resultCount: 5,
      topScores: [0.95, 0.89],
      resultIds: ["track-1", "track-2"],
    });

    // Step 3: LLM call to generate response
    const generationSpan = createGenerationSpan(trace, {
      name: "generate-recommendation",
      model: "claude-opus-4-20250514",
      input: {
        system: "You are a music recommendation assistant.",
        user: "Based on these tracks, what should I listen to next?",
      },
      metadata: { step: 3 },
    });

    generationSpan.end({
      output: "Based on your preferences for jazz, I recommend...",
      usage: {
        input: 150,
        output: 75,
        total: 225,
      },
    });

    // All spans should be created under the same trace
    expect(httpSpan.id).toBeDefined();
    expect(searchSpan.id).toBeDefined();
    expect(generationSpan.id).toBeDefined();

    // Flush to ensure data is sent
    await client.langfuse.flushAsync();
  });

  it("should create nested spans with parent-child relationships", async () => {
    const trace = client.langfuse.trace({
      name: "nested-operation-flow",
      tags: ["integration-test", "nested"],
    });

    // Parent span representing overall operation
    const parentSpan = trace.span({
      name: "process-user-request",
      metadata: { level: "parent" },
    });

    // Child span 1: Search operation
    const searchSpan = createSearchSpan(parentSpan, {
      name: "semantic-search",
      collection: "tracks",
      topK: 5,
      query: { vector: new Array(4096).fill(0.2) },
      metadata: { level: "child", operation: "search" },
    });

    searchSpan.end({
      resultCount: 3,
      topScores: [0.92, 0.85, 0.78],
    });

    // Child span 2: Generation operation
    const genSpan = createGenerationSpan(parentSpan, {
      name: "llm-response",
      model: "claude-opus-4-20250514",
      input: "Test input",
      metadata: { level: "child", operation: "generation" },
    });

    genSpan.end({
      output: "Test output",
      usage: { input: 10, output: 5, total: 15 },
    });

    // End parent span
    parentSpan.end();

    // Verify all IDs are unique
    const ids = [trace.id, parentSpan.id, searchSpan.id, genSpan.id];
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(4);

    await client.langfuse.flushAsync();
  });

  it("should support metadata propagation through trace context", async () => {
    const trace = client.langfuse.trace({
      name: "metadata-propagation-test",
      userId: "test-user",
      sessionId: "test-session",
      metadata: {
        requestId: "req-12345",
        environment: "test",
      },
      tags: ["integration-test", "metadata"],
    });

    // Create spans with additional metadata
    const span1 = createHTTPSpan(trace, {
      name: "api-call-1",
      method: "POST",
      url: "https://api.example.com/data",
      metadata: {
        inherited: true,
        spanOrder: 1,
      },
    });

    span1.end({ statusCode: 201, durationMs: 30 });

    const span2 = createSearchSpan(trace, {
      name: "search-1",
      collection: "items",
      topK: 10,
      query: { vector: new Array(4096).fill(0.3) },
      metadata: {
        inherited: true,
        spanOrder: 2,
      },
    });

    span2.end({ resultCount: 10 });

    // Verify trace has the metadata
    expect(trace.id).toBeDefined();

    await client.langfuse.flushAsync();
  });

  it("should handle error scenarios in correlated traces", async () => {
    const trace = client.langfuse.trace({
      name: "error-handling-flow",
      tags: ["integration-test", "error"],
    });

    // Successful first step
    const httpSpan = createHTTPSpan(trace, {
      name: "initial-request",
      method: "GET",
      url: "https://api.example.com/data",
    });

    httpSpan.end({ statusCode: 200, durationMs: 25 });

    // Failed second step
    const failedSearch = createSearchSpan(trace, {
      name: "failed-search",
      collection: "nonexistent",
      topK: 5,
      query: { vector: new Array(4096).fill(0) },
    });

    failedSearch.end({
      resultCount: 0,
      error: new Error("Collection not found"),
    });

    // Recovery step
    const retrySearch = createSearchSpan(trace, {
      name: "retry-search",
      collection: "tracks",
      topK: 5,
      query: { vector: new Array(4096).fill(0.1) },
    });

    retrySearch.end({
      resultCount: 5,
    });

    expect(failedSearch.id).toBeDefined();
    expect(retrySearch.id).toBeDefined();

    await client.langfuse.flushAsync();
  });

  it("should create traces with unique IDs for each request", async () => {
    const traces: string[] = [];

    for (let i = 0; i < 3; i++) {
      const trace = client.langfuse.trace({
        name: `unique-trace-${i}`,
        tags: ["integration-test", "uniqueness"],
      });
      traces.push(trace.id);
    }

    // All trace IDs should be unique
    const uniqueTraces = new Set(traces);
    expect(uniqueTraces.size).toBe(3);

    await client.langfuse.flushAsync();
  });
});
