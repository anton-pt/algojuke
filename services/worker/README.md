# Background Task Queue Worker Service

Infrastructure validation service for durable background task processing using [Inngest](https://www.inngest.com/).

## Overview

The worker service demonstrates Inngest's core infrastructure capabilities:

- **Multi-step workflows**: Break long-running tasks into individual steps
- **Durable execution**: Automatic step memoization - successful steps never re-execute on retry
- **Automatic retries**: Configurable retry behavior with exponential backoff
- **Rate limiting**: Throttle execution to prevent overwhelming downstream services
- **Observability**: Real-time visibility into task execution via Inngest Dashboard

## Quick Start

### Prerequisites

- Node.js 20.x or higher
- Docker and Docker Compose (for Inngest Dev Server)
- Running PostgreSQL instance (via `docker compose up db`)

### Installation

```bash
cd services/worker
npm install
```

### Running the Service

1. **Start Inngest Dev Server** (if not already running):

   ```bash
   # From repository root
   docker compose up inngest -d
   ```

   The Inngest dashboard will be available at http://localhost:8288

2. **Start the Worker Service**:

   ```bash
   npm run dev
   ```

   The worker will:
   - Start an Express server on port 3001
   - Serve Inngest functions at http://localhost:3001/api/inngest
   - Register all functions with the Inngest Dev Server
   - Display registered functions in the console

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run type-check
```

## Demo Task

The `demo-task` function validates all infrastructure capabilities without implementing actual business logic.

### Triggering the Demo Task

**Via Inngest Dashboard** (Recommended):

1. Open http://localhost:8288
2. Navigate to "Functions" → "demo-task"
3. Click "Invoke Function"
4. Submit an event with payload:

   ```json
   {
     "name": "demo/task.requested",
     "data": {
       "taskId": "test-uuid-123",
       "simulateFailure": false,
       "delayMs": 1000
     }
   }
   ```

**Via curl**:

```bash
curl -X POST http://localhost:8288/e/algojuke-worker \
  -H "Content-Type: application/json" \
  -d '{
    "name": "demo/task.requested",
    "data": {
      "taskId": "test-uuid-456",
      "simulateFailure": false,
      "delayMs": 1000
    }
  }'
```

### Event Payload Options

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `taskId` | string | Yes | Unique identifier for idempotency |
| `simulateFailure` | boolean | No | Trigger simulated failure (default: false) |
| `failAtStep` | string | No | Which step to fail at: "step-1-initialize", "step-2-process", "step-3-simulate-delay", "step-4-simulate-api-call", "step-5-finalize" |
| `delayMs` | number | No | Delay duration in milliseconds (default: 1000) |
| `priority` | number | No | Execution priority: -600 to 600 (default: 0, higher = earlier execution) |
| `force` | boolean | No | Override idempotency and force re-execution (default: false) |

### Infrastructure Features

#### 1. Multi-Step Workflow

The demo task executes 5 sequential steps:

1. **Initialize**: Set up task state
2. **Process**: Simulate data processing
3. **Simulate Delay**: Wait for configurable duration
4. **Simulate API Call**: Mock external service interaction
5. **Finalize**: Complete task and return results

Each step is independently tracked and can be inspected in the dashboard.

#### 2. Durable Execution & Step Memoization

- Successful steps are **automatically memoized**
- If a step fails, only that step and subsequent steps re-execute on retry
- Previously successful steps **never re-execute**
- This prevents duplicate side effects and improves performance

**Example**:
- Initial run: Steps 1, 2, 3 succeed → Step 4 fails
- Retry 1: Steps 1, 2, 3 **skipped** (memoized) → Step 4 retries → Step 5 executes
- Result: Steps 1-3 execute once, Step 4 retries until success

#### 3. Automatic Retries

Configuration:
- **Max retries**: 5 attempts
- **Backoff strategy**: Exponential with jitter
- **Retry delays**: ~1s, ~2s, ~4s, ~8s, ~16s

To test retry behavior:

```bash
curl -X POST http://localhost:8288/e/algojuke-worker \
  -H "Content-Type: application/json" \
  -d '{
    "name": "demo/task.requested",
    "data": {
      "taskId": "retry-test-123",
      "simulateFailure": true,
      "failAtStep": "step-4-simulate-api-call"
    }
  }'
```

Observe in the dashboard:
- Initial execution fails at step 4
- Automatic retries with increasing delays
- Waterfall view shows all retry attempts
- Steps 1-3 are memoized and don't re-execute

#### 4. Rate Limiting

Configuration:
- **Throttle limit**: 20 executions per 60 seconds (global across all invocations)
- **Concurrency limit**: 10 simultaneous executions
- **Idempotency window**: 24 hours (by `taskId`)

**Throttle Modes:**
- **Global throttling** (current): `throttle: { limit: 20, period: "60s" }` - applies across all function invocations
- **Per-key throttling**: `throttle: { limit: 20, period: "60s", key: "event.data.userId" }` - separate limit per unique key value (e.g., per user)

The demo task uses **global throttling** to limit total function executions regardless of which user or task triggered them.

To test rate limiting:

```bash
# Send 200 tasks rapidly to observe throttling
./scripts/test-rate-limits.sh
```

Expected behavior:
- Max 10 tasks execute simultaneously (concurrency limit)
- Max 20 tasks start per 60s window (throttle limit)
- Additional tasks are queued until next time window
- Dashboard shows throttled/queued tasks

#### 5. Observability Dashboard

The Inngest dashboard provides real-time visibility:

1. **Function Runs View**:
   - All executions listed with status (completed, failed, running)
   - Filter by status, time range, event name
   - Sort by priority, execution time

2. **Run Details**:
   - Waterfall trace of all steps
   - Step-by-step execution timeline
   - Input/output data for each step
   - Error messages and stack traces
   - Retry history

3. **Manual Retry**:
   - Click "Replay" on any run to re-execute with same payload
   - Override idempotency for testing

4. **History Retention** (FR-006):
   - **Development (Inngest Dev Server)**: Run history stored in-memory for current session only
   - **Production (Inngest Cloud)**: Retention period varies by plan tier:
     - Hobby tier: 7 days
     - Pro tier: 30 days
     - Enterprise tier: Custom retention periods available
   - History includes completed, failed, and cancelled runs with full execution details
   - For this infrastructure validation feature, 30-day retention is specified in FR-006
   - Production deployment would use Inngest Cloud Pro tier or higher
   - See: [Inngest Event History Documentation](https://www.inngest.com/docs/platform/monitor/event-history)

## Validation Scripts

### Observability Dashboard Validation

Tests dashboard visibility, filtering, and inspection:

```bash
./scripts/test-observability.sh
```

Sends 5 demo tasks:
- 1 successful task
- 2 failed tasks (at different steps)
- 1 high-priority task
- 1 low-priority task

Follow the script output for manual validation checklist.

### Rate Limiting Validation

Tests throttle and concurrency limits:

```bash
./scripts/test-rate-limits.sh
```

Sends 30 tasks rapidly to validate:
- Concurrency limit (max 10 simultaneous)
- Throttle limit (20 executions per 60 seconds)
- Queue behavior

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Client Application                     │
│              (Not implemented in this phase)                  │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ (Future: Trigger background tasks)
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                    Inngest Dev Server                         │
│                    (localhost:8288)                           │
│  - Event router                                               │
│  - Execution engine                                           │
│  - Observability dashboard                                    │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ Function registration & execution
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                    Worker Service                             │
│                    (localhost:3001)                           │
│  - Express HTTP server                                        │
│  - Inngest function handler (/api/inngest)                    │
│  - Registered functions:                                      │
│    • demo-task (Infrastructure validation)                    │
└───────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
services/worker/
├── src/
│   ├── inngest/
│   │   ├── client.ts           # Inngest client initialization
│   │   ├── events.ts           # Event type definitions (Zod schemas)
│   │   └── functions/
│   │       ├── demoTask.ts     # Demo task implementation
│   │       └── index.ts        # Function registry
│   └── server.ts               # Express server entry point
├── tests/
│   └── functions/
│       └── demoTask.test.ts    # Demo task unit tests
├── scripts/
│   ├── test-observability.sh   # Observability validation script
│   └── test-rate-limits.sh     # Rate limiting validation script
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md                    # This file
```

## Configuration

### Environment Variables

Create a `.env` file in `services/worker/`:

```bash
# Port for the worker HTTP server
PORT=3001

# Inngest configuration
INNGEST_EVENT_KEY=           # Optional: Event key for Inngest Cloud
INNGEST_SIGNING_KEY=         # Optional: Signing key for production
INNGEST_DEV=true             # Enable dev mode (default: true in development)

# Inngest Dev Server URL (for local development)
INNGEST_URL=http://localhost:8288
```

For local development with Inngest Dev Server, no keys are required.

### Docker Compose Integration

The worker service is configured to run **outside Docker** for simpler DX. The docker-compose.yml includes:

- `inngest`: Inngest Dev Server (http://localhost:8288)
- `db`: PostgreSQL database (http://localhost:5432)

The worker connects to these services via localhost.

## Development

### Adding New Functions

1. **Define event schema** in `src/inngest/events.ts`:

   ```typescript
   import { z } from "zod";

   const myEventSchema = z.object({
     name: z.literal("my/event.triggered"),
     data: z.object({
       eventId: z.string(),
       // ... other fields
     }),
   });

   export const schemas = new EventSchemas().fromZod([
     demoTaskSchema,
     myEventSchema, // Add your schema
   ]);
   ```

2. **Create function** in `src/inngest/functions/`:

   ```typescript
   import { inngest } from "../client.js";

   export const myFunction = inngest.createFunction(
     {
       id: "my-function",
       name: "My Function",
       retries: 3,
     },
     { event: "my/event.triggered" },
     async ({ event, step }) => {
       // Implementation
     }
   );
   ```

3. **Register function** in `src/inngest/functions/index.ts`:

   ```typescript
   import { myFunction } from "./myFunction.js";

   export const functions = [demoTask, myFunction];
   ```

4. **Add tests** in `tests/functions/`:

   ```typescript
   import { describe, it, expect } from "vitest";
   import { myFunction } from "../../src/inngest/functions/myFunction.js";

   describe("myFunction", () => {
     it("should export function", () => {
       expect(myFunction).toBeDefined();
     });
   });
   ```

### Testing Strategies

1. **Unit Tests** (`npm test`):
   - Validate function exports and structure
   - Fast feedback during development
   - No external dependencies

2. **Integration Tests** (Manual via dashboard):
   - Validate full execution flow
   - Test retries, memoization, throttling
   - Verify observability features

3. **Validation Scripts**:
   - `test-observability.sh`: Dashboard features
   - `test-rate-limits.sh`: Throttle behavior

## Troubleshooting

### Worker won't start

**Error**: `Port 3001 already in use`

**Solution**:
```bash
# Find process using port 3001
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3002 npm run dev
```

### Inngest Dev Server not reachable

**Error**: `❌ Inngest Dev Server not reachable at http://localhost:8288`

**Solution**:
```bash
# Check if Inngest is running
docker compose ps inngest

# Start Inngest
docker compose up inngest -d

# Check logs
docker compose logs inngest
```

### Functions not appearing in dashboard

**Issue**: Dashboard shows no functions registered

**Solution**:
1. Ensure worker service is running (`npm run dev`)
2. Check worker console for "Registered functions" confirmation
3. Refresh the Inngest dashboard (http://localhost:8288)
4. Check worker logs for connection errors

### Tests failing with "401 Event key not found"

**Issue**: Old test code attempting to connect to Inngest API

**Solution**: Tests have been simplified to unit tests that don't require Inngest runtime. Run `npm test` to verify current tests pass.

## Next Steps

This infrastructure validation establishes the foundation for:

1. **Track Enrichment Tasks** (Future):
   - Fetch track metadata from Tidal API
   - Analyze lyrics for emotional content
   - Generate playlist narratives

2. **Backend Integration** (Future):
   - GraphQL mutations to trigger tasks
   - Task status queries
   - Real-time progress updates via subscriptions

3. **Production Deployment** (Future):
   - Inngest Cloud integration
   - Event key and signing key configuration
   - Horizontal scaling of worker instances

## Resources

- [Inngest Documentation](https://www.inngest.com/docs)
- [Inngest Dev Server](https://www.inngest.com/docs/local-development)
- [Step Functions Guide](https://www.inngest.com/docs/functions/multi-step)
- [Retries & Error Handling](https://www.inngest.com/docs/functions/retries)
- [Rate Limiting](https://www.inngest.com/docs/functions/throttling)
