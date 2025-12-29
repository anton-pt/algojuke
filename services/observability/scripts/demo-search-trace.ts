#!/usr/bin/env npx tsx
/**
 * Demo: Search Trace Capture
 *
 * This script demonstrates how to trace vector search operations using the observability service.
 * Run with: npm run demo:search
 *
 * Prerequisites:
 * - Langfuse running (docker compose up)
 * - Environment variables set (or use defaults)
 */

import * as dotenv from "dotenv";
dotenv.config();

import {
  createObservabilityClient,
  createSearchSpan,
  checkLangfuseHealth,
} from "../src/index.js";

async function main() {
  console.log("Demo: Search Trace Capture\n");

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
    name: "demo-search-trace",
    metadata: {
      demo: true,
      timestamp: new Date().toISOString(),
    },
    tags: ["demo", "search"],
  });
  console.log(`Created trace: ${trace.id}`);

  // Simulate a vector search operation
  console.log("\nSimulating vector search...");
  const startTime = Date.now();

  const search = createSearchSpan(trace, {
    name: "track-similarity-search",
    collection: "tracks",
    topK: 10,
    query: {
      text: "relaxing jazz music for evening",
      embedding: [0.1, 0.2, 0.3, 0.4, 0.5], // truncated for demo
    },
    useSparse: true,
    filters: {
      must: [
        { key: "genre", match: { value: "jazz" } },
        { key: "tempo", range: { lte: 120 } },
      ],
    },
    metadata: {
      feature: "playlist-generation",
      userIntent: "relaxation",
    },
  });
  console.log(`Created search span: ${search.id}`);

  // Simulate search latency
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Simulate search results
  const mockResults = {
    resultCount: 10,
    topScores: [0.95, 0.92, 0.88, 0.85, 0.82, 0.78, 0.75, 0.72, 0.68, 0.65],
    resultIds: [
      "track-jazz-001",
      "track-jazz-042",
      "track-jazz-108",
      "track-jazz-055",
      "track-jazz-023",
      "track-jazz-089",
      "track-jazz-067",
      "track-jazz-034",
      "track-jazz-091",
      "track-jazz-012",
    ],
  };

  const latencyMs = Date.now() - startTime;

  // End the search span with results
  search.end(mockResults);

  console.log(`Search completed (${latencyMs}ms)`);
  console.log(`Found ${mockResults.resultCount} results`);
  console.log(`Top score: ${mockResults.topScores[0]}`);
  console.log(`Best match: ${mockResults.resultIds[0]}\n`);

  // Demonstrate empty results scenario
  console.log("Simulating search with no results...");
  const emptySearch = createSearchSpan(trace, {
    name: "track-search-no-results",
    collection: "tracks",
    topK: 10,
    query: { text: "extremely rare obscure genre" },
  });

  emptySearch.end({
    resultCount: 0,
    topScores: [],
    resultIds: [],
  });
  console.log("Empty search recorded\n");

  // Demonstrate error scenario
  console.log("Simulating search error...");
  const errorSearch = createSearchSpan(trace, {
    name: "track-search-error",
    collection: "tracks",
    topK: 10,
    query: { text: "error test" },
  });

  errorSearch.end({
    resultCount: 0,
    error: new Error("Qdrant connection timeout after 30s"),
  });
  console.log("Error search recorded\n");

  // Flush and shutdown
  console.log("Flushing traces to Langfuse...");
  await client.shutdown();
  console.log("Done!\n");

  console.log("View traces at: http://localhost:3000");
  console.log("Login: admin@localhost.dev / adminadmin");
}

main().catch(console.error);
