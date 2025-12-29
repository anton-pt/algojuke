/**
 * Integration tests for HTTP Trace Capture
 *
 * TDD: These tests verify HTTP spans can be created and sent to Langfuse.
 * Requires Langfuse to be running (docker compose up).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { createObservabilityClient, type ObservabilityClient } from "../../src/client.js";
import {
  createHTTPSpan,
  type HTTPSpanOptions,
} from "../../src/http.js";

describe("HTTP Trace Capture", () => {
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

  it("should create an HTTP span with required fields", () => {
    const trace = client.langfuse.trace({ name: "test-http-required" });

    const options: HTTPSpanOptions = {
      name: "tidal-api-call",
      method: "GET",
      url: "https://api.tidal.com/v1/search",
    };

    const span = createHTTPSpan(trace, options);

    expect(span).toBeDefined();
    expect(span.id).toBeDefined();
  });

  it("should create an HTTP span with all fields", () => {
    const trace = client.langfuse.trace({ name: "test-http-full" });

    const options: HTTPSpanOptions = {
      name: "tidal-api-full",
      method: "POST",
      url: "https://api.tidal.com/v1/playlist",
      headers: {
        Authorization: "Bearer test-token",
        "Content-Type": "application/json",
      },
      body: {
        name: "My Playlist",
        tracks: ["track-1", "track-2"],
      },
      metadata: {
        feature: "playlist-creation",
      },
    };

    const span = createHTTPSpan(trace, options);

    expect(span).toBeDefined();
  });

  it("should end HTTP span with response", () => {
    const trace = client.langfuse.trace({ name: "test-http-response" });

    const span = createHTTPSpan(trace, {
      name: "http-with-response",
      method: "GET",
      url: "https://api.example.com/data",
    });

    // Simulate HTTP response
    span.end({
      statusCode: 200,
      durationMs: 150,
      body: { data: [1, 2, 3] },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(span.id).toBeDefined();
  });

  it("should handle HTTP error response", () => {
    const trace = client.langfuse.trace({ name: "test-http-error-response" });

    const span = createHTTPSpan(trace, {
      name: "http-error-response",
      method: "GET",
      url: "https://api.example.com/notfound",
    });

    span.end({
      statusCode: 404,
      durationMs: 50,
      body: { error: "Not found" },
    });

    expect(span.id).toBeDefined();
  });

  it("should handle HTTP connection error", () => {
    const trace = client.langfuse.trace({ name: "test-http-connection-error" });

    const span = createHTTPSpan(trace, {
      name: "http-connection-error",
      method: "GET",
      url: "https://api.example.com/timeout",
    });

    span.end({
      statusCode: 0,
      durationMs: 30000,
      error: new Error("Connection timeout"),
    });

    expect(span.id).toBeDefined();
  });

  it("should create nested HTTP span within parent span", () => {
    const trace = client.langfuse.trace({ name: "test-http-nested" });
    const parentSpan = trace.span({ name: "data-enrichment" });

    const span = createHTTPSpan(parentSpan, {
      name: "nested-api-call",
      method: "GET",
      url: "https://api.lyrics.com/lyrics",
    });

    span.end({
      statusCode: 200,
      durationMs: 200,
      body: { lyrics: "Sample lyrics..." },
    });

    parentSpan.end();

    expect(span.id).toBeDefined();
  });
});
