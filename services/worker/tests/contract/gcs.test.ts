/**
 * GCS Client Contract Tests (Worker Service)
 *
 * Tests the GCS audio upload client input validation schemas and error mapping.
 * These tests verify that the client correctly validates inputs and maps GCS errors.
 *
 * Note: Integration tests that make real GCS calls require valid credentials
 * and are out of scope for contract tests.
 */

import { describe, it, expect } from "vitest";
import {
  UploadAudioInputSchema,
  PathSchema,
  mapGCSError,
} from "../../src/clients/gcs.js";
import { APIError } from "../../src/clients/errors.js";

describe("GCS Client Contract (Worker)", () => {
  describe("PathSchema", () => {
    it("should validate valid path", () => {
      const result = PathSchema.safeParse("mixes/abc123/seg001.mp3");
      expect(result.success).toBe(true);
    });

    it("should validate path with underscores and hyphens", () => {
      const result = PathSchema.safeParse("mixes/mix-123/segment_001.mp3");
      expect(result.success).toBe(true);
    });

    it("should reject empty path", () => {
      const result = PathSchema.safeParse("");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe("Path cannot be empty");
      }
    });

    it("should reject path with spaces", () => {
      const result = PathSchema.safeParse("mixes/my mix/seg001.mp3");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe(
          "Path contains invalid characters",
        );
      }
    });

    it("should reject path with special characters", () => {
      const result = PathSchema.safeParse("mixes/mix@123/seg001.mp3");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe(
          "Path contains invalid characters",
        );
      }
    });

    it("should reject path with query string", () => {
      const result = PathSchema.safeParse(
        "mixes/abc123/seg001.mp3?param=value",
      );
      expect(result.success).toBe(false);
    });
  });

  describe("UploadAudioInputSchema", () => {
    it("should validate valid input", () => {
      const input = {
        buffer: Buffer.from("test audio data"),
        path: "mixes/abc123/seg001.mp3",
      };

      const result = UploadAudioInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject empty buffer", () => {
      const input = {
        buffer: Buffer.alloc(0),
        path: "mixes/abc123/seg001.mp3",
      };

      const result = UploadAudioInputSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe("Buffer cannot be empty");
      }
    });

    it("should reject missing buffer", () => {
      const input = {
        path: "mixes/abc123/seg001.mp3",
      };

      const result = UploadAudioInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject non-Buffer value", () => {
      const input = {
        buffer: "not a buffer",
        path: "mixes/abc123/seg001.mp3",
      };

      const result = UploadAudioInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject empty path", () => {
      const input = {
        buffer: Buffer.from("test audio data"),
        path: "",
      };

      const result = UploadAudioInputSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe("Path cannot be empty");
      }
    });

    it("should reject invalid path characters", () => {
      const input = {
        buffer: Buffer.from("test audio data"),
        path: "mixes/abc 123/seg001.mp3",
      };

      const result = UploadAudioInputSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe(
          "Path contains invalid characters",
        );
      }
    });

    it("should accept large buffer", () => {
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB
      const input = {
        buffer: largeBuffer,
        path: "mixes/abc123/seg001.mp3",
      };

      const result = UploadAudioInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe("mapGCSError", () => {
    it("should map error with 401 status to non-retryable", () => {
      const error = new Error("Unauthorized") as Error & { code: number };
      error.code = 401;

      const result = mapGCSError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(401);
      expect(result.service).toBe("GCS");
      expect(result.retryable).toBe(false);
    });

    it("should map error with 403 status to non-retryable", () => {
      const error = new Error("Forbidden") as Error & { code: number };
      error.code = 403;

      const result = mapGCSError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(403);
      expect(result.service).toBe("GCS");
      expect(result.retryable).toBe(false);
    });

    it("should map error with 404 status to non-retryable", () => {
      const error = new Error("Not found") as Error & { code: number };
      error.code = 404;

      const result = mapGCSError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(404);
      expect(result.service).toBe("GCS");
      expect(result.retryable).toBe(false);
    });

    it("should map error with 408 status to retryable", () => {
      const error = new Error("Request timeout") as Error & { code: number };
      error.code = 408;

      const result = mapGCSError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(408);
      expect(result.service).toBe("GCS");
      expect(result.retryable).toBe(true);
    });

    it("should map error with 429 status to retryable", () => {
      const error = new Error("Too many requests") as Error & { code: number };
      error.code = 429;

      const result = mapGCSError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(429);
      expect(result.service).toBe("GCS");
      expect(result.retryable).toBe(true);
    });

    it("should map error with 500 status to retryable", () => {
      const error = new Error("Internal server error") as Error & {
        code: number;
      };
      error.code = 500;

      const result = mapGCSError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(500);
      expect(result.service).toBe("GCS");
      expect(result.retryable).toBe(true);
    });

    it("should map error with 502 status to retryable", () => {
      const error = new Error("Bad gateway") as Error & { code: number };
      error.code = 502;

      const result = mapGCSError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(502);
      expect(result.service).toBe("GCS");
      expect(result.retryable).toBe(true);
    });

    it("should map error with 503 status to retryable", () => {
      const error = new Error("Service unavailable") as Error & {
        code: number;
      };
      error.code = 503;

      const result = mapGCSError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(503);
      expect(result.service).toBe("GCS");
      expect(result.retryable).toBe(true);
    });

    it("should map error with 504 status to retryable", () => {
      const error = new Error("Gateway timeout") as Error & { code: number };
      error.code = 504;

      const result = mapGCSError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(504);
      expect(result.service).toBe("GCS");
      expect(result.retryable).toBe(true);
    });

    it("should map ECONNREFUSED error to 503 retryable", () => {
      const error = new Error("Connection refused") as Error & { code: string };
      error.code = "ECONNREFUSED";

      const result = mapGCSError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(503);
      expect(result.service).toBe("GCS");
      expect(result.retryable).toBe(true);
    });

    it("should map ENOTFOUND error to 503 retryable", () => {
      const error = new Error("DNS resolution failed") as Error & {
        code: string;
      };
      error.code = "ENOTFOUND";

      const result = mapGCSError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(503);
      expect(result.service).toBe("GCS");
      expect(result.retryable).toBe(true);
    });

    it("should map ETIMEDOUT error to 503 retryable", () => {
      const error = new Error("Connection timed out") as Error & {
        code: string;
      };
      error.code = "ETIMEDOUT";

      const result = mapGCSError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(503);
      expect(result.service).toBe("GCS");
      expect(result.retryable).toBe(true);
    });

    it("should map ECONNRESET error to 503 retryable", () => {
      const error = new Error("Connection reset") as Error & { code: string };
      error.code = "ECONNRESET";

      const result = mapGCSError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(503);
      expect(result.service).toBe("GCS");
      expect(result.retryable).toBe(true);
    });

    it("should map error with timeout message to 408 retryable", () => {
      const error = new Error("Request timeout occurred");

      const result = mapGCSError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(408);
      expect(result.service).toBe("GCS");
      expect(result.retryable).toBe(true);
    });

    it("should map error with unauthorized message to 401 non-retryable", () => {
      const error = new Error("Unauthorized access denied");

      const result = mapGCSError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(401);
      expect(result.service).toBe("GCS");
      expect(result.retryable).toBe(false);
    });

    it("should map error with invalid credentials message to 401 non-retryable", () => {
      const error = new Error("Invalid credentials provided");

      const result = mapGCSError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(401);
      expect(result.service).toBe("GCS");
      expect(result.retryable).toBe(false);
    });

    it("should map error with permission denied message to 403 non-retryable", () => {
      const error = new Error("Permission denied for this operation");

      const result = mapGCSError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(403);
      expect(result.service).toBe("GCS");
      expect(result.retryable).toBe(false);
    });

    it("should map error with not found message to 404 non-retryable", () => {
      const error = new Error("Bucket not found");

      const result = mapGCSError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(404);
      expect(result.service).toBe("GCS");
      expect(result.retryable).toBe(false);
    });

    it("should map error with status property", () => {
      const error = new Error("Custom error") as Error & { status: number };
      error.status = 503;

      const result = mapGCSError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(503);
      expect(result.service).toBe("GCS");
      expect(result.retryable).toBe(true);
    });

    it("should map error with statusCode property", () => {
      const error = new Error("Custom error") as Error & { statusCode: number };
      error.statusCode = 429;

      const result = mapGCSError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(429);
      expect(result.service).toBe("GCS");
      expect(result.retryable).toBe(true);
    });

    it("should map unknown error to 500 retryable", () => {
      const error = new Error("Something went wrong");

      const result = mapGCSError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(500);
      expect(result.service).toBe("GCS");
      expect(result.retryable).toBe(true);
    });

    it("should handle non-Error objects", () => {
      const error = "string error";

      const result = mapGCSError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(500);
      expect(result.service).toBe("GCS");
      expect(result.message).toBe("string error");
      expect(result.retryable).toBe(true);
    });

    it("should handle null error", () => {
      const error = null;

      const result = mapGCSError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(500);
      expect(result.service).toBe("GCS");
      expect(result.retryable).toBe(true);
    });

    it("should handle undefined error", () => {
      const error = undefined;

      const result = mapGCSError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(500);
      expect(result.service).toBe("GCS");
      expect(result.retryable).toBe(true);
    });
  });
});
