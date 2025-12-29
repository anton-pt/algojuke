/**
 * Integration tests for Search Trace Capture
 *
 * TDD: These tests verify Search spans can be created and sent to Langfuse.
 * Requires Langfuse to be running (docker compose up).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { createObservabilityClient, type ObservabilityClient } from "../../src/client.js";
import {
  createSearchSpan,
  type SearchSpanOptions,
} from "../../src/search.js";

describe("Search Trace Capture", () => {
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

  it("should create a search span with required fields", () => {
    const trace = client.langfuse.trace({ name: "test-search-required" });

    const options: SearchSpanOptions = {
      name: "vector-search",
      collection: "tracks",
      topK: 10,
      query: { text: "relaxing jazz music" },
    };

    const span = createSearchSpan(trace, options);

    expect(span).toBeDefined();
    expect(span.id).toBeDefined();
  });

  it("should create a search span with all fields", () => {
    const trace = client.langfuse.trace({ name: "test-search-full" });

    const options: SearchSpanOptions = {
      name: "vector-search-full",
      collection: "tracks",
      topK: 20,
      query: {
        vector: [0.1, 0.2, 0.3],
        filters: { genre: "jazz" },
      },
      useSparse: true,
      metadata: {
        feature: "playlist-generation",
      },
    };

    const span = createSearchSpan(trace, options);

    expect(span).toBeDefined();
  });

  it("should end search span with results", () => {
    const trace = client.langfuse.trace({ name: "test-search-results" });

    const span = createSearchSpan(trace, {
      name: "vector-search-with-results",
      collection: "tracks",
      topK: 5,
      query: { text: "test query" },
    });

    // Simulate search results
    span.end({
      resultCount: 5,
      topScores: [0.95, 0.87, 0.82, 0.75, 0.70],
      resultIds: ["track-1", "track-2", "track-3", "track-4", "track-5"],
    });

    expect(span.id).toBeDefined();
  });

  it("should handle empty search results", () => {
    const trace = client.langfuse.trace({ name: "test-search-empty" });

    const span = createSearchSpan(trace, {
      name: "vector-search-empty",
      collection: "tracks",
      topK: 10,
      query: { text: "nonexistent query" },
    });

    span.end({
      resultCount: 0,
      topScores: [],
      resultIds: [],
    });

    expect(span.id).toBeDefined();
  });

  it("should handle search error", () => {
    const trace = client.langfuse.trace({ name: "test-search-error" });

    const span = createSearchSpan(trace, {
      name: "vector-search-error",
      collection: "tracks",
      topK: 10,
      query: { text: "error test" },
    });

    span.end({
      resultCount: 0,
      error: new Error("Qdrant connection timeout"),
    });

    expect(span.id).toBeDefined();
  });

  it("should create nested search within parent span", () => {
    const trace = client.langfuse.trace({ name: "test-search-nested" });
    const parentSpan = trace.span({ name: "retrieval-operation" });

    const span = createSearchSpan(parentSpan, {
      name: "nested-vector-search",
      collection: "tracks",
      topK: 5,
      query: { text: "nested test" },
    });

    span.end({
      resultCount: 3,
      topScores: [0.9, 0.8, 0.7],
    });

    parentSpan.end();

    expect(span.id).toBeDefined();
  });
});
