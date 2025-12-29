/**
 * Contract tests for HTTP Span Schema
 *
 * TDD: These tests are written FIRST and should FAIL until http.ts is implemented.
 */

import { describe, it, expect } from "vitest";

// Import will fail until implementation exists
import {
  HTTPSpanMetadataSchema,
  HTTPResponseMetadataSchema,
  type HTTPSpanMetadata,
  type HTTPResponseMetadata,
} from "../../src/schemas/http.js";

describe("HTTPSpanMetadataSchema", () => {
  it("should validate valid HTTP metadata", () => {
    const validMetadata = {
      method: "GET" as const,
      url: "https://api.tidal.com/v1/search",
      headers: {
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      },
    };

    const result = HTTPSpanMetadataSchema.safeParse(validMetadata);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.method).toBe("GET");
      expect(result.data.url).toBe("https://api.tidal.com/v1/search");
    }
  });

  it("should accept minimal metadata (method and url)", () => {
    const minimalMetadata = {
      method: "POST" as const,
      url: "https://api.example.com/endpoint",
    };

    const result = HTTPSpanMetadataSchema.safeParse(minimalMetadata);
    expect(result.success).toBe(true);
  });

  it("should accept all valid HTTP methods", () => {
    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

    for (const method of methods) {
      const metadata = {
        method,
        url: "https://api.example.com",
      };
      const result = HTTPSpanMetadataSchema.safeParse(metadata);
      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid HTTP method", () => {
    const invalidMetadata = {
      method: "INVALID",
      url: "https://api.example.com",
    };

    const result = HTTPSpanMetadataSchema.safeParse(invalidMetadata);
    expect(result.success).toBe(false);
  });

  it("should reject invalid URL format", () => {
    const invalidMetadata = {
      method: "GET",
      url: "not-a-valid-url",
    };

    const result = HTTPSpanMetadataSchema.safeParse(invalidMetadata);
    expect(result.success).toBe(false);
  });

  it("should reject missing method", () => {
    const invalidMetadata = {
      url: "https://api.example.com",
    };

    const result = HTTPSpanMetadataSchema.safeParse(invalidMetadata);
    expect(result.success).toBe(false);
  });

  it("should reject missing url", () => {
    const invalidMetadata = {
      method: "GET",
    };

    const result = HTTPSpanMetadataSchema.safeParse(invalidMetadata);
    expect(result.success).toBe(false);
  });
});

describe("HTTPResponseMetadataSchema", () => {
  it("should validate valid response metadata", () => {
    const validResponse = {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": "abc123",
      },
      durationMs: 150.5,
    };

    const result = HTTPResponseMetadataSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.statusCode).toBe(200);
      expect(result.data.durationMs).toBe(150.5);
    }
  });

  it("should accept minimal response (statusCode and durationMs)", () => {
    const minimalResponse = {
      statusCode: 404,
      durationMs: 50,
    };

    const result = HTTPResponseMetadataSchema.safeParse(minimalResponse);
    expect(result.success).toBe(true);
  });

  it("should accept various status codes", () => {
    const statusCodes = [200, 201, 301, 400, 401, 403, 404, 500, 502, 503];

    for (const statusCode of statusCodes) {
      const response = {
        statusCode,
        durationMs: 100,
      };
      const result = HTTPResponseMetadataSchema.safeParse(response);
      expect(result.success).toBe(true);
    }
  });

  it("should reject missing statusCode", () => {
    const invalidResponse = {
      durationMs: 100,
    };

    const result = HTTPResponseMetadataSchema.safeParse(invalidResponse);
    expect(result.success).toBe(false);
  });

  it("should reject missing durationMs", () => {
    const invalidResponse = {
      statusCode: 200,
    };

    const result = HTTPResponseMetadataSchema.safeParse(invalidResponse);
    expect(result.success).toBe(false);
  });

  it("should reject negative durationMs", () => {
    const invalidResponse = {
      statusCode: 200,
      durationMs: -50,
    };

    const result = HTTPResponseMetadataSchema.safeParse(invalidResponse);
    expect(result.success).toBe(false);
  });

  it("should reject non-integer statusCode", () => {
    const invalidResponse = {
      statusCode: 200.5,
      durationMs: 100,
    };

    const result = HTTPResponseMetadataSchema.safeParse(invalidResponse);
    expect(result.success).toBe(false);
  });
});
