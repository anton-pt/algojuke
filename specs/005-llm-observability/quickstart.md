# Quickstart: LLM Observability Infrastructure

**Feature**: 005-llm-observability

## Prerequisites

- Docker and Docker Compose installed
- Node.js 20.x or later
- Existing algojuke repository cloned

## Starting the Infrastructure

### 1. Start All Services (Including Langfuse)

From the repository root:

```bash
docker compose up -d
```

This starts all algojuke services including the Langfuse observability stack.

### 2. Access the Langfuse Dashboard

Open http://localhost:3000 in your browser.

**Default Login** (local development):
- Email: `admin@localhost`
- Password: `admin`

### 3. Get API Keys

After logging in:
1. Navigate to Settings > API Keys
2. Copy the Public Key and Secret Key
3. Add them to your `.env` file:

```env
LANGFUSE_BASE_URL=http://localhost:3000
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
```

Or use the pre-configured keys (for local development only):
```env
LANGFUSE_BASE_URL=http://localhost:3000
LANGFUSE_PUBLIC_KEY=pk-lf-local-dev
LANGFUSE_SECRET_KEY=sk-lf-local-dev
```

## Using the Observability Service

### Installation (in your service)

```bash
npm install @langfuse/tracing @langfuse/otel @opentelemetry/sdk-node
```

### Basic Setup

Create `src/instrumentation.ts`:

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();
```

Import at the top of your entry file:

```typescript
import "./instrumentation";
// ... rest of your application
```

### Creating Traces

```typescript
import { startActiveObservation } from "@langfuse/tracing";

await startActiveObservation("my-operation", async (span) => {
  span.update({ input: { query: "example" } });

  // Your operation logic here

  span.update({ output: { result: "done" } });
});
```

### Tracing LLM Calls (with Vercel AI SDK)

```typescript
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

const { text } = await generateText({
  model: anthropic("claude-opus-4-20250514"),
  prompt: "Your prompt here",
  experimental_telemetry: { isEnabled: true },
});
```

The Langfuse span processor automatically captures the LLM call.

### Manual LLM Generation Span

```typescript
import { startObservation } from "@langfuse/tracing";

const generation = startObservation(
  "llm-call",
  {
    model: "claude-opus-4-20250514",
    input: [{ role: "user", content: "Hello" }],
  },
  { asType: "generation" }
);

// Make your LLM call here
const response = await anthropic.messages.create({ ... });

generation.update({
  output: response.content,
  usageDetails: {
    input: response.usage.input_tokens,
    output: response.usage.output_tokens,
  },
});
generation.end();
```

## Verifying the Setup

### 1. Check Services Are Running

```bash
docker compose ps
```

Expected services:
- `langfuse-web` (port 3000)
- `langfuse-worker` (port 3030)
- `langfuse-postgres`
- `langfuse-redis`
- `langfuse-clickhouse`
- `langfuse-minio`

### 2. Check Langfuse Health

```bash
curl http://localhost:3000/api/public/health
```

Expected: `{"status":"ok"}`

### 3. Send a Test Trace

Create a test script:

```typescript
// test-trace.ts
import "./instrumentation";
import { startActiveObservation } from "@langfuse/tracing";
import { LangfuseSpanProcessor } from "@langfuse/otel";

async function main() {
  await startActiveObservation("test-trace", async (span) => {
    span.update({
      input: { test: true },
      output: { success: true }
    });
  });

  // Flush to ensure trace is sent
  await LangfuseSpanProcessor.prototype.forceFlush();
  console.log("Test trace sent! Check http://localhost:3000");
}

main();
```

Run it:
```bash
npx tsx test-trace.ts
```

Then check the Langfuse dashboard at http://localhost:3000 - you should see the trace.

## Data Retention

Trace data is automatically deleted after 1 week to avoid excessive storage consumption. This is configured in Langfuse and does not require manual cleanup.

## Stopping the Infrastructure

```bash
docker compose down
```

To also remove volumes (all trace data):
```bash
docker compose down -v
```

## Troubleshooting

### Langfuse Not Starting

Check logs:
```bash
docker compose logs langfuse-web
docker compose logs langfuse-worker
```

Common issues:
- Port 3000 already in use: Stop other services or change port
- Database not ready: Wait for health checks to pass

### Traces Not Appearing

1. Verify environment variables are set correctly
2. Check that `forceFlush()` is called before process exit
3. Verify network connectivity to localhost:3000
4. Check browser console for CORS errors

### High Memory Usage

ClickHouse and MinIO can consume significant memory. For constrained environments:
```bash
# Reduce ClickHouse memory
docker update --memory=1g langfuse-clickhouse
```
