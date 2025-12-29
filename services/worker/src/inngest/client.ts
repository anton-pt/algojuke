/**
 * Inngest Client Configuration
 *
 * Initializes the typed Inngest client with demo event schemas for the
 * background task queue infrastructure.
 *
 * This client provides type-safe event emission and function definition
 * capabilities, validated against the event schemas defined in events.ts.
 */

import { Inngest } from "inngest";
import { allEvents } from "./events.js";

/**
 * Inngest client instance with typed event schemas
 *
 * Configuration:
 * - id: "algojuke-worker" - Unique identifier for this worker app
 * - schemas: allEvents - Type-safe event schemas from events.ts
 *
 * Usage:
 * ```typescript
 * import { inngest } from "./client.js";
 *
 * // Send typed event
 * await inngest.send({
 *   name: "demo/task.requested",
 *   data: {
 *     taskId: "uuid-here",
 *     priority: 0
 *   }
 * });
 *
 * // Define typed function
 * export const demoTask = inngest.createFunction(
 *   { id: "demo-task" },
 *   { event: "demo/task.requested" },
 *   async ({ event, step }) => {
 *     // event.data is fully typed based on schema
 *   }
 * );
 * ```
 */
export const inngest = new Inngest({
  id: "algojuke-worker",
  schemas: allEvents,
});
