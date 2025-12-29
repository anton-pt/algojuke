# @algojuke/observability

Langfuse-based observability service for tracking LLM invocations, vector search operations, and HTTP API calls.

## Overview

This service provides a unified interface for tracing and monitoring:

- **LLM Generations**: Track Claude and other LLM API calls with prompts, completions, and token usage
- **Vector Search**: Monitor Qdrant search operations with query parameters and results
- **HTTP Calls**: Trace external API requests (Tidal, embedding services) with timing and status
- **Correlated Traces**: Link related operations under a single trace for end-to-end visibility

## Prerequisites

- Node.js 20.x
- Docker (for Langfuse)
- Langfuse running locally (`docker compose up -d` from repository root)

## Installation

```bash
cd services/observability
npm install
```

## Configuration

Create a `.env` file (copy from `.env.example`):

```env
LANGFUSE_BASE_URL=http://localhost:3000
LANGFUSE_PUBLIC_KEY=pk-lf-local-dev
LANGFUSE_SECRET_KEY=sk-lf-local-dev
LANGFUSE_ENABLED=true
```

## Usage

### Basic Setup

```typescript
import {
  createObservabilityClient,
  checkLangfuseHealth,
} from "@algojuke/observability";

// Check Langfuse is available
const health = await checkLangfuseHealth();
if (health.status !== "OK") {
  console.error("Langfuse unavailable:", health.error);
}

// Create client
const client = createObservabilityClient();

// ... use client ...

// Shutdown when done
await client.shutdown();
```

### Tracing LLM Generations

```typescript
import { createGenerationSpan } from "@algojuke/observability";

const trace = client.langfuse.trace({ name: "user-query" });

const generation = createGenerationSpan(trace, {
  name: "llm-response",
  model: "claude-opus-4-20250514",
  input: {
    system: "You are a helpful assistant.",
    user: "What is jazz music?",
  },
  modelParameters: {
    temperature: 0.7,
    maxTokens: 500,
  },
});

// Make your LLM call...
const response = await callLLM(/* ... */);

generation.end({
  output: response.text,
  usage: {
    input: response.inputTokens,
    output: response.outputTokens,
    total: response.totalTokens,
  },
});
```

### Tracing Vector Search

```typescript
import { createSearchSpan } from "@algojuke/observability";

const search = createSearchSpan(trace, {
  name: "find-similar-tracks",
  collection: "tracks",
  topK: 10,
  query: { vector: embeddings, text: "relaxing jazz" },
  filters: { genre: "jazz" },
});

// Perform search...
const results = await qdrant.search(/* ... */);

search.end({
  resultCount: results.length,
  topScores: results.map((r) => r.score).slice(0, 5),
  resultIds: results.map((r) => r.id),
});
```

### Tracing HTTP Calls

```typescript
import { createHTTPSpan } from "@algojuke/observability";

const httpSpan = createHTTPSpan(trace, {
  name: "tidal-api-search",
  method: "GET",
  url: "https://api.tidal.com/v1/search",
  headers: { Authorization: "Bearer ..." },
});

// Make HTTP request...
const response = await fetch(/* ... */);

httpSpan.end({
  statusCode: response.status,
  durationMs: elapsed,
  body: await response.json(),
});
```

### Correlated Traces

Create a single trace with multiple related operations:

```typescript
const trace = client.langfuse.trace({
  name: "recommendation-flow",
  userId: "user-123",
  sessionId: "session-456",
  tags: ["recommendations"],
});

// Step 1: Search
const search = createSearchSpan(trace, { ... });
search.end({ ... });

// Step 2: HTTP enrichment
const http = createHTTPSpan(trace, { ... });
http.end({ ... });

// Step 3: LLM generation
const gen = createGenerationSpan(trace, { ... });
gen.end({ ... });

// All spans appear linked in Langfuse dashboard
await client.langfuse.flushAsync();
```

### Nested Spans

Create parent-child span hierarchies:

```typescript
const trace = client.langfuse.trace({ name: "batch-process" });

// Parent span
const parent = trace.span({ name: "process-batch" });

// Child spans
for (const item of items) {
  const search = createSearchSpan(parent, { ... });
  search.end({ ... });
}

parent.end();
```

## Demo Scripts

Run demo scripts to see tracing in action:

```bash
# LLM generation tracing
npm run demo:generation

# Vector search tracing
npm run demo:search

# HTTP call tracing
npm run demo:http

# Correlated multi-operation traces
npm run demo:correlated
```

View results at http://localhost:3000 (login: `admin@localhost.dev` / `adminadmin`).

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Type checking
npm run type-check
```

## API Reference

### Client Functions

| Function | Description |
|----------|-------------|
| `createObservabilityClient()` | Create and initialize Langfuse client |
| `tryCreateObservabilityClient()` | Safe version that returns undefined on error |
| `getObservabilityClient()` | Get or create singleton client |
| `shutdownObservabilityClient()` | Flush and shutdown singleton client |
| `checkLangfuseHealth()` | Check Langfuse server status |

### Span Functions

| Function | Description |
|----------|-------------|
| `createGenerationSpan(parent, options)` | Track LLM API calls |
| `createSearchSpan(parent, options)` | Track vector search operations |
| `createHTTPSpan(parent, options)` | Track HTTP API calls |

### Context Functions

| Function | Description |
|----------|-------------|
| `createTraceContext(options?)` | Create new trace context |
| `withTraceContext(context, fn)` | Execute function within context |
| `getTraceId()` | Get current trace ID |
| `getSpanId()` | Get current span ID |
| `getCurrentContext()` | Get full current context |
| `createChildContext(metadata?)` | Create child context from current |

## Architecture

```
services/observability/
├── src/
│   ├── index.ts          # Public exports
│   ├── config.ts         # Configuration loading (Zod)
│   ├── client.ts         # Langfuse client wrapper
│   ├── generation.ts     # LLM generation spans
│   ├── search.ts         # Vector search spans
│   ├── http.ts           # HTTP call spans
│   ├── context.ts        # Trace context propagation
│   └── schemas/          # Zod validation schemas
├── tests/
│   ├── contract/         # Schema validation tests
│   └── integration/      # Langfuse integration tests
└── scripts/              # Demo scripts
```

## Related Documentation

- [Langfuse Documentation](https://langfuse.com/docs)
- [Feature Spec](/specs/005-llm-observability/spec.md)
- [Implementation Plan](/specs/005-llm-observability/plan.md)
