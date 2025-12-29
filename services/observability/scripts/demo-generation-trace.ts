#!/usr/bin/env npx tsx
/**
 * Demo: Generation Trace Capture
 *
 * This script demonstrates how to trace LLM invocations using the observability service.
 * Run with: npm run demo:generation
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
  checkLangfuseHealth,
} from "../src/index.js";

async function main() {
  console.log("Demo: Generation Trace Capture\n");

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
    name: "demo-generation-trace",
    metadata: {
      demo: true,
      timestamp: new Date().toISOString(),
    },
    tags: ["demo", "generation"],
  });
  console.log(`Created trace: ${trace.id}`);

  // Simulate an LLM call
  console.log("\nSimulating LLM call...");
  const startTime = Date.now();

  const generation = createGenerationSpan(trace, {
    name: "claude-demo-call",
    model: "claude-opus-4-20250514",
    input: [
      { role: "system", content: "You are a helpful music assistant." },
      { role: "user", content: "Recommend a jazz album for relaxation." },
    ],
    modelParameters: {
      temperature: 0.7,
      maxTokens: 200,
    },
    metadata: {
      feature: "music-recommendation",
      userIntent: "relaxation",
    },
  });
  console.log(`Created generation: ${generation.id}`);

  // Simulate API latency
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Simulate LLM response
  const mockResponse = {
    role: "assistant",
    content:
      "I'd recommend 'Kind of Blue' by Miles Davis. It's a timeless jazz masterpiece with a relaxed, contemplative mood perfect for unwinding.",
  };

  const latencyMs = Date.now() - startTime;

  // End the generation with output and usage
  generation.end({
    output: mockResponse,
    usage: {
      input: 45,
      output: 38,
      total: 83,
      inputCost: 0.000675,
      outputCost: 0.00285,
      totalCost: 0.003525,
    },
  });

  console.log(`Generation completed (${latencyMs}ms)`);
  console.log(`Response: "${mockResponse.content.substring(0, 50)}..."\n`);

  // Demonstrate error handling
  console.log("Simulating failed LLM call...");
  const errorTrace = client.langfuse.trace({
    name: "demo-generation-error",
    tags: ["demo", "error"],
  });

  const errorGeneration = createGenerationSpan(errorTrace, {
    name: "failed-llm-call",
    model: "claude-opus-4-20250514",
    input: [{ role: "user", content: "This will fail" }],
  });

  errorGeneration.end({
    output: null,
    error: new Error("Simulated API rate limit exceeded"),
    level: "ERROR",
  });
  console.log("Error generation recorded\n");

  // Flush and shutdown
  console.log("Flushing traces to Langfuse...");
  await client.shutdown();
  console.log("Done!\n");

  console.log("View traces at: http://localhost:3000");
  console.log("Login: admin@localhost.dev / adminadmin");
}

main().catch(console.error);
