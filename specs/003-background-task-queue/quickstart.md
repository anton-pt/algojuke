# Quick Start Guide: Background Task Queue Infrastructure

**Feature**: Background Task Queue Infrastructure with Inngest
**Last Updated**: 2025-12-29

## Overview

This guide walks you through setting up and running the background task queue infrastructure for algojuke. You'll learn how to:
- Start the Inngest Dev Server locally with Docker
- Run the worker service that processes enrichment tasks
- Trigger enrichment workflows
- Monitor task execution in the Inngest dashboard
- Debug and test the system

## Prerequisites

Before starting, ensure you have:

- **Docker Desktop** installed and running
- **Node.js 20.x** or later
- **PostgreSQL** running (existing algojuke database)
- **Git** repository checked out on branch `003-background-task-queue`

## Architecture Refresher

```
Main App → Inngest (Docker) → Worker Service → External APIs
            ↓
     Built-in Dashboard
```

1. Main app sends events to Inngest
2. Inngest orchestrates durable execution
3. Worker service executes enrichment steps
4. Results saved to database
5. Monitor everything via Inngest UI

## Step 1: Environment Setup

### 1.1 Install Dependencies

```bash
# In repository root
cd /Users/anton/Source/algojuke

# Install worker service dependencies
cd services/worker
npm install

# Expected packages:
# - inngest (TypeScript SDK)
# - zod (schema validation)
# - express (HTTP server)
# - Other existing dependencies (typeorm, pg, etc.)
```

### 1.2 Configure Environment Variables

Create `.env` file in `services/worker/`:

```bash
# services/worker/.env

# Node environment
NODE_ENV=development

# Inngest configuration
INNGEST_DEV=1
INNGEST_BASE_URL=http://inngest:8288
INNGEST_SERVE_PATH=/api/inngest

# Database connection (use existing algojuke DB)
DATABASE_HOST=host.docker.internal
DATABASE_PORT=5432
DATABASE_NAME=algojuke
DATABASE_USER=your_user
DATABASE_PASSWORD=your_password

# External API keys (for enrichment services)
TIDAL_API_KEY=your_tidal_key
LYRICS_API_KEY=your_lyrics_key
OPENAI_API_KEY=your_openai_key  # For embeddings

# Worker configuration
WORKER_CONCURRENCY=10
WORKER_PORT=3001
```

**Note**: The worker service and main app share the same PostgreSQL database.

## Step 2: Start Services with Docker Compose

### 2.1 Start All Services

```bash
# From repository root
docker-compose up

# Services started:
# - inngest: Inngest Dev Server (port 8288)
# - worker: Background worker service (port 3001)
# - postgres: PostgreSQL (if not already running externally)
```

**Expected Output**:
```
inngest_1  | Inngest Dev Server v0.27.0 listening on :8288
inngest_1  | Discovering apps...
worker_1   | Worker service listening on :3001
worker_1   | Inngest functions registered: 1
worker_1   |  ✓ enrich-track
```

### 2.2 Verify Services

Open browser tabs:

1. **Inngest Dashboard**: http://localhost:8288
   - Should show "algojuke-worker" app discovered
   - Functions tab should list "enrich-track"

2. **Worker Health**: http://localhost:3001/health
   - Should return `{"status": "ok"}`

## Step 3: Trigger Your First Demo Task

**Note**: For this infrastructure-only feature, we trigger tasks directly from the Inngest UI. Backend integration will be added in a follow-up feature.

### 3.1 Send Demo Event (via Inngest UI)

1. Go to http://localhost:8288
2. Click **"Events"** in sidebar
3. Click **"Send Event"** button
4. Fill in event details:

```json
{
  "name": "demo/task.requested",
  "data": {
    "taskId": "550e8400-e29b-41d4-a716-446655440000",
    "priority": 0,
    "simulateFailure": false,
    "delayMs": 1000
  }
}
```

5. Click **"Send Event"**

**Available Options**:
- `taskId`: Unique UUID for this task
- `priority`: -600 to +600 (higher = executed sooner)
- `simulateFailure`: Set to `true` to test retry behavior
- `failAtStep`: Specify which step should fail (e.g., `"step-3-simulate-delay"`)
- `delayMs`: Delay duration in ms (default 1000, max 30000)

### 3.2 Monitor Execution

1. Click **"Functions"** in Inngest sidebar
2. Click on **"demo-task"** function
3. You'll see the new function run appear
4. Click on the run to view:
   - Waterfall trace of step execution
   - Step-by-step output
   - Timing information
   - Any errors

**Expected Steps**:
- ✅ step-1-initialize
- ✅ step-2-process
- ✅ step-3-simulate-delay
- ✅ step-4-simulate-api-call
- ✅ step-5-finalize

### 3.3 Test Retry Behavior

To validate the retry mechanism, send an event with simulated failure:

```json
{
  "name": "demo/task.requested",
  "data": {
    "taskId": "550e8400-e29b-41d4-a716-446655440001",
    "simulateFailure": true,
    "failAtStep": "step-4-simulate-api-call"
  }
}
```

Observe in the dashboard:
- Step 4 fails
- Inngest automatically retries with exponential backoff
- Other steps not re-executed (memoized)
- After max retries, task marked as failed

## Step 4: Development Workflow

### 4.1 Make Code Changes

When modifying enrichment logic:

```bash
# In services/worker/
npm run dev  # Starts with hot reload

# Or manually restart:
docker-compose restart worker
```

**Inngest automatically detects code changes** - no need to restart Dev Server.

### 4.2 Test Function Locally

```typescript
// services/worker/tests/functions/demoTask.test.ts
import { InngestTestEngine } from "@inngest/test";
import { demoTask } from "../../src/inngest/functions/demoTask";

describe("demoTask", () => {
  let testEngine: InngestTestEngine;

  beforeEach(() => {
    testEngine = new InngestTestEngine({
      function: demoTask,
    });
  });

  it("should complete demo task successfully", async () => {
    const { result } = await testEngine.execute({
      event: {
        name: "demo/task.requested",
        data: {
          taskId: "test-uuid",
          simulateFailure: false,
        },
      },
    });

    expect(result.success).toBe(true);
    expect(result.stepsCompleted).toBe(5);
  });

  it("should handle simulated failures", async () => {
    const { result, error } = await testEngine.execute({
      event: {
        name: "demo/task.requested",
        data: {
          taskId: "test-uuid",
          simulateFailure: true,
          failAtStep: "step-4-simulate-api-call",
        },
      },
    });

    expect(error).toBeDefined();
    expect(error.message).toContain("Simulated failure");
  });
});
```

Run tests:
```bash
npm test
```

### 4.3 Debug Failed Runs

If a function run fails:

1. **View Error in Dashboard**:
   - Click on failed run
   - See error message and stack trace
   - Identify which step failed

2. **Check Logs**:
   ```bash
   docker-compose logs worker
   # or
   docker logs algojuke-worker-1
   ```

3. **Replay Failed Run**:
   - In Inngest UI, click "Replay" button on failed run
   - Run executes again with same input
   - Useful after fixing bugs

## Step 5: Infrastructure Validation Scenarios

**Note**: All operations performed via Inngest UI for this infrastructure-only feature.

### 5.1 Test Idempotency

Send the same event twice:

```json
{
  "name": "demo/task.requested",
  "data": {
    "taskId": "idempotency-test-123",
    "priority": 0
  }
}
```

**Expected**: Second submission within 24 hours is deduplicated (won't execute)

To force execution: Add `"force": true`

### 5.2 Test Priority Queue

Send multiple tasks with different priorities:

```json
// Low priority (executes last)
{"name": "demo/task.requested", "data": {"taskId": "task-1", "priority": -300}}

// Normal priority
{"name": "demo/task.requested", "data": {"taskId": "task-2", "priority": 0}}

// High priority (executes first)
{"name": "demo/task.requested", "data": {"taskId": "task-3", "priority": 300}}
```

**Expected**: High priority task executes before others, even if submitted later

### 5.3 Test Concurrency Limits

Send 20 tasks rapidly (more than the 10 concurrent limit):

**Expected**:
- Max 10 tasks execute concurrently
- Remaining tasks queue until slots available
- Observable in Inngest metrics dashboard

### 5.4 Query Task Status (Optional)

If implementing query API:

```bash
# Get task status
curl http://localhost:3001/api/tasks/550e8400-e29b-41d4-a716-446655440000/status

# Response:
{
  "taskId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "stepsCompleted": 5,
  "durationMs": 5234
}
```

## Step 6: Monitoring & Observability

### 6.1 Inngest Dashboard Features

**Functions Tab**:
- View all registered functions
- See run counts, success rates
- Recent function executions

**Events Tab**:
- All events received by Inngest
- Which functions they triggered
- Event payload inspection

**Runs Tab**:
- Filter by status (Running, Completed, Failed)
- Filter by time range
- Search by run ID or event ID

**Metrics**:
- Throughput: Events/functions per second
- Backlog: Queued function runs
- Concurrency: Current concurrent executions
- Failure Rate: % of failed runs

### 6.2 Custom Monitoring (Optional)

Create a failure handler:

```typescript
// services/worker/src/inngest/functions/failureHandler.ts
export const failureHandler = inngest.createFunction(
  { id: "track-all-failures" },
  { event: "inngest/function.failed" },
  async ({ event, step }) => {
    await step.run("log-to-monitoring", async () => {
      // Send to your monitoring service (Datadog, Sentry, etc.)
      await monitoring.track({
        event: "function_failed",
        properties: {
          functionId: event.data.function_id,
          runId: event.data.run_id,
          error: event.data.error,
        },
      });
    });
  }
);
```

## Step 7: Production Deployment (Future)

For production deployment (not needed for local prototype):

### 7.1 Self-Hosting Inngest

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  inngest:
    image: inngest/inngest:v0.27.0
    command: inngest serve
    ports:
      - "8288:8288"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/inngest
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15
    volumes:
      - inngest-pg-data:/var/lib/postgresql/data

  redis:
    image: redis:7
    volumes:
      - inngest-redis-data:/data
```

### 7.2 Environment Variables for Production

```bash
# Production .env
NODE_ENV=production
INNGEST_EVENT_KEY=your_production_event_key
INNGEST_SIGNING_KEY=your_production_signing_key
INNGEST_BASE_URL=https://your-inngest-instance.com
```

## Troubleshooting

### Problem: Inngest can't discover worker app

**Solution**:
- Check worker is running: `docker ps`
- Check worker serves endpoint: `curl http://localhost:3001/api/inngest`
- Check Docker network: Worker and Inngest must be on same network
- Check Inngest logs: `docker logs algojuke-inngest-1`

### Problem: Steps are timing out

**Solution**:
- Check external API keys are valid
- Check network connectivity to external APIs
- Increase step timeout in function config:
  ```typescript
  export const enrichTrack = inngest.createFunction(
    {
      id: "enrich-track",
      retries: 5,
      // Add timeout configuration
    },
    // ...
  );
  ```

### Problem: Database connection errors

**Solution**:
- Verify DATABASE_URL in worker .env
- Check PostgreSQL is running: `docker ps | grep postgres`
- Test connection: `psql -h localhost -U your_user -d algojuke`
- Check TypeORM configuration in worker service

### Problem: Functions not retrying on failure

**Solution**:
- Verify `retries` config in function definition
- Check error type - NonRetriableError won't retry
- View retry count in Inngest dashboard
- Check RetryAfterError delay is reasonable

### Problem: Rate limits being exceeded

**Solution**:
- Add/adjust throttle configuration:
  ```typescript
  {
    id: "enrich-track",
    throttle: {
      limit: 100,      // Max 100 runs
      period: "1min",  // Per minute
      key: "event.data.tidalId", // Per API source
    }
  }
  ```

## Test Scripts

### test-observability.sh

**Purpose**: Automated script to validate dashboard observability features (US2)

**Location**: `services/worker/scripts/test-observability.sh`

**Usage**:
```bash
cd services/worker
./scripts/test-observability.sh
```

**Script Behavior**:
1. Sends 5 demo tasks with varied configurations:
   - Task 1: Successful execution (all steps pass)
   - Task 2: Simulated failure at step-2-process
   - Task 3: Simulated failure at step-4-simulate-api-call
   - Task 4: High priority (priority: 300)
   - Task 5: Low priority (priority: -300)
2. Outputs task IDs for manual dashboard inspection
3. Waits 5 seconds between submissions for readability

**Expected Outcomes**:
- All 5 events visible in Inngest Events tab
- Tasks 1, 4, 5 show Completed status
- Tasks 2, 3 show Failed status after retries exhausted
- Priority tasks execute in correct order (4 before 1 before 5)

**Validation Checklist** (manual after script runs):
- [ ] Navigate to http://localhost:8288/functions/demo-task
- [ ] Verify 5 function runs appear
- [ ] Click on failed run → see error message and failed step
- [ ] Click on successful run → see all step outputs and waterfall trace
- [ ] Verify retry attempts visible for failed runs

---

### test-rate-limits.sh

**Purpose**: Automated script to validate throttle configuration (US3)

**Location**: `services/worker/scripts/test-rate-limits.sh`

**Usage**:
```bash
cd services/worker
./scripts/test-rate-limits.sh
```

**Script Behavior**:
1. Sends 30 demo tasks rapidly (within 1 second)
2. All tasks have default priority
3. Outputs submission timestamps and task IDs

**Expected Outcomes**:
- All 30 events accepted (queued)
- Only ~10 tasks execute concurrently (per concurrency config)
- Throttle configuration limits execution rate to configured limit
- Remaining tasks queue until capacity available
- Dashboard metrics show queue depth increasing then decreasing

**Validation Checklist** (manual after script runs):
- [ ] Navigate to http://localhost:8288/functions/demo-task
- [ ] View Metrics tab
- [ ] Verify execution rate respects throttle limit (e.g., 100/min)
- [ ] Verify max concurrent executions stays at 10
- [ ] Verify all 30 tasks eventually complete (no tasks lost)

---

## Next Steps

Once you've completed this quickstart:

1. **Implement Enrichment Services**: Fill in the actual metadata fetching logic in `services/worker/src/services/`

2. **Add Tests**: Write contract tests for each enrichment step using `@inngest/test`

3. **Integrate with Main App**: Update main app to send enrichment events when tracks are added

4. **Monitor Performance**: Track success rates, completion times, and failure patterns

5. **Optimize**: Adjust concurrency, retry policies, and rate limits based on actual usage

## Resources

- **Inngest Dashboard**: http://localhost:8288
- **Worker Service**: http://localhost:3001
- **Inngest Documentation**: https://www.inngest.com/docs
- **Project Plan**: [plan.md](./plan.md)
- **Data Model**: [data-model.md](./data-model.md)
- **Event Schemas**: [contracts/events.ts](./contracts/events.ts)

## Support

For questions or issues:
1. Check Inngest dashboard for detailed error messages
2. Review worker logs: `docker-compose logs worker`
3. Consult [research.md](./research.md) for Inngest patterns
4. Refer to [plan.md](./plan.md) for architecture decisions

---

**Happy Enriching! 🎵**
