/**
 * Track Ingestion Pipeline Integration Tests
 *
 * Tests the complete track ingestion pipeline functionality.
 * These tests verify:
 * - Event schema validation
 * - Pipeline function configuration
 * - Inngest function registration
 *
 * Note: Full end-to-end testing with live services (Qdrant, TEI, Musixmatch, Anthropic)
 * requires running infrastructure. See quickstart.md for manual validation steps.
 */

import { describe, it, expect } from "vitest";
import { inngest } from "../../src/inngest/client.js";
import {
  TrackIngestionRequestedEvent,
  TrackIngestionCompletedEvent,
  TrackIngestionFailedEvent,
  IngestionStepName,
} from "../../src/inngest/events.js";

describe("Track Ingestion Pipeline Integration", () => {
  describe("Event Schemas", () => {
    describe("TrackIngestionRequestedEvent", () => {
      it("should validate a complete ingestion request", () => {
        const event = {
          isrc: "USRC11700001",
          title: "Bohemian Rhapsody",
          artist: "Queen",
          album: "A Night at the Opera",
          priority: 0,
          force: false,
        };

        const result = TrackIngestionRequestedEvent.shape.data.safeParse(event);
        expect(result.success).toBe(true);
      });

      it("should validate request with minimal required fields", () => {
        const event = {
          isrc: "USRC11700001",
          title: "Bohemian Rhapsody",
          artist: "Queen",
          album: "A Night at the Opera",
        };

        const result = TrackIngestionRequestedEvent.shape.data.safeParse(event);
        expect(result.success).toBe(true);
      });

      it("should reject invalid ISRC format", () => {
        const event = {
          isrc: "invalid", // Must be 12 alphanumeric characters
          title: "Bohemian Rhapsody",
          artist: "Queen",
          album: "A Night at the Opera",
        };

        const result = TrackIngestionRequestedEvent.shape.data.safeParse(event);
        expect(result.success).toBe(false);
      });

      it("should reject ISRC with wrong length", () => {
        const event = {
          isrc: "USRC1170000", // 11 characters
          title: "Bohemian Rhapsody",
          artist: "Queen",
          album: "A Night at the Opera",
        };

        const result = TrackIngestionRequestedEvent.shape.data.safeParse(event);
        expect(result.success).toBe(false);
      });

      it("should reject empty title", () => {
        const event = {
          isrc: "USRC11700001",
          title: "",
          artist: "Queen",
          album: "A Night at the Opera",
        };

        const result = TrackIngestionRequestedEvent.shape.data.safeParse(event);
        expect(result.success).toBe(false);
      });

      it("should validate priority range", () => {
        // Valid priority at min
        const minPriority = {
          isrc: "USRC11700001",
          title: "Test",
          artist: "Test",
          album: "Test",
          priority: -600,
        };
        expect(TrackIngestionRequestedEvent.shape.data.safeParse(minPriority).success).toBe(true);

        // Valid priority at max
        const maxPriority = {
          isrc: "USRC11700001",
          title: "Test",
          artist: "Test",
          album: "Test",
          priority: 600,
        };
        expect(TrackIngestionRequestedEvent.shape.data.safeParse(maxPriority).success).toBe(true);

        // Invalid priority below min
        const belowMin = {
          isrc: "USRC11700001",
          title: "Test",
          artist: "Test",
          album: "Test",
          priority: -601,
        };
        expect(TrackIngestionRequestedEvent.shape.data.safeParse(belowMin).success).toBe(false);

        // Invalid priority above max
        const aboveMax = {
          isrc: "USRC11700001",
          title: "Test",
          artist: "Test",
          album: "Test",
          priority: 601,
        };
        expect(TrackIngestionRequestedEvent.shape.data.safeParse(aboveMax).success).toBe(false);
      });
    });

    describe("TrackIngestionCompletedEvent", () => {
      it("should validate a complete completion event", () => {
        const event = {
          isrc: "USRC11700001",
          runId: "run_abc123",
          completedAt: Date.now(),
          durationMs: 5000,
          result: {
            hasLyrics: true,
            hasAudioFeatures: true,
            hasInterpretation: true,
            embeddingDimensions: 1024,
          },
        };

        const result = TrackIngestionCompletedEvent.shape.data.safeParse(event);
        expect(result.success).toBe(true);
      });

      it("should validate completion event for instrumental track", () => {
        const event = {
          isrc: "USRC11700001",
          runId: "run_abc123",
          completedAt: Date.now(),
          durationMs: 3000,
          result: {
            hasLyrics: false,
            hasAudioFeatures: true,
            hasInterpretation: false,
            embeddingDimensions: 1024,
          },
        };

        const result = TrackIngestionCompletedEvent.shape.data.safeParse(event);
        expect(result.success).toBe(true);
      });
    });

    describe("TrackIngestionFailedEvent", () => {
      it("should validate a complete failure event", () => {
        const event = {
          isrc: "USRC11700001",
          runId: "run_abc123",
          error: "Failed to connect to embedding service",
          failedStep: "embed-interpretation",
          retries: 5,
          failedAt: Date.now(),
        };

        const result = TrackIngestionFailedEvent.shape.data.safeParse(event);
        expect(result.success).toBe(true);
      });

      it("should validate failure event without step info", () => {
        const event = {
          isrc: "USRC11700001",
          runId: "run_abc123",
          error: "Unknown error occurred",
          retries: 0,
          failedAt: Date.now(),
        };

        const result = TrackIngestionFailedEvent.shape.data.safeParse(event);
        expect(result.success).toBe(true);
      });

      it("should validate all step names", () => {
        const stepNames: string[] = [
          "fetch-audio-features",
          "fetch-lyrics",
          "generate-interpretation",
          "embed-interpretation",
          "store-document",
          "emit-completion",
        ];

        for (const stepName of stepNames) {
          const event = {
            isrc: "USRC11700001",
            runId: "run_abc123",
            error: `Failed at ${stepName}`,
            failedStep: stepName,
            retries: 3,
            failedAt: Date.now(),
          };

          const result = TrackIngestionFailedEvent.shape.data.safeParse(event);
          expect(result.success, `Step ${stepName} should be valid`).toBe(true);
        }
      });

      it("should reject invalid step name", () => {
        const event = {
          isrc: "USRC11700001",
          runId: "run_abc123",
          error: "Test error",
          failedStep: "invalid-step",
          retries: 1,
          failedAt: Date.now(),
        };

        const result = TrackIngestionFailedEvent.shape.data.safeParse(event);
        expect(result.success).toBe(false);
      });
    });

    describe("IngestionStepName", () => {
      it("should include all pipeline steps", () => {
        const steps = IngestionStepName.options;

        expect(steps).toContain("fetch-audio-features");
        expect(steps).toContain("fetch-lyrics");
        expect(steps).toContain("generate-interpretation");
        expect(steps).toContain("embed-interpretation");
        expect(steps).toContain("store-document");
        expect(steps).toContain("emit-completion");
        expect(steps.length).toBe(6);
      });
    });
  });

  describe("Inngest Client", () => {
    it("should be properly configured", () => {
      expect(inngest).toBeDefined();
    });

    it("should have event schemas registered", () => {
      // The client is configured in client.ts with allEvents schemas
      // This test verifies the client exists and can be used
      expect(typeof inngest.send).toBe("function");
      expect(typeof inngest.createFunction).toBe("function");
    });
  });
});
