#!/usr/bin/env npx tsx
/**
 * Demo: HTTP Trace Capture
 *
 * This script demonstrates how to trace HTTP API calls using the observability service.
 * Run with: npm run demo:http
 *
 * Prerequisites:
 * - Langfuse running (docker compose up)
 * - Environment variables set (or use defaults)
 */

import * as dotenv from "dotenv";
dotenv.config();

import {
  createObservabilityClient,
  createHTTPSpan,
  checkLangfuseHealth,
} from "../src/index.js";

async function main() {
  console.log("Demo: HTTP Trace Capture\n");

  // Check Langfuse health
  console.log("Checking Langfuse health...");
  const health = await checkLangfuseHealth();
  if (health.status !== "OK") {
    console.error(`Langfuse is not healthy: ${health.error}`);
    console.log("Make sure Langfuse is running: docker compose up -d");
    process.exit(1);
  }
  console.log(`Langfuse is healthy (version: ${health.version})\n`);

  // Create observability client
  const client = createObservabilityClient();
  console.log(`Observability enabled: ${client.isEnabled}\n`);

  // Create a trace
  const trace = client.langfuse.trace({
    name: "demo-http-trace",
    metadata: {
      demo: true,
      timestamp: new Date().toISOString(),
    },
    tags: ["demo", "http"],
  });
  console.log(`Created trace: ${trace.id}`);

  // Simulate a successful HTTP call
  console.log("\nSimulating successful Tidal API call...");
  const startTime = Date.now();

  const httpSpan = createHTTPSpan(trace, {
    name: "tidal-search-api",
    method: "GET",
    url: "https://api.tidal.com/v1/search",
    headers: {
      Authorization: "Bearer demo-token",
      "Content-Type": "application/json",
      "X-Request-Id": "demo-12345",
    },
    metadata: {
      feature: "music-search",
      query: "relaxing jazz",
    },
  });
  console.log(`Created HTTP span: ${httpSpan.id}`);

  // Simulate API latency
  await new Promise((resolve) => setTimeout(resolve, 80));

  const durationMs = Date.now() - startTime;

  // End with mock response
  httpSpan.end({
    statusCode: 200,
    durationMs,
    body: {
      totalNumberOfItems: 50,
      items: [
        { id: "track-1", title: "Take Five" },
        { id: "track-2", title: "So What" },
      ],
    },
    headers: {
      "Content-Type": "application/json",
      "X-RateLimit-Remaining": "99",
    },
  });

  console.log(`HTTP call completed (${durationMs}ms)`);
  console.log("Status: 200 OK\n");

  // Simulate a 404 error
  console.log("Simulating 404 Not Found...");
  const notFoundSpan = createHTTPSpan(trace, {
    name: "tidal-track-details",
    method: "GET",
    url: "https://api.tidal.com/v1/tracks/invalid-id",
  });

  notFoundSpan.end({
    statusCode: 404,
    durationMs: 45,
    body: {
      error: "Track not found",
      errorCode: "RESOURCE_NOT_FOUND",
    },
  });
  console.log("404 response recorded\n");

  // Simulate rate limit error
  console.log("Simulating 429 Rate Limit...");
  const rateLimitSpan = createHTTPSpan(trace, {
    name: "tidal-batch-request",
    method: "POST",
    url: "https://api.tidal.com/v1/batch",
    body: { tracks: ["id1", "id2", "id3"] },
  });

  rateLimitSpan.end({
    statusCode: 429,
    durationMs: 20,
    body: {
      error: "Rate limit exceeded",
      retryAfter: 60,
    },
    headers: {
      "Retry-After": "60",
    },
  });
  console.log("429 response recorded\n");

  // Simulate connection timeout
  console.log("Simulating connection timeout...");
  const timeoutSpan = createHTTPSpan(trace, {
    name: "external-lyrics-api",
    method: "GET",
    url: "https://api.lyrics.com/lyrics/track-123",
  });

  timeoutSpan.end({
    statusCode: 0,
    durationMs: 30000,
    error: new Error("ETIMEDOUT: Connection timeout after 30s"),
  });
  console.log("Timeout error recorded\n");

  // Flush and shutdown
  console.log("Flushing traces to Langfuse...");
  await client.shutdown();
  console.log("Done!\n");

  console.log("View traces at: http://localhost:3000");
  console.log("Login: admin@localhost.dev / adminadmin");
}

main().catch(console.error);
