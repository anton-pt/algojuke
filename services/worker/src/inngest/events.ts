/**
 * Event Schemas for Background Task Queue Infrastructure
 *
 * Defines TypeScript types and Zod schemas for Inngest events used in the
 * demonstration task workflow. These schemas provide both compile-time type
 * safety and runtime validation.
 *
 * **Note**: This is a placeholder demonstration schema. Actual domain events
 * (track enrichment) will be defined in a follow-up feature implementation.
 *
 * Usage:
 * ```typescript
 * import { demoEvents, inngestClient } from './events';
 *
 * // Create typed Inngest client
 * export const inngest = new Inngest({
 *   id: "algojuke-worker",
 *   schemas: demoEvents
 * });
 *
 * // Send events with type safety
 * await inngest.send({
 *   name: "demo/task.requested",
 *   data: {
 *     taskId: "uuid-here",
 *     simulateFailure: false,
 *   }
 * });
 * ```
 */

import { z } from "zod";
import { EventSchemas } from "inngest";

// ============================================================================
// Shared Types
// ============================================================================

/**
 * Task status values
 */
export const TaskStatus = z.enum([
  "pending",
  "in_progress",
  "completed",
  "failed",
]);

export type TaskStatus = z.infer<typeof TaskStatus>;

/**
 * Priority modifier for tasks
 * Range: -600 to +600 seconds (Inngest priority range)
 */
export const PriorityModifier = z
  .number()
  .int()
  .min(-600)
  .max(600)
  .describe("Priority modifier in seconds (-600 to +600)");

/**
 * Valid demo task step names
 */
export const DemoStepName = z.enum([
  "step-1-initialize",
  "step-2-process",
  "step-3-simulate-delay",
  "step-4-simulate-api-call",
  "step-5-finalize",
]);

export type DemoStepName = z.infer<typeof DemoStepName>;

// ============================================================================
// Demo Result Data Structures
// ============================================================================

/**
 * Step execution result
 */
export const StepResult = z.object({
  stepName: DemoStepName,
  executedAt: z.number().int().positive(),
  duration: z.number().int().nonnegative(),
  data: z.record(z.unknown()).optional(),
});

export type StepResult = z.infer<typeof StepResult>;

/**
 * Complete demo task result structure
 * Accumulated across all steps
 */
export const DemoTaskResult = z.object({
  taskId: z.string().uuid(),
  steps: z.array(StepResult),
  totalDuration: z.number().int().nonnegative(),
  retriedSteps: z.array(DemoStepName).optional(),
  simulatedFailures: z.number().int().nonnegative().optional(),
});

export type DemoTaskResult = z.infer<typeof DemoTaskResult>;

// ============================================================================
// Event Schemas
// ============================================================================

/**
 * Event: demo/task.requested
 *
 * Triggers demonstration multi-step task. This placeholder event validates
 * all infrastructure capabilities:
 * - Multi-step workflow execution
 * - Independent step retry
 * - Rate limiting and throttling
 * - Concurrency control
 * - State persistence
 * - Observability
 *
 * Behavior:
 * - Subject to idempotency check (24-hour window) unless `force: true`
 * - Priority determines execution order in queue
 * - Can simulate failures to test retry behavior
 */
export const DemoTaskRequestedEvent = z.object({
  name: z.literal("demo/task.requested"),
  data: z.object({
    /**
     * Unique task identifier (UUID)
     * @example "550e8400-e29b-41d4-a716-446655440000"
     */
    taskId: z.string().uuid(),

    /**
     * Priority modifier (-600 to +600 seconds)
     * Positive values = higher priority
     * @default 0
     */
    priority: PriorityModifier.optional(),

    /**
     * Override idempotency, force execution even if recently completed
     * @default false
     */
    force: z.boolean().optional(),

    /**
     * Simulate failures for testing retry behavior
     * @default false
     */
    simulateFailure: z.boolean().optional(),

    /**
     * Which step should fail (for testing)
     */
    failAtStep: DemoStepName.optional(),

    /**
     * Delay duration in milliseconds for delay simulation step
     * @default 1000
     */
    delayMs: z.number().int().positive().max(30000).optional(),

    /**
     * Additional context for demo
     */
    context: z
      .object({
        userId: z.string().uuid().optional(),
        source: z.enum(["manual", "automated", "test"]).optional(),
        metadata: z.record(z.unknown()).optional(),
      })
      .optional(),
  }),
});

export type DemoTaskRequestedEvent = z.infer<
  typeof DemoTaskRequestedEvent
>["data"];

/**
 * Event: demo/task.completed
 *
 * Emitted by demo task function upon successful completion.
 * Demonstrates event-driven architecture patterns.
 */
export const DemoTaskCompletedEvent = z.object({
  name: z.literal("demo/task.completed"),
  data: z.object({
    /**
     * Task UUID
     */
    taskId: z.string().uuid(),

    /**
     * Inngest function run ID
     * Can be used to query run details via Inngest API
     */
    runId: z.string(),

    /**
     * Completion timestamp (Unix epoch milliseconds)
     */
    completedAt: z.number().int().positive(),

    /**
     * Number of steps successfully completed
     */
    stepsCompleted: z.number().int().positive(),

    /**
     * Complete task result
     */
    result: DemoTaskResult,

    /**
     * Total execution time in milliseconds
     */
    durationMs: z.number().int().positive(),
  }),
});

export type DemoTaskCompletedEvent = z.infer<
  typeof DemoTaskCompletedEvent
>["data"];

/**
 * Event: demo/task.failed
 *
 * Emitted when demo task permanently fails (after exhausting all retries).
 * Demonstrates error handling and observability patterns.
 */
export const DemoTaskFailedEvent = z.object({
  name: z.literal("demo/task.failed"),
  data: z.object({
    /**
     * Task UUID
     */
    taskId: z.string().uuid(),

    /**
     * Inngest function run ID
     */
    runId: z.string(),

    /**
     * Error message describing failure
     */
    error: z.string(),

    /**
     * Name of step that caused final failure
     */
    failedStep: DemoStepName.optional(),

    /**
     * Number of retry attempts made
     */
    retries: z.number().int().nonnegative(),

    /**
     * Timestamp when failure was determined (Unix epoch milliseconds)
     */
    failedAt: z.number().int().positive(),

    /**
     * Partial task result (steps that succeeded before failure)
     */
    partialResult: DemoTaskResult.optional(),
  }),
});

export type DemoTaskFailedEvent = z.infer<typeof DemoTaskFailedEvent>["data"];

// ============================================================================
// Event Schema Collection
// ============================================================================

/**
 * Demo event schemas for infrastructure validation
 */
export const demoEvents = new EventSchemas().fromZod({
  "demo/task.requested": {
    data: DemoTaskRequestedEvent.shape.data,
  },
  "demo/task.completed": {
    data: DemoTaskCompletedEvent.shape.data,
  },
  "demo/task.failed": {
    data: DemoTaskFailedEvent.shape.data,
  },
});

/**
 * TypeScript type for all demo events
 * Useful for type guards and discriminated unions
 */
export type DemoEvent =
  | (DemoTaskRequestedEvent & { name: "demo/task.requested" })
  | (DemoTaskCompletedEvent & { name: "demo/task.completed" })
  | (DemoTaskFailedEvent & { name: "demo/task.failed" });

// ============================================================================
// Utility Types & Helpers
// ============================================================================

/**
 * Type guard to check if event is demo-related
 */
export function isDemoEvent(eventName: string): eventName is DemoEvent["name"] {
  return eventName.startsWith("demo/task.");
}

/**
 * Extract event data type from event name
 */
export type EventData<T extends DemoEvent["name"]> = Extract<
  DemoEvent,
  { name: T }
>;

/**
 * Default priority values for different use cases
 */
export const DEFAULT_PRIORITY = {
  MANUAL: 300, // User-initiated gets high priority
  AUTOMATED: 0, // Automated tasks get normal priority
  TEST: -100, // Test tasks get low priority
} as const;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  DELAY_MS: 1000,
  MAX_RETRIES: 5,
  IDEMPOTENCY_WINDOW_HOURS: 24,
} as const;

/**
 * Helper to create demo task request with defaults
 */
export function createDemoTaskRequest(
  params: Partial<DemoTaskRequestedEvent> & {
    taskId: string;
    source?: "manual" | "automated" | "test";
  }
): DemoTaskRequestedEvent {
  return {
    taskId: params.taskId,
    priority:
      params.priority ??
      DEFAULT_PRIORITY[
        params.source?.toUpperCase() as keyof typeof DEFAULT_PRIORITY
      ] ??
      0,
    force: params.force ?? false,
    simulateFailure: params.simulateFailure ?? false,
    failAtStep: params.failAtStep,
    delayMs: params.delayMs ?? DEFAULT_CONFIG.DELAY_MS,
    context: {
      userId: params.context?.userId,
      source: params.source ?? "automated",
      metadata: params.context?.metadata,
    },
  };
}

/**
 * Helper to create step result
 */
export function createStepResult(
  stepName: DemoStepName,
  duration: number,
  data?: Record<string, unknown>
): StepResult {
  return {
    stepName,
    executedAt: Date.now(),
    duration,
    data,
  };
}

// ============================================================================
// Track Ingestion Events (Feature 006)
// ============================================================================

/**
 * Ingestion pipeline step names
 */
export const IngestionStepName = z.enum([
  "fetch-audio-features",
  "fetch-lyrics",
  "generate-interpretation",
  "embed-interpretation",
  "store-document",
  "emit-completion",
]);

export type IngestionStepName = z.infer<typeof IngestionStepName>;

/**
 * Event: track/ingestion.requested
 *
 * Triggers the track ingestion pipeline. Accepts ISRC and track metadata
 * from Tidal API to populate the vector search index.
 */
export const TrackIngestionRequestedEvent = z.object({
  name: z.literal("track/ingestion.requested"),
  data: z.object({
    /**
     * ISO 3901 ISRC (12 alphanumeric characters)
     * @example "USRC11700001"
     */
    isrc: z.string().length(12).regex(/^[A-Z0-9]{12}$/i, {
      message: "ISRC must be 12 alphanumeric characters",
    }),

    /**
     * Track title from Tidal API
     */
    title: z.string().min(1),

    /**
     * Artist name from Tidal API
     */
    artist: z.string().min(1),

    /**
     * Album name from Tidal API
     */
    album: z.string().min(1),

    /**
     * Priority modifier (-600 to +600 seconds)
     * Positive values = higher priority
     * @default 0
     */
    priority: PriorityModifier.optional(),

    /**
     * Override idempotency, force re-ingestion
     * @default false
     */
    force: z.boolean().optional(),
  }),
});

export type TrackIngestionRequestedEvent = z.infer<
  typeof TrackIngestionRequestedEvent
>["data"];

/**
 * Event: track/ingestion.completed
 *
 * Emitted upon successful pipeline completion.
 */
export const TrackIngestionCompletedEvent = z.object({
  name: z.literal("track/ingestion.completed"),
  data: z.object({
    /**
     * ISRC of ingested track
     */
    isrc: z.string(),

    /**
     * Inngest function run ID
     */
    runId: z.string(),

    /**
     * Completion timestamp (Unix epoch ms)
     */
    completedAt: z.number().int().positive(),

    /**
     * Total execution time in milliseconds
     */
    durationMs: z.number().int().positive(),

    /**
     * Summary of ingested data
     */
    result: z.object({
      hasLyrics: z.boolean(),
      hasAudioFeatures: z.boolean(),
      hasInterpretation: z.boolean(),
      embeddingDimensions: z.number().int(),
    }),
  }),
});

export type TrackIngestionCompletedEvent = z.infer<
  typeof TrackIngestionCompletedEvent
>["data"];

/**
 * Event: track/ingestion.failed
 *
 * Emitted when pipeline permanently fails (after exhausting retries).
 */
export const TrackIngestionFailedEvent = z.object({
  name: z.literal("track/ingestion.failed"),
  data: z.object({
    /**
     * ISRC of failed track
     */
    isrc: z.string(),

    /**
     * Inngest function run ID
     */
    runId: z.string(),

    /**
     * Error message
     */
    error: z.string(),

    /**
     * Step that caused final failure
     */
    failedStep: IngestionStepName.optional(),

    /**
     * Number of retry attempts made
     */
    retries: z.number().int().nonnegative(),

    /**
     * Failure timestamp (Unix epoch ms)
     */
    failedAt: z.number().int().positive(),
  }),
});

export type TrackIngestionFailedEvent = z.infer<
  typeof TrackIngestionFailedEvent
>["data"];

/**
 * Combined track ingestion event schemas
 */
export const trackIngestionEvents = new EventSchemas().fromZod({
  "track/ingestion.requested": {
    data: TrackIngestionRequestedEvent.shape.data,
  },
  "track/ingestion.completed": {
    data: TrackIngestionCompletedEvent.shape.data,
  },
  "track/ingestion.failed": {
    data: TrackIngestionFailedEvent.shape.data,
  },
});

/**
 * TypeScript type for all track ingestion events
 */
export type TrackIngestionEvent =
  | (TrackIngestionRequestedEvent & { name: "track/ingestion.requested" })
  | (TrackIngestionCompletedEvent & { name: "track/ingestion.completed" })
  | (TrackIngestionFailedEvent & { name: "track/ingestion.failed" });

/**
 * Type guard to check if event is track-ingestion-related
 */
export function isTrackIngestionEvent(
  eventName: string
): eventName is TrackIngestionEvent["name"] {
  return eventName.startsWith("track/ingestion.");
}

// ============================================================================
// Combined Event Schemas (All Events)
// ============================================================================

/**
 * Combined event schemas for Inngest client initialization
 *
 * Includes all event types:
 * - Demo events (infrastructure validation)
 * - Track ingestion events (feature 006)
 */
export const allEvents = new EventSchemas().fromZod({
  // Demo events
  "demo/task.requested": {
    data: DemoTaskRequestedEvent.shape.data,
  },
  "demo/task.completed": {
    data: DemoTaskCompletedEvent.shape.data,
  },
  "demo/task.failed": {
    data: DemoTaskFailedEvent.shape.data,
  },
  // Track ingestion events
  "track/ingestion.requested": {
    data: TrackIngestionRequestedEvent.shape.data,
  },
  "track/ingestion.completed": {
    data: TrackIngestionCompletedEvent.shape.data,
  },
  "track/ingestion.failed": {
    data: TrackIngestionFailedEvent.shape.data,
  },
});
