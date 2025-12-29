# Inngest Background Task Queue Infrastructure - Comprehensive Research

**Research Date:** 2025-12-29
**Target:** Implementing background task queue infrastructure for algojuke project
**Technology:** Inngest (www.inngest.com)

---

## Executive Summary

Inngest is a durable execution platform that replaces traditional task queues with event-driven, stateful functions that run anywhere (serverless, servers, or edge). It provides step-based workflows with automatic retries, state persistence, and built-in observability through a comprehensive UI dashboard.

**Key Strengths for Requirements:**
- ✅ Built-in multi-step pipelines with independent step retry (FR-002, FR-003)
- ✅ Exponential backoff and configurable retry policies (FR-004, FR-005)
- ✅ Native scheduled/delayed execution via step.sleep and cron (FR-011)
- ✅ Flow control features: rate limiting, throttling, concurrency (FR-008, FR-009, FR-018)
- ✅ Task deduplication and idempotency support (FR-014)
- ✅ Priority queue capabilities (FR-013)
- ✅ Comprehensive UI for monitoring and manual replay (FR-016)
- ✅ TypeScript-first SDK with excellent type safety
- ✅ Local development with Docker support
- ✅ REST/GraphQL API for task queries (FR-007)

---

## 1. Core Concepts & Architecture

### 1.1 Durable Execution

Inngest implements **durable functions** (also called "durable workflows") that replace traditional queues, state management, and scheduling. Key characteristics:

- **Automatic retry**: Functions throw errors/exceptions and automatically retry, resuming from the point of failure
- **Long-running and stateful**: Functions persist state across invocations and retries
- **Step-based execution**: Each step is a unit of work that can be run and retried independently
- **Memoization**: Successfully executed steps are memoized and won't re-execute

**Architecture:**
```
Event API (HTTPS) → Durable Execution Engine → Your Functions (HTTP)
                         ↓
                  State Store (Database)
                         ↓
                  Queue System (Redis/Internal)
```

### 1.2 How Functions Execute

Functions execute **incrementally, step by step**:

1. Function receives an event trigger
2. Each step executes as a separate HTTP request to your application
3. Step results are returned to Inngest and persisted in managed state store
4. Successfully executed steps are memoized
5. Function resumes, skipping completed steps
6. SDK injects previous step data into the function

**Critical Rule:** Any non-deterministic logic (DB calls, API calls) MUST be placed within `step.run()` to ensure correct execution.

### 1.3 State Management Between Steps

**State Persistence Mechanism:**
- Step results are persisted in Inngest's managed function state store
- Each step's ID is hashed as the state identifier for future executions
- Step index is included in the result for ordering
- Memoized state allows functions to resume exactly where they left off
- State store includes: triggering event(s), step output, step errors

**Storage Architecture:**
- **State Store (Database)**: Persists data for pending/ongoing function runs
- **Main Database**: Persists system data and history (Apps, Functions, Events, Function run results)
- **Self-hosting**: Uses PostgreSQL for persistent storage, Redis for queue management
- **Size Limits**: Total data returned from all steps must be under 4MB

---

## 2. Key Features Mapped to Functional Requirements

### 2.1 Multi-Step Pipelines with Independent Step Retry (FR-002, FR-003)

**Implementation:**
```typescript
export default inngest.createFunction(
  { id: "import-product-images" },
  { event: "shop/product.imported" },
  async ({ event, step }) => {
    // Step 1: Independent retry
    const uploadedImageURLs = await step.run("copy-images-to-s3", async () => {
      return copyAllImagesToS3(event.data.imageURLs);
    });

    // Step 2: Independent retry
    const metadata = await step.run("extract-metadata", async () => {
      return extractImageMetadata(uploadedImageURLs);
    });

    // Step 3: Independent retry
    await step.run("update-database", async () => {
      return db.updateProduct(event.data.productId, { images: uploadedImageURLs, metadata });
    });

    return { success: true, images: uploadedImageURLs.length };
  }
);
```

**Key Features:**
- Each `step.run()` has its own independent retry counter
- Failing steps can be retried and recovered independently
- Successful steps are never re-executed
- No need to re-execute previous successful steps

### 2.2 Exponential Backoff and Retry Policies (FR-004, FR-005)

**Default Behavior:**
- Retries executed with **exponential backoff with jitter**
- Default: 4 retries (5 total attempts including initial)
- Each step has independent retry counter

**Configuration:**
```typescript
export default inngest.createFunction(
  {
    id: "process-payment",
    retries: 10  // Each step will be attempted up to 11 times (1 initial + 10 retries)
  },
  { event: "payment/initiated" },
  async ({ event, step }) => {
    // Function logic
  }
);

// Setting to 0 disables retries
{ retries: 0 }
```

**Custom Retry Timing with RetryAfterError:**
```typescript
import { RetryAfterError } from "inngest";

await step.run("call-rate-limited-api", async () => {
  try {
    return await externalAPI.call();
  } catch (err) {
    if (err.statusCode === 429) {
      // Retry after 60 seconds to handle rate limiting
      throw new RetryAfterError("Rate limited", "60s");
    }
    throw err;
  }
});
```

**Non-Retriable Errors:**
```typescript
import { NonRetriableError } from "inngest";

await step.run("validate-input", async () => {
  if (!event.data.email) {
    // Don't retry invalid input
    throw new NonRetriableError("Email is required");
  }
  return processEmail(event.data.email);
});
```

### 2.3 Scheduled/Delayed Execution (FR-011)

**Sleep (Delay Execution):**
```typescript
export default inngest.createFunction(
  { id: "send-delayed-email" },
  { event: "app/user.signup" },
  async ({ event, step }) => {
    // Wait 2 days before executing next step
    await step.sleep("wait-a-couple-of-days", "2d");

    await step.run("send-followup-email", async () => {
      return await email.send("followup", event.data.email);
    });
  }
);
```

**Sleep Until (Specific Time):**
```typescript
await step.sleepUntil("wait-until-midnight", new Date("2025-01-01T00:00:00Z"));
```

**Cron Schedules:**
```typescript
export default inngest.createFunction(
  { id: "weekly-report" },
  { cron: "0 9 * * MON" },  // Every Monday at 9 AM
  async ({ step }) => {
    await step.run("generate-report", async () => {
      return generateWeeklyReport();
    });
  }
);
```

**Key Benefits:**
- Functions don't need to be running during sleep interval
- Works in serverless environments
- Sleeping functions don't count against concurrency limits
- Time strings compatible with `ms` package: "30m", "3 hours", "2.5d"

### 2.4 Rate Limiting & Concurrency Control (FR-008, FR-009, FR-018)

**Throttling (Smooth Spikes):**
```typescript
export default inngest.createFunction(
  {
    id: "sync-systems",
    throttle: {
      limit: 3,           // 3 runs per period
      period: "1min",     // Within 1 minute window
      burst: 5,           // Allow burst of 5 runs
      key: "event.data.user_id"  // Per-user throttling
    }
  },
  { event: "system/sync.requested" },
  async ({ event, step }) => {
    // Function logic
  }
);
```

**Throttling Algorithm:** Uses Generic Cell Rate Algorithm (GCRA)
- If capacity available: function starts immediately
- If no capacity: function delayed until capacity available
- Delays function runs to smooth spikes (non-lossy)

**Rate Limiting (Hard Limits):**
```typescript
export default inngest.createFunction(
  {
    id: "send-notification",
    rateLimit: {
      limit: 10,
      period: "1h",
      key: "event.data.customer_id"
    }
  },
  { event: "notification/send" },
  async ({ event, step }) => {
    // Function logic
  }
);
```

**Rate Limiting vs Throttling:**
- **Rate Limiting**: Lossy, provides hard limits, executes first event
- **Throttling**: Non-lossy, delays runs until capacity, smooths spikes

**Concurrency Control:**
```typescript
export default inngest.createFunction(
  {
    id: "process-video",
    concurrency: {
      limit: 5,  // Max 5 concurrent executions
      key: "event.data.user_id"  // Per-user concurrency
    }
  },
  { event: "video/upload" },
  async ({ event, step }) => {
    // Function logic
  }
);
```

### 2.5 Task Deduplication/Idempotency (FR-014)

**Idempotency Configuration:**
```typescript
export default inngest.createFunction(
  {
    id: "process-payment",
    idempotency: "event.data.payment_id"  // CEL expression
  },
  { event: "payment/initiated" },
  async ({ event, step }) => {
    // This function will only execute once per payment_id within 24 hours
  }
);
```

**Deduplication Behavior:**
- Each unique expression generates a unique string key
- Prevents duplicate execution for 24 hour period
- After 24 hours, same key can trigger new execution
- ID is global across all event types

**Best Practice:** Use unique identifiers that won't be shared across different event types

### 2.6 Priority Queues (FR-013)

**Priority Configuration:**
```typescript
export default inngest.createFunction(
  {
    id: "process-order",
    priority: {
      run: "event.data.subscription_tier == 'premium' ? 600 : 0"  // CEL expression
    }
  },
  { event: "order/created" },
  async ({ event, step }) => {
    // Premium users processed first
  }
);
```

**Priority Range:**
- **Highest priority**: 600 (seconds ahead)
- **Default priority**: 0 (current time)
- **Lowest priority**: -600 (seconds behind)

**Use Cases:**
- Prioritize paid vs free users
- Ensure critical work executes before other work
- Improve onboarding experience with higher priority

**How It Works:**
- Functions scheduled in priority queue based on time they should run
- Priority expression evaluated for each new function run
- Expression returns factor in seconds (positive or negative)
- Adjusts when function should be executed

### 2.7 Debouncing

**Debounce Configuration:**
```typescript
export default inngest.createFunction(
  {
    id: "process-user-updates",
    debounce: {
      key: "event.data.account_id",
      period: "5m",  // Wait 5 minutes after last event
      timeout: "1h"  // Maximum debounce duration
    }
  },
  { event: "user/profile.updated" },
  async ({ event, step }) => {
    // Only runs after 5m of no new events for this account_id
    // Uses the LAST event as input data
  }
);
```

**Debounce Behavior:**
- Delays function run for given period
- Reschedules if new events received while debounce active
- Runs after period passes with no new events
- Uses **last event** as input data
- Min period: 1 second, Max period: 7 days

**Use Cases:**
- Prevent wasted work from rapidly changing user input
- Delay processing of noisy webhook events
- Batch updates for frequently modified resources

### 2.8 Event Batching

**Batch Configuration:**
```typescript
export default inngest.createFunction(
  {
    id: "record-api-calls",
    batchEvents: {
      maxSize: 100,      // Max events per batch
      timeout: "5s",     // Max wait time
      key: "event.data.customer_id"  // Per-customer batching
    }
  },
  { event: "log/api.call" },
  async ({ events, step }) => {  // Note: 'events' array, not 'event'
    const attrs = events.map(evt => ({
      user_id: evt.data.user_id,
      endpoint: evt.data.endpoint,
      timestamp: toDateTime(evt.ts)
    }));

    const result = await step.run("record data to DB", async () => {
      return db.bulkWrite(attrs);
    });

    return { success: true, recorded: result.length };
  }
);
```

**Batch Limits:**
- **Maximum batch size**: 100 events
- **Maximum batch data**: 10 MiB (enforced for system safety)
- Batch executes early if size/data limits exceeded

**Use Cases:**
- Reduce requests to external APIs with batch support
- Create batch database writes
- Improve performance and reduce serverless costs

---

## 3. Local Development Setup

### 3.1 Running Inngest Dev Server

**Method 1: NPX (Simplest):**
```bash
npx inngest-cli@latest dev
```

**Method 2: Docker Container:**
```bash
docker run -p 8288:8288 inngest/inngest:latest inngest dev -u http://host.docker.internal:3000/api/inngest
```

**Method 3: Docker Compose (Recommended for Multi-Service):**
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - INNGEST_DEV=1
      - INNGEST_BASE_URL=http://inngest:8288
    depends_on:
      - inngest

  inngest:
    image: inngest/inngest:v0.27.0
    ports:
      - "8288:8288"
    command: inngest dev -u http://app:3000/api/inngest
```

**Access Dev Server:**
- URL: http://localhost:8288
- Provides full feature parity with production
- Auto-discovery of apps on common ports
- No need for valid event keys in development

### 3.2 TypeScript SDK Setup

**Installation:**
```bash
npm install inngest
# or
yarn add inngest
# or
pnpm add inngest
```

**Basic Configuration:**
```typescript
// src/inngest/client.ts
import { Inngest, EventSchemas } from "inngest";

type Events = {
  "user/signup": {
    data: {
      email: string;
      name: string;
    };
  };
  "order/created": {
    data: {
      orderId: string;
      amount: number;
      customerId: string;
    };
  };
};

export const inngest = new Inngest({
  id: "algojuke",
  schemas: new EventSchemas().fromRecord<Events>(),
});
```

**With Zod Schema Validation:**
```typescript
import { Inngest, EventSchemas } from "inngest";
import { z } from "zod";

export const inngest = new Inngest({
  id: "algojuke",
  schemas: new EventSchemas().fromZod({
    "order/created": {
      data: z.object({
        orderId: z.string().uuid(),
        amount: z.number().positive(),
        customerId: z.string(),
      }),
    },
  }),
});
```

**Environment Variables:**
```bash
# Development
INNGEST_DEV=1
INNGEST_BASE_URL=http://localhost:8288

# Production
INNGEST_EVENT_KEY=your_event_key
INNGEST_SIGNING_KEY=your_signing_key
```

**SDK Modes:**
- **Dev Mode**: Auto-detected via `NODE_ENV=development` or `INNGEST_DEV=1`
- **Cloud Mode**: Auto-detected in production environments
- Can force mode with `isDev` option in client config

### 3.3 Creating Functions

**Define a Function:**
```typescript
// src/inngest/functions/processOrder.ts
import { inngest } from "../client";

export const processOrder = inngest.createFunction(
  { id: "process-order" },
  { event: "order/created" },
  async ({ event, step }) => {
    const payment = await step.run("process-payment", async () => {
      return await processPayment(event.data.orderId);
    });

    await step.run("send-confirmation", async () => {
      return await sendEmail(event.data.customerId, payment);
    });

    return { success: true, paymentId: payment.id };
  }
);
```

**Serve Functions (Next.js Example):**
```typescript
// app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { processOrder } from "@/inngest/functions/processOrder";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processOrder,
    // ... other functions
  ],
});
```

**Other Framework Adapters Available:**
- Express
- Remix
- Cloudflare Pages
- Nuxt
- Fresh (Deno)
- Redwood
- Custom HTTP handler

### 3.4 Development Workflow

**1. Start Dev Server:**
```bash
npx inngest-cli@latest dev
```

**2. Start Your Application:**
```bash
npm run dev
```

**3. Access Dev Server UI:**
- Navigate to http://localhost:8288
- View registered functions
- See event logs
- Monitor function runs
- Test functions manually

**4. Send Test Events:**
```typescript
// In your application code
await inngest.send({
  name: "order/created",
  data: {
    orderId: "123",
    amount: 99.99,
    customerId: "user_456"
  }
});
```

**5. Debug:**
- View real-time logs in Dev Server UI
- Inspect step-by-step execution
- See exact error messages
- Replay failed runs

---

## 4. Observability & Monitoring

### 4.1 Built-in UI Dashboard

**Key Features:**
- **Function Dashboard**: View all registered functions, their configurations, and status
- **Event Logs**: Track all events received, with linked function runs and raw event data
- **Function Runs**: Detailed view of each function execution
- **Waterfall Trace View**: Dynamic visualization inspired by OpenTelemetry tracing
- **Live Metrics**: Real-time throughput, concurrency, failure rates

### 4.2 Function Run History and Logs

**Run Details Include:**
- Complete execution timeline
- Step-by-step breakdown
- Input arguments for each step
- Output data from each step
- Error messages and stack traces
- Timing information
- State at each checkpoint

**Filtering Capabilities:**
- Filter by status (Running, Completed, Failed, Cancelled)
- Filter by time range (Queued or Started at)
- Filter by application
- Search by run ID or event ID

### 4.3 Metrics and Monitoring

**Available Metrics:**
- **Throughput**: Event rate over time, function execution rate
- **Backlog**: Number of queued function runs
- **Concurrency**: Current concurrent executions, concurrency limit hits
- **Failure Rates**: Failed runs over time
- **SDK Requests**: Throughput of SDK requests
- **Throttling**: When throttle/rate limits are hit
- **Usage Analytics**: Overall system usage trends

**Metrics Dashboard Features:**
- Holistic top-down monitoring
- Per-function dashboards
- Correlation between metrics (e.g., concurrency limits and throttling)
- Historical data visualization

### 4.4 Manual Replay/Retry Functionality (FR-016)

**Replay from Function Dashboard:**
1. Navigate to function dashboard
2. Click "Replay" in "All actions" menu
3. Configure replay:
   - **Name**: Description of replay
   - **Time Range**: Select period to replay
   - **Status Filter**: Target specific statuses (e.g., "Failed")
   - **Multiple Statuses**: Can select multiple (e.g., Failed + Succeeded)

**Replay Process:**
- Runs spread out over time to avoid overwhelming application
- Progress visible on replay page
- Takes seconds to minutes depending on run count

**Individual Run Replay:**
- From function run details page
- Click replay button
- Option to send trigger event to local dev server
- Full context available for reproduction

**Replay Use Cases:**
- Recover from failures after bug fixes
- Re-process data after logic changes
- Handle transient infrastructure issues
- Test fixes before broader rollout

### 4.5 Inngest Insights (Query Feature)

**Beta Feature for Querying Data:**
- Eliminate need for custom metrics and log grepping
- Query function runs and events programmatically
- Useful for:
  - **Debugging**: "What happened?" without grepping logs
  - **Iteration**: Measure impact of code changes
  - **Product Analytics**: Track usage trends from Inngest data

### 4.6 External Integrations

**Failure Handler for External Tools:**
```typescript
export const trackFailures = inngest.createFunction(
  { id: "track-all-failures" },
  { event: "inngest/function.failed" },  // System event
  async ({ event, step }) => {
    // Send to Datadog, Sentry, etc.
    await step.run("send-to-datadog", async () => {
      return await datadog.sendMetric({
        metric: "inngest.function.failed",
        value: 1,
        tags: [`function:${event.data.function_id}`]
      });
    });
  }
);
```

---

## 5. Data Persistence

### 5.1 How Inngest Persists Function State

**State Storage Components:**

1. **State Store (Database)**:
   - Persists data for pending and ongoing function runs
   - Stores: initial triggering event(s), step output, step errors
   - Managed by Inngest platform

2. **Main Database**:
   - Persists system data and history
   - Contains: Apps, Functions, Events, Function run results
   - Provides observability and recovery capabilities

3. **Queue System**:
   - Manages function run scheduling
   - Implements priority queue
   - Handles flow control (throttling, rate limiting, etc.)

**For Self-Hosting:**
- **PostgreSQL**: External persistent storage (production)
- **Redis**: Queue and state management
- **SQLite**: Default database for dev (`.inngest/main.db`)
- Queue and state snapshots periodically saved to SQLite

### 5.2 Intermediate Result Storage Between Steps

**Memoization Process:**

1. **Step Execution**:
   - Step executes and returns result
   - Result sent back to Inngest
   - Step ID is hashed as state identifier
   - Step index included for ordering

2. **State Persistence**:
   - Result persisted in function state store
   - Successfully executed steps are memoized
   - Step won't re-run if already completed

3. **Function Resume**:
   - Function resumes after each step
   - SDK checks for memoized state
   - Skips completed steps
   - Injects previous step data into function

**Example:**
```typescript
async ({ event, step }) => {
  // Step 1: Result stored
  const user = await step.run("fetch-user", async () => {
    return db.getUser(event.data.userId);
  });

  // Step 2: Can access 'user' from step 1
  const orders = await step.run("fetch-orders", async () => {
    return db.getOrders(user.id);  // Uses memoized 'user' data
  });

  // Step 3: Can access both 'user' and 'orders'
  await step.run("send-summary", async () => {
    return sendEmail(user.email, { orders });
  });
}
```

### 5.3 Task History Retention

**Note:** Specific retention period not explicitly documented in search results. Based on industry standards and the architecture described:

- Function run history persisted in main database
- State store maintains data for ongoing runs
- Completed runs available in dashboard for historical analysis
- Event logs provide precise information with linked runs

**Recommendation:** Verify specific retention periods with Inngest documentation or support for production planning.

### 5.4 Storage Limits

**Known Limits:**
- **Step State Size**: Total data from all steps must be under **4MB**
- **Batch Size**: Maximum **10 MiB** for batched events
- **Batch Count**: Maximum **100 events** per batch

**Best Practices:**
- Store references (IDs, URLs) rather than large payloads
- Use external storage (S3, etc.) for large data
- Return minimal necessary data from steps
- Consider step data accumulation over long-running workflows

---

## 6. TypeScript SDK Deep Dive

### 6.1 Function Definition Patterns

**Basic Function:**
```typescript
export const myFunction = inngest.createFunction(
  { id: "unique-function-id" },
  { event: "app/event.name" },
  async ({ event, step }) => {
    // Function logic
  }
);
```

**Multiple Event Triggers:**
```typescript
export const handleMultipleEvents = inngest.createFunction(
  { id: "multi-event-handler" },
  { event: ["user/signup", "user/login"] },
  async ({ event, step }) => {
    if (event.name === "user/signup") {
      // Handle signup
    } else {
      // Handle login
    }
  }
);
```

**Conditional Event Trigger (CEL Expression):**
```typescript
export const handlePremiumUsers = inngest.createFunction(
  { id: "premium-user-handler" },
  {
    event: "user/signup",
    if: "event.data.tier == 'premium'"  // Only trigger for premium users
  },
  async ({ event, step }) => {
    // Only processes premium signups
  }
);
```

**Cron Trigger:**
```typescript
export const dailyCleanup = inngest.createFunction(
  { id: "daily-cleanup" },
  { cron: "0 2 * * *" },  // Every day at 2 AM
  async ({ step }) => {
    await step.run("cleanup-temp-files", async () => {
      return cleanupTempFiles();
    });
  }
);
```

**Complete Configuration:**
```typescript
export const complexFunction = inngest.createFunction(
  {
    id: "complex-function",
    name: "Complex Function",
    retries: 5,
    concurrency: {
      limit: 10,
      key: "event.data.userId"
    },
    throttle: {
      limit: 100,
      period: "1h",
      burst: 10
    },
    rateLimit: {
      limit: 1000,
      period: "1d",
      key: "event.data.tenantId"
    },
    priority: {
      run: "event.data.tier == 'premium' ? 300 : 0"
    },
    idempotency: "event.data.requestId",
    batchEvents: {
      maxSize: 50,
      timeout: "10s"
    },
    debounce: {
      period: "5m",
      key: "event.data.resourceId"
    }
  },
  { event: "app/event.name" },
  async ({ event, step }) => {
    // Function logic
  }
);
```

### 6.2 Step API and Workflow Composition

**Available Step Methods:**

1. **step.run()** - Execute retriable code
2. **step.sleep()** - Delay execution
3. **step.sleepUntil()** - Sleep until specific time
4. **step.waitForEvent()** - Wait for another event
5. **step.sendEvent()** - Send events from within function
6. **step.invoke()** - Call another Inngest function
7. **step.fetch()** - Make durable HTTP requests
8. **step.ai.infer()** - Call AI inference endpoints
9. **step.ai.wrap()** - Wrap AI SDK calls

**Parallel Step Execution:**
```typescript
async ({ event, step }) => {
  // Execute steps in parallel
  const [user, orders, payments] = await Promise.all([
    step.run("fetch-user", async () => db.getUser(event.data.userId)),
    step.run("fetch-orders", async () => db.getOrders(event.data.userId)),
    step.run("fetch-payments", async () => db.getPayments(event.data.userId))
  ]);

  // All results available once all parallel steps complete
  await step.run("generate-report", async () => {
    return generateReport({ user, orders, payments });
  });
}
```

**Wait for Event Pattern:**
```typescript
async ({ event, step }) => {
  await step.run("send-verification-email", async () => {
    return sendEmail(event.data.email, "verify");
  });

  // Wait up to 3 days for user to verify email
  const verified = await step.waitForEvent("wait-for-verification", {
    event: "user/email.verified",
    timeout: "3d",
    match: "data.userId"  // Match on event.data.userId field
  });

  if (!verified) {
    // Timeout - user didn't verify
    await step.run("send-reminder", async () => {
      return sendEmail(event.data.email, "reminder");
    });
  } else {
    // User verified
    await step.run("activate-account", async () => {
      return activateAccount(event.data.userId);
    });
  }
}
```

**Invoke Another Function:**
```typescript
async ({ event, step }) => {
  const result = await step.invoke("call-another-function", {
    function: otherFunction,
    data: {
      userId: event.data.userId,
      action: "process"
    }
  });

  // Use result from invoked function
  await step.run("handle-result", async () => {
    return handleResult(result);
  });
}
```

**Durable Fetch:**
```typescript
async ({ event, step }) => {
  const apiData = await step.fetch("fetch-external-data", {
    url: "https://api.example.com/data",
    method: "GET",
    headers: {
      "Authorization": `Bearer ${process.env.API_TOKEN}`
    }
  });

  const json = await apiData.json();

  await step.run("process-data", async () => {
    return processData(json);
  });
}
```

### 6.3 Type Safety and TypeScript Support

**Event Type Inference:**
```typescript
import { type GetEvents } from "inngest";
import { inngest } from "./client";

// Get all event types including internal events (inngest/function.failed, etc.)
type Events = GetEvents<typeof inngest>;

// Use in function
function handleEvent(event: Events) {
  // Full type safety and autocomplete
}
```

**Typed Event Schemas:**
```typescript
type Events = {
  "user/signup": {
    data: {
      email: string;
      name: string;
      tier: "free" | "premium";
    };
  };
  "order/created": {
    data: {
      orderId: string;
      amount: number;
      items: Array<{ id: string; quantity: number }>;
    };
  };
};

export const inngest = new Inngest({
  id: "algojuke",
  schemas: new EventSchemas().fromRecord<Events>(),
});

// Function with full type inference
export const handleSignup = inngest.createFunction(
  { id: "handle-signup" },
  { event: "user/signup" },
  async ({ event, step }) => {
    // event.data is fully typed
    const email: string = event.data.email;
    const tier: "free" | "premium" = event.data.tier;

    // TypeScript will error if you access non-existent properties
    // const invalid = event.data.nonExistent; // Error!
  }
);
```

**Zod Schema Integration:**
```typescript
import { z } from "zod";

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  tier: z.enum(["free", "premium"])
});

export const inngest = new Inngest({
  id: "algojuke",
  schemas: new EventSchemas().fromZod({
    "user/signup": {
      data: userSchema
    }
  }),
});
```

**Step Type Inference:**
```typescript
async ({ event, step }) => {
  // Return type is inferred
  const user = await step.run("fetch-user", async () => {
    return { id: 1, name: "John", email: "john@example.com" };
  });

  // TypeScript knows the type of 'user'
  console.log(user.name);  // ✓ Valid
  console.log(user.invalid);  // ✗ TypeScript error
}
```

### 6.4 Error Handling Patterns

**Try-Catch Within Steps:**
```typescript
async ({ event, step }) => {
  const result = await step.run("risky-operation", async () => {
    try {
      return await riskyAPICall();
    } catch (error) {
      if (error.code === "TEMPORARY_ERROR") {
        // Let Inngest retry
        throw error;
      } else if (error.code === "PERMANENT_ERROR") {
        // Don't retry
        throw new NonRetriableError("Permanent failure");
      } else if (error.code === "RATE_LIMIT") {
        // Retry after delay
        throw new RetryAfterError("Rate limited", "60s");
      }
      // Default: let error propagate for retry
      throw error;
    }
  });
}
```

**Function-Level Failure Handler:**
```typescript
export const myFunction = inngest.createFunction(
  {
    id: "my-function",
    onFailure: async ({ error, event, step }) => {
      // Called when function exhausts all retries
      await step.run("log-failure", async () => {
        return await logToMonitoring({
          error: error.message,
          eventId: event.id,
          functionId: "my-function"
        });
      });

      await step.run("notify-team", async () => {
        return await sendSlackNotification({
          message: `Function failed: ${error.message}`
        });
      });
    }
  },
  { event: "app/event" },
  async ({ event, step }) => {
    // Main function logic
  }
);
```

**Global Failure Handler:**
```typescript
export const globalFailureHandler = inngest.createFunction(
  { id: "global-failure-handler" },
  { event: "inngest/function.failed" },  // System event
  async ({ event, step }) => {
    await step.run("track-failure", async () => {
      return await analytics.track({
        event: "function_failed",
        properties: {
          functionId: event.data.function_id,
          error: event.data.error,
          runId: event.data.run_id
        }
      });
    });
  }
);
```

**Preserving Stack Traces:**
```typescript
// ✓ GOOD: Await promises to preserve stack traces
const result = await step.run("fetch-data", async () => {
  return await fetchFromAPI();  // Awaited
});

// ✗ BAD: Don't await - stack trace may be lost
const result = await step.run("fetch-data", async () => {
  return fetchFromAPI();  // Not awaited
});
```

---

## 7. Integration Patterns

### 7.1 Triggering Functions from External Applications

**Sending Events via SDK:**
```typescript
import { inngest } from "./inngest/client";

// Send a single event
await inngest.send({
  name: "user/signup",
  data: {
    email: "user@example.com",
    name: "John Doe"
  }
});

// Send multiple events
await inngest.send([
  {
    name: "order/created",
    data: { orderId: "123", amount: 99.99 }
  },
  {
    name: "order/created",
    data: { orderId: "124", amount: 49.99 }
  }
]);
```

**Sending Events from Within Functions:**
```typescript
async ({ event, step }) => {
  // Use step.sendEvent for reliability
  await step.sendEvent("send-followup-event", {
    name: "order/processed",
    data: {
      orderId: event.data.orderId,
      status: "completed"
    }
  });
}
```

**HTTP API (Alternative to SDK):**
```bash
curl -X POST https://api.inngest.com/v0/events \
  -H "Authorization: Bearer YOUR_EVENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "user/signup",
    "data": {
      "email": "user@example.com",
      "name": "John Doe"
    }
  }'
```

### 7.2 Event Schemas and Validation

**TypeScript Schema Definition:**
```typescript
import { EventSchemas, Inngest } from "inngest";

type Events = {
  "user/signup": {
    data: {
      email: string;
      name: string;
      metadata?: Record<string, unknown>;
    };
  };
  "order/created": {
    data: {
      orderId: string;
      customerId: string;
      amount: number;
      items: Array<{
        productId: string;
        quantity: number;
        price: number;
      }>;
    };
  };
};

export const inngest = new Inngest({
  id: "algojuke",
  schemas: new EventSchemas().fromRecord<Events>(),
});
```

**Zod Runtime Validation:**
```typescript
import { z } from "zod";
import { EventSchemas, Inngest } from "inngest";

const orderCreatedSchema = z.object({
  orderId: z.string().uuid(),
  customerId: z.string(),
  amount: z.number().positive(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().positive()
  }))
});

export const inngest = new Inngest({
  id: "algojuke",
  schemas: new EventSchemas().fromZod({
    "order/created": {
      data: orderCreatedSchema
    }
  }),
});
```

**Benefits:**
- Compile-time type checking
- Runtime validation (with Zod)
- Autocomplete for event names and data
- Prevents type errors before deployment

### 7.3 API Integration for Task Queries (FR-007)

**REST API - Query Function Runs:**
```typescript
// 1. Send event and capture event ID
const eventIds = await inngest.send({
  name: "order/created",
  data: { orderId: "123" }
});

const eventId = eventIds[0];

// 2. Query runs for that event
const response = await fetch(
  `https://api.inngest.com/v1/events/${eventId}/runs`,
  {
    headers: {
      "Authorization": `Bearer ${process.env.INNGEST_SIGNING_KEY}`
    }
  }
);

const runs = await response.json();

// 3. Access run data
for (const run of runs.data) {
  console.log(`Run ${run.id}: ${run.status}`);
  console.log(`Output:`, run.output);
}
```

**Fetch Run Status and Output:**
```typescript
async function getRunStatus(eventId: string) {
  const response = await fetch(
    `https://api.inngest.com/v1/events/${eventId}/runs`,
    {
      headers: {
        "Authorization": `Bearer ${process.env.INNGEST_SIGNING_KEY}`
      }
    }
  );

  const runs = await response.json();

  return runs.data.map(run => ({
    id: run.id,
    status: run.status,  // Running, Completed, Failed, etc.
    output: run.output,
    startedAt: run.started_at,
    endedAt: run.ended_at
  }));
}
```

**GraphQL Support:**
- Inngest provides GraphQL API for more complex queries
- Access system resources programmatically
- Available in both cloud and self-hosted deployments

**Display in Application (Example Use Case):**
```typescript
// In a user dashboard
export async function GET(request: Request) {
  const userId = getUserId(request);

  // Send event to start background job
  const eventIds = await inngest.send({
    name: "user/report.generate",
    data: { userId }
  });

  // Query status
  const runs = await getRunStatus(eventIds[0]);

  return Response.json({
    jobId: eventIds[0],
    status: runs[0]?.status || "queued",
    progress: runs[0]?.output?.progress || 0
  });
}
```

---

## 8. Best Practices

### 8.1 Recommended Patterns for Complex Workflows

**1. Clear Event Naming Convention:**
```
object.action format:
- user.created
- user.updated
- order.created
- order.shipped
- payment.processed
- checkout.completed
```

**2. Single-Purpose Functions:**
```typescript
// ✓ GOOD: Single responsibility
export const sendWelcomeEmail = inngest.createFunction(
  { id: "send-welcome-email" },
  { event: "user/created" },
  async ({ event, step }) => {
    await step.run("send-email", async () => {
      return await email.send("welcome", event.data.email);
    });
  }
);

// ✗ BAD: Too many responsibilities
export const handleUserCreation = inngest.createFunction(
  { id: "handle-user-creation" },
  { event: "user/created" },
  async ({ event, step }) => {
    await step.run("send-email", ...);
    await step.run("create-stripe-customer", ...);
    await step.run("setup-database", ...);
    await step.run("send-slack-notification", ...);
    // Too much in one function
  }
);
```

**3. Use Steps as Checkpoints:**
```typescript
async ({ event, step }) => {
  // ✓ GOOD: Each step returns useful data
  const user = await step.run("create-user", async () => {
    return await db.createUser(event.data);
  });

  const account = await step.run("create-account", async () => {
    return await db.createAccount({ userId: user.id });
  });

  // Can retry from here if email fails
  await step.run("send-welcome", async () => {
    return await email.send(user.email, { accountId: account.id });
  });
}
```

**4. Avoid Side Effects in Function Body:**
```typescript
// ✗ BAD: Side effect outside step
export const processOrder = inngest.createFunction(
  { id: "process-order" },
  { event: "order/created" },
  async ({ event, step }) => {
    // This runs on EVERY step execution!
    await db.logEvent(event.id);  // ✗ Side effect

    await step.run("process", async () => {
      // ...
    });
  }
);

// ✓ GOOD: Side effects in steps
export const processOrder = inngest.createFunction(
  { id: "process-order" },
  { event: "order/created" },
  async ({ event, step }) => {
    // Only runs once, memoized
    await step.run("log-event", async () => {
      return await db.logEvent(event.id);
    });

    await step.run("process", async () => {
      // ...
    });
  }
);
```

**5. Use Descriptive Step Names:**
```typescript
// ✓ GOOD: Clear step names for observability
await step.run("validate-payment-method", async () => ...);
await step.run("charge-credit-card", async () => ...);
await step.run("update-order-status", async () => ...);
await step.run("send-confirmation-email", async () => ...);

// ✗ BAD: Generic step names
await step.run("step1", async () => ...);
await step.run("step2", async () => ...);
await step.run("process", async () => ...);
```

**6. Business Logic in Utilities:**
```typescript
// ✓ GOOD: Testable utility functions
async function processPayment(orderId: string, amount: number) {
  // Complex business logic here
  // Can be unit tested independently
}

export const handlePayment = inngest.createFunction(
  { id: "handle-payment" },
  { event: "payment/initiated" },
  async ({ event, step }) => {
    const result = await step.run("process-payment", async () => {
      return await processPayment(event.data.orderId, event.data.amount);
    });
  }
);
```

**7. Function Versioning for Traceability:**
```typescript
// Version 1
export const processUpload = inngest.createFunction(
  { id: "process-upload-v1" },
  {
    event: "upload/created",
    if: "event.ts < 1640000000000"  // Only process old events
  },
  async ({ event, step }) => {
    // Old logic
  }
);

// Version 2
export const processUploadV2 = inngest.createFunction(
  { id: "process-upload-v2" },
  {
    event: "upload/created",
    if: "event.ts >= 1640000000000"  // Only process new events
  },
  async ({ event, step }) => {
    // New logic
  }
);
```

### 8.2 Error Handling Strategies

**1. Idempotent Steps:**
```typescript
// ✓ GOOD: Upsert is idempotent
await step.run("save-user", async () => {
  return await db.upsertUser({ id: userId, ...data });
});

// ✗ BAD: Insert is not idempotent
await step.run("save-user", async () => {
  return await db.insertUser({ id: userId, ...data });  // Fails on retry
});
```

**2. Categorize Errors:**
```typescript
await step.run("call-api", async () => {
  try {
    return await externalAPI.call();
  } catch (error) {
    // Transient - retry
    if (error.code === "TIMEOUT" || error.code === "NETWORK_ERROR") {
      throw error;
    }

    // Rate limit - retry after delay
    if (error.code === "RATE_LIMIT") {
      throw new RetryAfterError("Rate limited", "60s");
    }

    // Permanent - don't retry
    if (error.code === "INVALID_INPUT") {
      throw new NonRetriableError(`Invalid input: ${error.message}`);
    }

    // Unknown - let retry with backoff
    throw error;
  }
});
```

**3. Graceful Degradation:**
```typescript
async ({ event, step }) => {
  let userData;
  try {
    userData = await step.run("fetch-user-data", async () => {
      return await externalAPI.getUser(event.data.userId);
    });
  } catch (error) {
    // Use fallback if external API fails
    userData = await step.run("use-fallback-data", async () => {
      return await db.getBasicUser(event.data.userId);
    });
  }

  await step.run("process-data", async () => {
    return processUser(userData);
  });
}
```

**4. Preserve Stack Traces:**
```typescript
// Always await promises for proper stack traces
await step.run("async-operation", async () => {
  return await someAsyncFunction();  // ✓ Awaited
});
```

### 8.3 Testing Approaches

**Using @inngest/test Package:**
```typescript
import { InngestTestEngine } from "@inngest/test";
import { myFunction } from "./functions/myFunction";

describe("myFunction", () => {
  let t: InngestTestEngine;

  beforeEach(() => {
    t = new InngestTestEngine({
      function: myFunction,
      // Optional: mock step functions
    });
  });

  it("should process user signup", async () => {
    const { result, ctx } = await t.execute({
      event: {
        name: "user/signup",
        data: {
          email: "test@example.com",
          name: "Test User"
        }
      }
    });

    // Assert on result
    expect(result.success).toBe(true);

    // Assert step was called
    expect(ctx.step.run).toHaveBeenCalledWith(
      "create-user",
      expect.any(Function)
    );
  });

  it("should handle errors gracefully", async () => {
    // Mock external dependencies
    const mockDB = {
      createUser: jest.fn().mockRejectedValue(new Error("DB Error"))
    };

    const { result, ctx } = await t.execute({
      event: {
        name: "user/signup",
        data: { email: "test@example.com" }
      }
    });

    // Assert error handling
    expect(ctx.step.run).toHaveBeenCalled();
  });
});
```

**Unit Testing Utility Functions:**
```typescript
// Separate business logic for easy testing
export async function calculateOrderTotal(items: OrderItem[]) {
  return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

// Unit test (no Inngest needed)
describe("calculateOrderTotal", () => {
  it("should calculate total correctly", () => {
    const items = [
      { price: 10, quantity: 2 },
      { price: 5, quantity: 3 }
    ];
    expect(calculateOrderTotal(items)).toBe(35);
  });
});
```

**Integration Testing:**
```typescript
describe("Order Processing Integration", () => {
  it("should complete full order workflow", async () => {
    // Use test Inngest instance
    const testInngest = new Inngest({ id: "test-app" });

    // Send test event
    const eventIds = await testInngest.send({
      name: "order/created",
      data: { orderId: "test-123" }
    });

    // Wait for completion (in test environment)
    // Query run status
    // Assert on final state
  });
});
```

### 8.4 Production Deployment Considerations

**1. Environment Separation:**
```typescript
// Use different Inngest apps for environments
const inngest = new Inngest({
  id: process.env.NODE_ENV === "production"
    ? "algojuke-production"
    : "algojuke-development",
  schemas: eventSchemas
});
```

**2. Secure Key Management:**
```bash
# Production environment variables
INNGEST_EVENT_KEY=your_production_event_key
INNGEST_SIGNING_KEY=your_production_signing_key

# Never commit keys to version control
# Use secret management (AWS Secrets Manager, etc.)
```

**3. Monitoring and Alerts:**
```typescript
// Set up failure handler for alerts
export const alertOnFailure = inngest.createFunction(
  { id: "alert-on-failure" },
  { event: "inngest/function.failed" },
  async ({ event, step }) => {
    const critical = ["process-payment", "send-notification"];

    if (critical.includes(event.data.function_id)) {
      await step.run("send-alert", async () => {
        return await pagerduty.alert({
          severity: "critical",
          message: `Critical function failed: ${event.data.function_id}`,
          details: event.data.error
        });
      });
    }
  }
);
```

**4. Capacity Planning:**
- Monitor concurrency usage
- Set appropriate throttle limits
- Use flow control to prevent overload
- Consider batch processing for high-volume events

**5. Deployment Strategy:**
```typescript
// Use environments for staged rollout
// 1. Deploy to staging environment first
// 2. Test with production-like data
// 3. Deploy to canary environment (10% traffic)
// 4. Monitor metrics and errors
// 5. Deploy to production

// Use function versioning for breaking changes
export const processOrderV2 = inngest.createFunction(
  { id: "process-order-v2" },
  {
    event: "order/created",
    if: "event.data.version >= 2"  // Gradual rollout
  },
  async ({ event, step }) => {
    // New logic
  }
);
```

**6. Performance Optimization:**
- Use parallel steps for independent operations
- Minimize data passed between steps (< 4MB total)
- Use `step.fetch()` for external API calls
- Implement caching where appropriate
- Use batching for high-volume events

**7. Logging and Debugging:**
```typescript
async ({ event, step }) => {
  // Inngest automatically logs step results
  // Add context for debugging
  const user = await step.run("fetch-user", async () => {
    const result = await db.getUser(event.data.userId);
    console.log(`Fetched user: ${result.id}`);  // Visible in logs
    return result;
  });
}
```

---

## 9. Real-World Workflow Examples

### 9.1 User Onboarding Drip Campaign

```typescript
export const onboardingCampaign = inngest.createFunction(
  {
    id: "user-onboarding-campaign",
    idempotency: "event.data.userId"  // Once per user
  },
  { event: "user/signup" },
  async ({ event, step }) => {
    // Day 0: Welcome email
    await step.run("send-welcome-email", async () => {
      return await email.send("welcome", event.data.email);
    });

    // Wait for user to complete onboarding or timeout after 2 days
    const completed = await step.waitForEvent("wait-for-onboarding", {
      event: "user/onboarding.completed",
      timeout: "2d",
      match: "data.userId"
    });

    if (!completed) {
      // Day 2: Onboarding reminder
      await step.run("send-onboarding-reminder", async () => {
        return await email.send("onboarding-reminder", event.data.email);
      });

      // Wait 3 more days
      await step.sleep("wait-3-days", "3d");

      // Day 5: Tips email
      await step.run("send-tips-email", async () => {
        return await email.send("tips", event.data.email);
      });
    } else {
      // User completed onboarding
      await step.run("send-success-email", async () => {
        return await email.send("onboarding-success", event.data.email);
      });
    }

    // Day 7: Feature highlight (regardless of onboarding status)
    await step.sleep("wait-7-days", "7d");
    await step.run("send-feature-highlight", async () => {
      return await email.send("feature-highlight", event.data.email);
    });
  }
);
```

### 9.2 Payment Processing Pipeline

```typescript
export const processPayment = inngest.createFunction(
  {
    id: "process-payment",
    retries: 5,
    idempotency: "event.data.paymentId",
    priority: {
      run: "event.data.tier == 'premium' ? 300 : 0"
    }
  },
  { event: "payment/initiated" },
  async ({ event, step }) => {
    // Step 1: Validate payment details
    const validation = await step.run("validate-payment", async () => {
      const result = await validatePaymentMethod(event.data.paymentMethod);
      if (!result.valid) {
        throw new NonRetriableError("Invalid payment method");
      }
      return result;
    });

    // Step 2: Check for fraud
    const fraudCheck = await step.run("fraud-check", async () => {
      return await fraudService.analyze({
        userId: event.data.userId,
        amount: event.data.amount,
        paymentMethod: event.data.paymentMethod
      });
    });

    if (fraudCheck.risk === "high") {
      // Flag for manual review
      await step.run("flag-for-review", async () => {
        return await db.flagPayment(event.data.paymentId, "fraud_risk");
      });

      // Wait up to 24 hours for manual approval
      const approved = await step.waitForEvent("wait-for-approval", {
        event: "payment/approved",
        timeout: "24h",
        match: "data.paymentId"
      });

      if (!approved) {
        throw new NonRetriableError("Payment not approved within 24 hours");
      }
    }

    // Step 3: Charge payment
    const charge = await step.run("charge-payment", async () => {
      try {
        return await stripe.charges.create({
          amount: event.data.amount,
          currency: "usd",
          source: event.data.paymentMethod,
          metadata: { paymentId: event.data.paymentId }
        });
      } catch (error) {
        if (error.code === "card_declined") {
          throw new NonRetriableError("Card declined");
        }
        throw new RetryAfterError("Payment gateway error", "30s");
      }
    });

    // Step 4: Update order status
    await step.run("update-order", async () => {
      return await db.updateOrder(event.data.orderId, {
        status: "paid",
        paymentId: charge.id,
        paidAt: new Date()
      });
    });

    // Step 5: Send confirmation
    await step.run("send-confirmation", async () => {
      return await email.send("payment-confirmation", {
        to: event.data.userEmail,
        data: {
          amount: event.data.amount,
          orderId: event.data.orderId,
          chargeId: charge.id
        }
      });
    });

    // Step 6: Trigger fulfillment
    await step.sendEvent("trigger-fulfillment", {
      name: "order/ready-for-fulfillment",
      data: {
        orderId: event.data.orderId,
        paymentId: charge.id
      }
    });

    return { success: true, chargeId: charge.id };
  }
);
```

### 9.3 Batch Data Processing

```typescript
export const processBatchLogs = inngest.createFunction(
  {
    id: "process-batch-logs",
    batchEvents: {
      maxSize: 100,
      timeout: "10s",
      key: "event.data.customerId"  // Batch per customer
    },
    concurrency: {
      limit: 5  // Process max 5 batches concurrently
    }
  },
  { event: "log/api.call" },
  async ({ events, step }) => {  // Note: 'events' array
    // Step 1: Aggregate logs
    const aggregated = await step.run("aggregate-logs", async () => {
      return events.reduce((acc, evt) => {
        const endpoint = evt.data.endpoint;
        if (!acc[endpoint]) {
          acc[endpoint] = { count: 0, totalDuration: 0 };
        }
        acc[endpoint].count++;
        acc[endpoint].totalDuration += evt.data.duration;
        return acc;
      }, {} as Record<string, { count: number; totalDuration: number }>);
    });

    // Step 2: Calculate metrics
    const metrics = await step.run("calculate-metrics", async () => {
      return Object.entries(aggregated).map(([endpoint, data]) => ({
        endpoint,
        count: data.count,
        avgDuration: data.totalDuration / data.count,
        customerId: events[0].data.customerId,
        timestamp: new Date()
      }));
    });

    // Step 3: Bulk write to database
    const result = await step.run("bulk-write-metrics", async () => {
      return await db.bulkInsert("api_metrics", metrics);
    });

    // Step 4: Check for anomalies
    await step.run("check-anomalies", async () => {
      for (const metric of metrics) {
        if (metric.avgDuration > 5000) {  // > 5 seconds
          await sendAlert({
            type: "slow_endpoint",
            endpoint: metric.endpoint,
            avgDuration: metric.avgDuration,
            customerId: metric.customerId
          });
        }
      }
    });

    return {
      success: true,
      processedEvents: events.length,
      metricsRecorded: metrics.length
    };
  }
);
```

### 9.4 AI Workflow with Retries

```typescript
export const generateContentWithAI = inngest.createFunction(
  {
    id: "generate-content-with-ai",
    retries: 3,
    throttle: {
      limit: 10,
      period: "1m",
      key: "event.data.userId"  // Rate limit per user
    }
  },
  { event: "content/generate" },
  async ({ event, step }) => {
    // Step 1: Fetch context data
    const [user, preferences] = await Promise.all([
      step.run("fetch-user", async () =>
        db.getUser(event.data.userId)
      ),
      step.run("fetch-preferences", async () =>
        db.getUserPreferences(event.data.userId)
      )
    ]);

    // Step 2: Generate with AI (offloaded to Inngest)
    const aiResponse = await step.ai.infer("generate-content", {
      model: "gpt-4",
      body: {
        messages: [
          {
            role: "system",
            content: "You are a helpful content generator."
          },
          {
            role: "user",
            content: `Generate content about: ${event.data.topic}. User preferences: ${JSON.stringify(preferences)}`
          }
        ],
        max_tokens: 1000
      }
    });

    const content = aiResponse.choices[0].message.content;

    // Step 3: Save generated content
    const saved = await step.run("save-content", async () => {
      return await db.createContent({
        userId: event.data.userId,
        topic: event.data.topic,
        content,
        generatedAt: new Date()
      });
    });

    // Step 4: Moderate content (parallel check)
    const moderation = await step.run("moderate-content", async () => {
      return await moderationAPI.check(content);
    });

    // Step 5: Handle moderation result
    if (moderation.flagged) {
      await step.run("flag-content", async () => {
        return await db.updateContent(saved.id, {
          status: "flagged",
          moderationReason: moderation.reason
        });
      });

      await step.sendEvent("send-moderation-alert", {
        name: "content/flagged",
        data: {
          contentId: saved.id,
          userId: event.data.userId,
          reason: moderation.reason
        }
      });
    } else {
      await step.run("publish-content", async () => {
        return await db.updateContent(saved.id, { status: "published" });
      });

      await step.sendEvent("send-notification", {
        name: "content/published",
        data: {
          contentId: saved.id,
          userId: event.data.userId
        }
      });
    }

    return {
      success: true,
      contentId: saved.id,
      status: moderation.flagged ? "flagged" : "published"
    };
  }
);
```

---

## 10. Feature Mapping to Functional Requirements

| Requirement ID | Description | Inngest Feature | Implementation |
|---------------|-------------|-----------------|----------------|
| FR-002 | Multi-step pipelines | ✅ `step.run()` | Each step independently executable and retriable |
| FR-003 | Independent step retry | ✅ Step-level retry | Each `step.run()` has own retry counter |
| FR-004 | Exponential backoff | ✅ Built-in | Default retry policy with exponential backoff + jitter |
| FR-005 | Configurable retry | ✅ Function config | `retries` option, `RetryAfterError` for custom timing |
| FR-007 | API task queries | ✅ REST/GraphQL API | Query runs by event ID via REST API |
| FR-008 | Rate limiting | ✅ `rateLimit` config | Hard limits on function execution per period |
| FR-009 | Throttling | ✅ `throttle` config | GCRA algorithm, smooth spikes, per-key limits |
| FR-011 | Scheduled execution | ✅ `step.sleep()`, cron | Delay execution or schedule recurring jobs |
| FR-013 | Priority queues | ✅ `priority` config | Dynamic priority -600 to +600 seconds |
| FR-014 | Deduplication | ✅ `idempotency` config | 24-hour deduplication by CEL expression |
| FR-016 | Manual replay | ✅ Dashboard UI | Bulk replay by time range and status filter |
| FR-018 | Concurrency control | ✅ `concurrency` config | Limit concurrent executions per key |
| - | Event batching | ✅ `batchEvents` config | Process up to 100 events per batch |
| - | Debouncing | ✅ `debounce` config | Delay until events stop, use last event |
| - | Wait for events | ✅ `step.waitForEvent()` | Pause until event received or timeout |
| - | State persistence | ✅ Managed state store | Auto-persist step results, < 4MB limit |
| - | Observability | ✅ Dashboard + API | Waterfall traces, metrics, logs, insights |
| - | Type safety | ✅ TypeScript SDK | Full type inference with schemas (TypeScript/Zod) |
| - | Local development | ✅ Dev Server | Docker support, auto-discovery, feature parity |

---

## 11. Comparison with Requirements

### Strengths
- **Comprehensive step workflow**: Exactly matches FR-002 and FR-003 requirements
- **Flexible retry policies**: Exceeds FR-004 and FR-005 with `RetryAfterError` and `NonRetriableError`
- **Rich flow control**: Supports rate limiting, throttling, concurrency, priority (FR-008, FR-009, FR-013, FR-018)
- **Built-in observability**: Extensive UI dashboard and API for monitoring (FR-016)
- **TypeScript-first**: Excellent developer experience with type safety
- **Event-driven architecture**: Natural fit for decoupled, scalable systems
- **Zero infrastructure**: No need to manage queues, workers, or state stores
- **Local dev experience**: Dev server with feature parity to production

### Considerations
- **Data retention**: Specific retention period not clearly documented (30-day requirement needs verification)
- **Vendor lock-in**: Proprietary platform (but can self-host)
- **Step data limits**: 4MB total limit may be constraining for some workflows
- **Batch limits**: Max 100 events per batch, 10 MiB total
- **Learning curve**: Event-driven paradigm may require mental model shift from traditional queues

### Gaps (if any)
- **30-day history retention**: Not explicitly confirmed in documentation (verify with Inngest)
- **Self-hosting complexity**: Requires PostgreSQL + Redis for production
- **Cost**: Pricing model not covered in research (needs evaluation)

---

## 12. Key Takeaways

1. **Durable Execution Model**: Inngest's core paradigm replaces traditional queues with step-based durable functions
2. **Step = Unit of Work**: Each `step.run()` is independently retriable, memoized, and tracked
3. **Event-Driven**: Everything triggered by events, enabling decoupled architecture
4. **TypeScript Excellence**: First-class TypeScript support with Zod integration
5. **Built-in Flow Control**: Native support for throttling, rate limiting, concurrency, priority, batching, debouncing
6. **Observability First**: Comprehensive dashboard, waterfall traces, metrics, and query API
7. **Developer Experience**: Local dev server with Docker, auto-discovery, hot reload
8. **Production Ready**: Self-hosting option, multiple deployment targets, environment separation

---

## 13. Next Steps for Implementation

1. **Proof of Concept**:
   - Set up local dev server with Docker Compose
   - Implement simple workflow (e.g., user signup with email)
   - Test retry behavior, step memoization

2. **Schema Design**:
   - Define event types with TypeScript/Zod
   - Establish naming conventions
   - Create typed Inngest client

3. **Core Workflows**:
   - Identify critical workflows in algojuke
   - Map to Inngest functions
   - Implement with proper error handling

4. **Testing Strategy**:
   - Set up `@inngest/test` integration
   - Unit test business logic utilities
   - Integration tests for critical paths

5. **Production Deployment**:
   - Evaluate self-hosting vs cloud
   - Set up staging/production environments
   - Configure monitoring and alerts
   - Implement failure handlers

6. **Documentation**:
   - Document event schemas
   - Create runbooks for common operations
   - Establish team guidelines

---

## 14. Resources

### Official Documentation
- [Inngest Documentation](https://www.inngest.com/docs)
- [TypeScript SDK](https://www.inngest.com/docs/typescript)
- [Durable Execution](https://www.inngest.com/docs/learn/how-functions-are-executed)
- [Steps & Workflows](https://www.inngest.com/docs/features/inngest-functions/steps-workflows)
- [Local Development](https://www.inngest.com/docs/local-development)
- [Flow Control](https://www.inngest.com/docs/guides/flow-control)
- [Error Handling](https://www.inngest.com/docs/guides/error-handling)
- [Observability & Metrics](https://www.inngest.com/docs/platform/monitor/observability-metrics)

### API References
- [REST API - Function Runs](https://www.inngest.com/docs/examples/fetch-run-status-and-output)
- [Create Function Reference](https://www.inngest.com/docs/reference/functions/create)
- [Step API](https://www.inngest.com/docs/reference/functions/step-run)
- [Wait for Event](https://www.inngest.com/docs/reference/functions/step-wait-for-event)

### GitHub
- [inngest/inngest](https://github.com/inngest/inngest) - Main repository
- [inngest/inngest-js](https://github.com/inngest/inngest-js) - TypeScript SDK
- [@inngest/test](https://www.npmjs.com/package/@inngest/test) - Testing package

### Blog Posts
- [Introducing Inngest Dev Server](https://www.inngest.com/blog/introducing-inngest-dev-server)
- [Event Batching](https://www.inngest.com/blog/event-batching)
- [Enhanced Observability](https://www.inngest.com/blog/enhanced-observability-traces-and-metrics)
- [Improved Error Handling](https://www.inngest.com/blog/improved-error-handling)
- [Rate Limiting vs Debouncing vs Throttling](https://www.inngest.com/blog/rate-limit-debouncing-throttling-explained)

### Community
- [GitHub Discussions](https://github.com/inngest/inngest/discussions)
- [Discord Community](https://www.inngest.com/discord)

---

**End of Research Document**
