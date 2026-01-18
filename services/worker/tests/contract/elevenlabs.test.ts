/**
 * ElevenLabs Client Contract Tests
 *
 * Tests the ElevenLabs TTS client input validation schemas and error mapping.
 * These tests verify that the client correctly validates inputs and maps SDK errors.
 *
 * Note: Integration tests that make real API calls are out of scope
 * as they would incur costs against the ElevenLabs API quota.
 */

import { describe, it, expect } from "vitest";
import {
  GenerateSpeechInputSchema,
  VoiceSettingsSchema,
  mapSdkError,
} from "../../src/clients/elevenlabs.js";
import {
  ElevenLabsError,
  ElevenLabsTimeoutError,
} from "@elevenlabs/elevenlabs-js";
import { APIError } from "../../src/clients/errors.js";

describe("ElevenLabs Client Contract", () => {
  describe("GenerateSpeechInputSchema", () => {
    it("should validate valid input", () => {
      const input = {
        text: "Hello, this is a test message.",
        voiceId: "21m00Tcm4TlvDq8ikWAM",
      };

      const result = GenerateSpeechInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should validate input with all options", () => {
      const input = {
        text: "Hello, this is a test message.",
        voiceId: "21m00Tcm4TlvDq8ikWAM",
        voiceSettings: {
          stability: 0.5,
          similarityBoost: 0.75,
          style: 0.3,
          useSpeakerBoost: true,
        },
        modelId: "eleven_multilingual_v2",
        outputFormat: "mp3_44100_128",
      };

      const result = GenerateSpeechInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject empty text", () => {
      const input = {
        text: "",
        voiceId: "21m00Tcm4TlvDq8ikWAM",
      };

      const result = GenerateSpeechInputSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe("Text cannot be empty");
      }
    });

    it("should reject text that is too long", () => {
      const input = {
        text: "a".repeat(5001),
        voiceId: "21m00Tcm4TlvDq8ikWAM",
      };

      const result = GenerateSpeechInputSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain("Text too long");
      }
    });

    it("should accept text at max length", () => {
      const input = {
        text: "a".repeat(5000),
        voiceId: "21m00Tcm4TlvDq8ikWAM",
      };

      const result = GenerateSpeechInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject empty voice ID", () => {
      const input = {
        text: "Hello, this is a test message.",
        voiceId: "",
      };

      const result = GenerateSpeechInputSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe("Voice ID required");
      }
    });

    it("should reject missing voice ID", () => {
      const input = {
        text: "Hello, this is a test message.",
      };

      const result = GenerateSpeechInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("VoiceSettingsSchema", () => {
    it("should validate valid voice settings", () => {
      const settings = {
        stability: 0.5,
        similarityBoost: 0.75,
        style: 0.3,
        useSpeakerBoost: true,
      };

      const result = VoiceSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
    });

    it("should allow undefined (optional)", () => {
      const result = VoiceSettingsSchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });

    it("should allow empty object", () => {
      const result = VoiceSettingsSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should reject stability below 0", () => {
      const settings = {
        stability: -0.1,
      };

      const result = VoiceSettingsSchema.safeParse(settings);
      expect(result.success).toBe(false);
    });

    it("should reject stability above 1", () => {
      const settings = {
        stability: 1.1,
      };

      const result = VoiceSettingsSchema.safeParse(settings);
      expect(result.success).toBe(false);
    });

    it("should accept stability at boundaries", () => {
      expect(VoiceSettingsSchema.safeParse({ stability: 0 }).success).toBe(
        true,
      );
      expect(VoiceSettingsSchema.safeParse({ stability: 1 }).success).toBe(
        true,
      );
    });

    it("should reject similarityBoost below 0", () => {
      const settings = {
        similarityBoost: -0.1,
      };

      const result = VoiceSettingsSchema.safeParse(settings);
      expect(result.success).toBe(false);
    });

    it("should reject similarityBoost above 1", () => {
      const settings = {
        similarityBoost: 1.1,
      };

      const result = VoiceSettingsSchema.safeParse(settings);
      expect(result.success).toBe(false);
    });

    it("should reject style below 0", () => {
      const settings = {
        style: -0.1,
      };

      const result = VoiceSettingsSchema.safeParse(settings);
      expect(result.success).toBe(false);
    });

    it("should reject style above 1", () => {
      const settings = {
        style: 1.1,
      };

      const result = VoiceSettingsSchema.safeParse(settings);
      expect(result.success).toBe(false);
    });

    it("should accept useSpeakerBoost boolean", () => {
      expect(
        VoiceSettingsSchema.safeParse({ useSpeakerBoost: true }).success,
      ).toBe(true);
      expect(
        VoiceSettingsSchema.safeParse({ useSpeakerBoost: false }).success,
      ).toBe(true);
    });

    it("should reject non-boolean useSpeakerBoost", () => {
      const settings = {
        useSpeakerBoost: "true" as unknown as boolean,
      };

      const result = VoiceSettingsSchema.safeParse(settings);
      expect(result.success).toBe(false);
    });
  });

  describe("mapSdkError", () => {
    it("should map ElevenLabsTimeoutError to 408 retryable", () => {
      const error = new ElevenLabsTimeoutError({});

      const result = mapSdkError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(408);
      expect(result.service).toBe("ElevenLabs");
      expect(result.message).toBe("Request timeout");
      expect(result.retryable).toBe(true);
    });

    it("should map ElevenLabsError with 401 to non-retryable", () => {
      const error = new ElevenLabsError({
        message: "Unauthorized - Invalid API key",
        statusCode: 401,
      });

      const result = mapSdkError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(401);
      expect(result.service).toBe("ElevenLabs");
      expect(result.retryable).toBe(false);
    });

    it("should map ElevenLabsError with 403 to non-retryable", () => {
      const error = new ElevenLabsError({
        message: "Forbidden - Plan restriction",
        statusCode: 403,
      });

      const result = mapSdkError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(403);
      expect(result.service).toBe("ElevenLabs");
      expect(result.retryable).toBe(false);
    });

    it("should map ElevenLabsError with 429 to retryable", () => {
      const error = new ElevenLabsError({
        message: "Too many concurrent requests",
        statusCode: 429,
      });

      const result = mapSdkError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(429);
      expect(result.service).toBe("ElevenLabs");
      expect(result.retryable).toBe(true);
    });

    it("should map ElevenLabsError with 500 to retryable", () => {
      const error = new ElevenLabsError({
        message: "Internal server error",
        statusCode: 500,
      });

      const result = mapSdkError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(500);
      expect(result.service).toBe("ElevenLabs");
      expect(result.retryable).toBe(true);
    });

    it("should map ElevenLabsError with 502 to retryable", () => {
      const error = new ElevenLabsError({
        message: "Bad gateway",
        statusCode: 502,
      });

      const result = mapSdkError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(502);
      expect(result.service).toBe("ElevenLabs");
      expect(result.retryable).toBe(true);
    });

    it("should map ElevenLabsError with 503 to retryable", () => {
      const error = new ElevenLabsError({
        message: "Service unavailable",
        statusCode: 503,
      });

      const result = mapSdkError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(503);
      expect(result.service).toBe("ElevenLabs");
      expect(result.retryable).toBe(true);
    });

    it("should map ElevenLabsError without statusCode to 500 retryable", () => {
      const error = new ElevenLabsError({
        message: "Unknown error",
      });

      const result = mapSdkError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(500);
      expect(result.service).toBe("ElevenLabs");
      expect(result.retryable).toBe(true);
    });

    it("should map generic error with timeout message to 408 retryable", () => {
      const error = new Error("Connection timeout occurred");

      const result = mapSdkError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(408);
      expect(result.service).toBe("ElevenLabs");
      expect(result.retryable).toBe(true);
    });

    it("should map error with statusCode property", () => {
      const error = new Error("Custom error") as Error & { statusCode: number };
      error.statusCode = 422;

      const result = mapSdkError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(422);
      expect(result.service).toBe("ElevenLabs");
      expect(result.retryable).toBe(false);
    });

    it("should map error with status property", () => {
      const error = new Error("Custom error") as Error & { status: number };
      error.status = 503;

      const result = mapSdkError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(503);
      expect(result.service).toBe("ElevenLabs");
      expect(result.retryable).toBe(true);
    });

    it("should map UnprocessableEntityError by name to 422 non-retryable", () => {
      const error = new Error("Validation failed");
      error.name = "UnprocessableEntityError";

      const result = mapSdkError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(422);
      expect(result.service).toBe("ElevenLabs");
      expect(result.retryable).toBe(false);
    });

    it("should map error with Unprocessable message to 422 non-retryable", () => {
      const error = new Error("Unprocessable entity: invalid voice ID");

      const result = mapSdkError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(422);
      expect(result.service).toBe("ElevenLabs");
      expect(result.retryable).toBe(false);
    });

    it("should map error with validation message to 422 non-retryable", () => {
      const error = new Error("validation error: text is required");

      const result = mapSdkError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(422);
      expect(result.service).toBe("ElevenLabs");
      expect(result.retryable).toBe(false);
    });

    it("should map unknown error to 500 retryable", () => {
      const error = new Error("Something went wrong");

      const result = mapSdkError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(500);
      expect(result.service).toBe("ElevenLabs");
      expect(result.retryable).toBe(true);
    });

    it("should handle non-Error objects", () => {
      const error = "string error";

      const result = mapSdkError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(500);
      expect(result.service).toBe("ElevenLabs");
      expect(result.message).toBe("string error");
      expect(result.retryable).toBe(true);
    });

    it("should handle null error", () => {
      const error = null;

      const result = mapSdkError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(500);
      expect(result.service).toBe("ElevenLabs");
      expect(result.retryable).toBe(true);
    });

    it("should handle undefined error", () => {
      const error = undefined;

      const result = mapSdkError(error);

      expect(result).toBeInstanceOf(APIError);
      expect(result.statusCode).toBe(500);
      expect(result.service).toBe("ElevenLabs");
      expect(result.retryable).toBe(true);
    });
  });
});
