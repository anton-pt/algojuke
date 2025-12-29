/**
 * Contract tests for Trace Correlation
 *
 * TDD: These tests validate trace correlation and nested span structure.
 */

import { describe, it, expect } from "vitest";

// Import will fail until implementation exists
import {
  createTraceContext,
  withTraceContext,
  getTraceId,
  getSpanId,
  type TraceContext,
} from "../../src/context.js";

describe("TraceContext", () => {
  it("should create a new trace context with unique IDs", () => {
    const context = createTraceContext();

    expect(context).toBeDefined();
    expect(context.traceId).toBeDefined();
    expect(context.traceId).toMatch(/^[a-f0-9-]+$/);
  });

  it("should create context with provided trace ID", () => {
    const customTraceId = "custom-trace-123";
    const context = createTraceContext({ traceId: customTraceId });

    expect(context.traceId).toBe(customTraceId);
  });

  it("should create context with metadata", () => {
    const context = createTraceContext({
      metadata: {
        userId: "user-123",
        sessionId: "session-456",
      },
    });

    expect(context.metadata?.userId).toBe("user-123");
    expect(context.metadata?.sessionId).toBe("session-456");
  });

  it("should generate unique trace IDs on each call", () => {
    const context1 = createTraceContext();
    const context2 = createTraceContext();

    expect(context1.traceId).not.toBe(context2.traceId);
  });
});

describe("withTraceContext", () => {
  it("should execute function with trace context", async () => {
    const context = createTraceContext();
    let capturedTraceId: string | undefined;

    await withTraceContext(context, () => {
      capturedTraceId = getTraceId();
    });

    expect(capturedTraceId).toBe(context.traceId);
  });

  it("should support async functions", async () => {
    const context = createTraceContext();
    let capturedTraceId: string | undefined;

    await withTraceContext(context, async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      capturedTraceId = getTraceId();
    });

    expect(capturedTraceId).toBe(context.traceId);
  });

  it("should return value from wrapped function", async () => {
    const context = createTraceContext();

    const result = await withTraceContext(context, () => {
      return "test-result";
    });

    expect(result).toBe("test-result");
  });

  it("should propagate errors from wrapped function", () => {
    const context = createTraceContext();

    expect(() =>
      withTraceContext(context, () => {
        throw new Error("test error");
      })
    ).toThrow("test error");
  });
});

describe("getTraceId / getSpanId", () => {
  it("should return undefined when no context is active", () => {
    const traceId = getTraceId();
    const spanId = getSpanId();

    // These should return undefined or handle gracefully
    expect(traceId).toBeUndefined();
    expect(spanId).toBeUndefined();
  });

  it("should return trace ID within context", async () => {
    const context = createTraceContext();

    await withTraceContext(context, () => {
      expect(getTraceId()).toBe(context.traceId);
    });
  });
});
