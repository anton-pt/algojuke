/**
 * Demo Task Function
 *
 * Placeholder demonstration task that validates all background task queue
 * infrastructure capabilities:
 * - Multi-step workflow execution
 * - Durable execution with automatic retry
 * - Step memoization (successful steps don't re-execute)
 * - Rate limiting and throttling
 * - Concurrency control
 * - Observability via Inngest dashboard
 *
 * This is a placeholder for infrastructure validation only. Actual track
 * enrichment workflows will be implemented in a follow-up feature.
 */

import { inngest } from "../client.js";
import { createStepResult, type DemoTaskResult } from "../events.js";

/**
 * Demo Task Inngest Function
 *
 * Configuration:
 * - id: "demo-task" - Function identifier
 * - retries: 5 - Maximum retry attempts (matches FR-005: 5 retries over 24h)
 * - concurrency: 10 - Maximum concurrent executions (matches FR-018)
 * - throttle: Global rate limiting (20 executions per 60s across all invocations)
 * - idempotency: 24-hour window based on taskId (matches FR-014)
 *
 * Event: demo/task.requested
 * Trigger: Manual submission via Inngest UI (no backend integration in this feature)
 */
export const demoTask = inngest.createFunction(
  {
    id: "demo-task",
    name: "Demo Task - Infrastructure Validation",
    retries: 5,
    concurrency: {
      limit: 10,
    },
    throttle: {
      limit: 20,
      period: "60s",
    },
    idempotency: "event.data.taskId",
  },
  { event: "demo/task.requested" },
  async ({ event, step }) => {
    const { taskId, simulateFailure, failAtStep, delayMs = 1000 } = event.data;

    const steps: any[] = [];
    const startTime = Date.now();

    /**
     * Step 1: Initialize
     * Logs task start and returns initialization timestamp
     */
    const step1 = await step.run("step-1-initialize", async () => {
      const stepStart = Date.now();

      console.log(`[${taskId}] Step 1: Initializing task`);

      // Simulate initialization work
      await new Promise((resolve) => setTimeout(resolve, 50));

      const duration = Date.now() - stepStart;

      return createStepResult("step-1-initialize", duration, {
        initialized: true,
        startedAt: stepStart,
      });
    });

    steps.push(step1);

    /**
     * Step 2: Process
     * Simulates data processing with 100ms delay
     */
    const step2 = await step.run("step-2-process", async () => {
      const stepStart = Date.now();

      console.log(`[${taskId}] Step 2: Processing data`);

      // Check for simulated failure
      if (simulateFailure && failAtStep === "step-2-process") {
        throw new Error("Simulated failure at step-2-process");
      }

      // Simulate processing work
      await new Promise((resolve) => setTimeout(resolve, 100));

      const duration = Date.now() - stepStart;

      return createStepResult("step-2-process", duration, {
        processed: true,
        recordsProcessed: 42,
      });
    });

    steps.push(step2);

    /**
     * Step 3: Simulate Delay
     * Uses configurable delayMs parameter from event data
     */
    const step3 = await step.run("step-3-simulate-delay", async () => {
      const stepStart = Date.now();

      console.log(`[${taskId}] Step 3: Simulating delay (${delayMs}ms)`);

      // Check for simulated failure
      if (simulateFailure && failAtStep === "step-3-simulate-delay") {
        throw new Error("Simulated failure at step-3-simulate-delay");
      }

      // Use configurable delay
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      const duration = Date.now() - stepStart;

      return createStepResult("step-3-simulate-delay", duration, {
        delayMs,
        completed: true,
      });
    });

    steps.push(step3);

    /**
     * Step 4: Simulate API Call
     * Demonstrates external API call pattern with conditional failure
     */
    const step4 = await step.run("step-4-simulate-api-call", async () => {
      const stepStart = Date.now();

      console.log(`[${taskId}] Step 4: Simulating external API call`);

      // Check for simulated failure
      if (simulateFailure && failAtStep === "step-4-simulate-api-call") {
        throw new Error("Simulated failure at step-4-simulate-api-call");
      }

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 150));

      const duration = Date.now() - stepStart;

      return createStepResult("step-4-simulate-api-call", duration, {
        apiResponse: {
          status: 200,
          data: { mock: true, timestamp: Date.now() },
        },
        success: true,
      });
    });

    steps.push(step4);

    /**
     * Step 5: Finalize
     * Accumulates all step results and returns complete demo task result
     */
    const step5 = await step.run("step-5-finalize", async () => {
      const stepStart = Date.now();

      console.log(`[${taskId}] Step 5: Finalizing task`);

      // Check for simulated failure
      if (simulateFailure && failAtStep === "step-5-finalize") {
        throw new Error("Simulated failure at step-5-finalize");
      }

      const totalDuration = Date.now() - startTime;
      const duration = Date.now() - stepStart;

      return createStepResult("step-5-finalize", duration, {
        finalized: true,
        totalDuration,
        stepsCompleted: steps.length + 1, // Include this step
      });
    });

    steps.push(step5);

    /**
     * Construct final result
     */
    const result: DemoTaskResult = {
      taskId,
      steps,
      totalDuration: Date.now() - startTime,
      simulatedFailures: simulateFailure ? 1 : 0,
    };

    console.log(
      `[${taskId}] Task completed successfully in ${result.totalDuration}ms`
    );

    // Optionally emit completion event (for future workflow integration)
    await step.sendEvent("task-completed", {
      name: "demo/task.completed",
      data: {
        taskId,
        runId: event.id || "unknown",
        completedAt: Date.now(),
        stepsCompleted: steps.length,
        result,
        durationMs: result.totalDuration,
      },
    });

    return {
      success: true,
      taskId,
      stepsCompleted: steps.length,
      totalDuration: result.totalDuration,
      steps: result.steps,
    };
  }
);
