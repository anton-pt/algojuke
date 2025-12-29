/**
 * Worker Service Express Server
 *
 * Serves Inngest function endpoints for the background task queue infrastructure.
 * This server acts as the execution environment for Inngest functions, receiving
 * HTTP requests from the Inngest Dev Server to execute demo tasks.
 */

import express from "express";
import { serve } from "inngest/express";
import { inngest } from "./inngest/client.js";
import { functions } from "./inngest/functions/index.js";

const app = express();
const port = process.env.WORKER_PORT || 3001;

// Parse JSON request bodies (required for Inngest)
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "algojuke-worker" });
});

// Serve Inngest functions at /api/inngest
app.use(
  "/api/inngest",
  serve({
    client: inngest,
    functions: functions,
  })
);

// Start server
app.listen(port, () => {
  console.log(`✓ Worker service listening on port ${port}`);
  console.log(`✓ Inngest functions served at http://localhost:${port}/api/inngest`);
  console.log(`✓ Health check available at http://localhost:${port}/health`);
  console.log(`✓ Registered functions: ${functions.length}`);
  functions.forEach((fn) => {
    console.log(`  - ${fn.name || fn.id}`);
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  process.exit(0);
});
