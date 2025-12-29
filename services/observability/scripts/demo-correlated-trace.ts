#!/usr/bin/env npx tsx
/**
 * Demo: Correlated Trace Capture
 *
 * This script demonstrates how to create correlated traces that link
 * multiple operations (search → LLM → HTTP) under a single trace.
 *
 * Run with: npm run demo:correlated
 *
 * Prerequisites:
 * - Langfuse running (docker compose up)
 * - Environment variables set (or use defaults)
 */

import * as dotenv from "dotenv";
dotenv.config();

import {
  createObservabilityClient,
  createGenerationSpan,
  createSearchSpan,
  createHTTPSpan,
  checkLangfuseHealth,
} from "../src/index.js";

async function main() {
  console.log("Demo: Correlated Trace Capture\n");

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

  // ============================================================
  // Scenario: User asks for music recommendations
  // ============================================================
  console.log("=".repeat(60));
  console.log("Scenario: User Music Recommendation Request");
  console.log("=".repeat(60));

  // Create a parent trace representing the entire user request flow
  const trace = client.langfuse.trace({
    name: "music-recommendation-flow",
    userId: "user-demo-123",
    sessionId: "session-demo-456",
    metadata: {
      feature: "recommendations",
      source: "demo-script",
      timestamp: new Date().toISOString(),
    },
    tags: ["demo", "correlated", "recommendation"],
  });
  console.log(`\nCreated parent trace: ${trace.id}`);

  // Step 1: Fetch user preferences from external API
  console.log("\n--- Step 1: Fetch User Preferences (HTTP) ---");
  const preferencesSpan = createHTTPSpan(trace, {
    name: "fetch-user-preferences",
    method: "GET",
    url: "https://api.algojuke.internal/users/demo-123/preferences",
    headers: {
      Authorization: "Bearer demo-token",
      "X-Request-Id": trace.id,
    },
    metadata: { step: 1, operation: "user-preferences" },
  });

  // Simulate API latency
  await new Promise((resolve) => setTimeout(resolve, 50));

  preferencesSpan.end({
    statusCode: 200,
    durationMs: 50,
    body: {
      favoriteGenres: ["jazz", "electronic", "classical"],
      moodPreference: "relaxing",
      recentlyPlayed: ["track-001", "track-002"],
    },
  });
  console.log("  ✓ User preferences retrieved");

  // Step 2: Vector search for similar tracks
  console.log("\n--- Step 2: Vector Search for Similar Tracks ---");
  const searchSpan = createSearchSpan(trace, {
    name: "find-similar-tracks",
    collection: "tracks",
    topK: 20,
    query: {
      text: "relaxing jazz with electronic elements",
      vector: new Array(4096).fill(0).map(() => Math.random() * 0.1),
    },
    filters: {
      genres: ["jazz", "electronic"],
      mood: "relaxing",
    },
    useSparse: true,
    metadata: { step: 2, operation: "vector-search" },
  });

  // Simulate search latency
  await new Promise((resolve) => setTimeout(resolve, 120));

  searchSpan.end({
    resultCount: 15,
    topScores: [0.95, 0.92, 0.89, 0.87, 0.85],
    resultIds: ["track-101", "track-102", "track-103", "track-104", "track-105"],
  });
  console.log("  ✓ Found 15 similar tracks");

  // Step 3: Get track details from Tidal API
  console.log("\n--- Step 3: Enrich Track Data (HTTP) ---");
  const enrichSpan = createHTTPSpan(trace, {
    name: "fetch-track-metadata",
    method: "POST",
    url: "https://api.tidal.com/v1/tracks/batch",
    headers: {
      Authorization: "Bearer tidal-token",
      "Content-Type": "application/json",
    },
    body: {
      trackIds: ["track-101", "track-102", "track-103"],
      fields: ["title", "artist", "album", "duration"],
    },
    metadata: { step: 3, operation: "tidal-enrichment" },
  });

  // Simulate API latency
  await new Promise((resolve) => setTimeout(resolve, 80));

  enrichSpan.end({
    statusCode: 200,
    durationMs: 80,
    body: {
      tracks: [
        { id: "track-101", title: "Midnight Jazz", artist: "Blue Note Trio" },
        { id: "track-102", title: "Electric Dreams", artist: "Synth Collective" },
        { id: "track-103", title: "Calm Waters", artist: "Ambient Orchestra" },
      ],
    },
  });
  console.log("  ✓ Track metadata enriched");

  // Step 4: Generate personalized recommendation with LLM
  console.log("\n--- Step 4: Generate Recommendation (LLM) ---");
  const generationSpan = createGenerationSpan(trace, {
    name: "generate-recommendation-text",
    model: "claude-opus-4-20250514",
    input: {
      system:
        "You are a music recommendation assistant. Generate personalized recommendations based on user preferences and search results.",
      user: `User preferences: relaxing jazz with electronic elements.
Search results:
1. "Midnight Jazz" by Blue Note Trio (score: 0.95)
2. "Electric Dreams" by Synth Collective (score: 0.92)
3. "Calm Waters" by Ambient Orchestra (score: 0.89)

Generate a personalized recommendation.`,
    },
    modelParameters: {
      temperature: 0.7,
      maxTokens: 500,
    },
    metadata: { step: 4, operation: "llm-generation" },
  });

  // Simulate LLM latency
  await new Promise((resolve) => setTimeout(resolve, 200));

  generationSpan.end({
    output: `Based on your love for relaxing jazz with electronic elements, I've curated a perfect listening session for you:

🎵 **Top Pick: "Midnight Jazz" by Blue Note Trio**
This track beautifully blends classic jazz piano with subtle electronic undertones - exactly what you've been enjoying lately.

🎶 **Also Recommended:**
- "Electric Dreams" by Synth Collective - smooth synth waves meet jazz harmonies
- "Calm Waters" by Ambient Orchestra - perfect for unwinding

These selections match your mood preference for relaxing music while incorporating the genre fusion you enjoy. Happy listening! 🎧`,
    usage: {
      input: 180,
      output: 120,
      total: 300,
    },
  });
  console.log("  ✓ Recommendation generated");

  // Step 5: Log the recommendation to analytics
  console.log("\n--- Step 5: Log Analytics Event (HTTP) ---");
  const analyticsSpan = createHTTPSpan(trace, {
    name: "log-recommendation-event",
    method: "POST",
    url: "https://analytics.algojuke.internal/events",
    headers: {
      "Content-Type": "application/json",
    },
    body: {
      event: "recommendation_served",
      userId: "demo-123",
      trackIds: ["track-101", "track-102", "track-103"],
      timestamp: new Date().toISOString(),
    },
    metadata: { step: 5, operation: "analytics" },
  });

  // Simulate API latency
  await new Promise((resolve) => setTimeout(resolve, 30));

  analyticsSpan.end({
    statusCode: 202,
    durationMs: 30,
  });
  console.log("  ✓ Analytics event logged");

  // ============================================================
  // Nested Span Example
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("Scenario: Nested Span Structure");
  console.log("=".repeat(60));

  const nestedTrace = client.langfuse.trace({
    name: "nested-operation-demo",
    tags: ["demo", "nested"],
  });
  console.log(`\nCreated nested trace: ${nestedTrace.id}`);

  // Parent span
  const parentSpan = nestedTrace.span({
    name: "process-batch-request",
    metadata: { level: "parent", batchSize: 3 },
  });
  console.log("\n--- Parent: Process Batch Request ---");

  // Child operations under parent
  for (let i = 1; i <= 3; i++) {
    console.log(`  Processing item ${i}...`);

    // Each item gets its own search and generation
    const itemSearch = createSearchSpan(parentSpan, {
      name: `search-item-${i}`,
      collection: "tracks",
      topK: 5,
      query: { itemId: i, vector: new Array(4096).fill(0.1 * i) },
      metadata: { level: "child", itemIndex: i },
    });

    await new Promise((resolve) => setTimeout(resolve, 40));

    itemSearch.end({
      resultCount: 5,
      topScores: [0.9 + i * 0.01],
    });
  }

  parentSpan.end();
  console.log("  ✓ Batch processing complete");

  // ============================================================
  // Flush and Summary
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("Flushing traces to Langfuse...");
  await client.shutdown();
  console.log("Done!\n");

  console.log("Summary:");
  console.log(`  - Main trace: ${trace.id}`);
  console.log(`    └─ 5 correlated spans (HTTP → Search → HTTP → LLM → HTTP)`);
  console.log(`  - Nested trace: ${nestedTrace.id}`);
  console.log(`    └─ 1 parent span with 3 child search spans`);

  console.log("\nView traces at: http://localhost:3000");
  console.log("Login: admin@localhost.dev / adminadmin");
  console.log("\nLook for traces named:");
  console.log("  - 'music-recommendation-flow'");
  console.log("  - 'nested-operation-demo'");
}

main().catch(console.error);
