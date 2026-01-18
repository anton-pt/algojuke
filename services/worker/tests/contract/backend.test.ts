/**
 * Backend Client Contract Tests
 *
 * Feature: ALG-84 - API Key Auth for Service-to-Service Communication
 *
 * Tests the Backend GraphQL API client schema validation.
 * Verifies that the client correctly handles various API responses.
 */

import { describe, it, expect } from "vitest";
import {
  MixStatusSchema,
  SegmentTypeSchema,
  MixSegmentInputSchema,
  MixResponseSchema,
  MixErrorResponseSchema,
  InternalMixResultSchema,
  UpdateMixStatusResponseSchema,
  UpdateMixSegmentsResponseSchema,
} from "../../src/schemas/backend.js";

describe("Backend Client Contract", () => {
  describe("Input Schemas", () => {
    describe("MixStatusSchema", () => {
      it("should accept valid status values", () => {
        expect(MixStatusSchema.safeParse("GENERATING").success).toBe(true);
        expect(MixStatusSchema.safeParse("READY").success).toBe(true);
        expect(MixStatusSchema.safeParse("FAILED").success).toBe(true);
      });

      it("should reject invalid status values", () => {
        expect(MixStatusSchema.safeParse("generating").success).toBe(false);
        expect(MixStatusSchema.safeParse("UNKNOWN").success).toBe(false);
        expect(MixStatusSchema.safeParse("").success).toBe(false);
      });
    });

    describe("SegmentTypeSchema", () => {
      it("should accept valid segment types", () => {
        expect(SegmentTypeSchema.safeParse("MUSIC").success).toBe(true);
        expect(SegmentTypeSchema.safeParse("VOICE").success).toBe(true);
      });

      it("should reject invalid segment types", () => {
        expect(SegmentTypeSchema.safeParse("music").success).toBe(false);
        expect(SegmentTypeSchema.safeParse("OTHER").success).toBe(false);
      });
    });

    describe("MixSegmentInputSchema", () => {
      it("should validate a music segment input", () => {
        const input = {
          id: "seg-1",
          type: "MUSIC",
          startMs: 0,
          endMs: 180000,
          durationMs: 180000,
          tidalTrackId: "12345",
          isrc: "USRC12345678",
          trackTitle: "Test Track",
          artistName: "Test Artist",
          albumArtUrl: "https://example.com/art.jpg",
        };

        const result = MixSegmentInputSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it("should validate a voice segment input", () => {
        const input = {
          id: "seg-2",
          type: "VOICE",
          startMs: 180000,
          endMs: 210000,
          durationMs: 30000,
          audioUrl: "https://storage.example.com/audio.mp3",
          sourceType: "article",
          sourceId: "doc-123",
          sourceTitle: "Test Article",
          sourceUrl: "https://example.com/article",
          contentMode: "summary",
        };

        const result = MixSegmentInputSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it("should validate a minimal segment input", () => {
        const input = {
          id: "seg-3",
          type: "MUSIC",
          startMs: 0,
          endMs: 1000,
          durationMs: 1000,
        };

        const result = MixSegmentInputSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it("should reject missing required fields", () => {
        const input = {
          id: "seg-4",
          type: "MUSIC",
          // Missing startMs, endMs, durationMs
        };

        const result = MixSegmentInputSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it("should reject negative duration values", () => {
        const input = {
          id: "seg-5",
          type: "MUSIC",
          startMs: -1,
          endMs: 1000,
          durationMs: 1001,
        };

        const result = MixSegmentInputSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe("Output Schemas", () => {
    describe("MixResponseSchema", () => {
      it("should validate a complete mix response", () => {
        const response = {
          __typename: "Mix",
          id: "mix-123",
          title: "Test Mix",
          description: "A test mix description",
          status: "READY",
          failureReason: null,
          segments: [
            {
              __typename: "MusicSegment",
              id: "seg-1",
              type: "music",
              startMs: 0,
              endMs: 180000,
              durationMs: 180000,
              tidalTrackId: "12345",
              isrc: "USRC12345678",
              trackTitle: "Test Track",
              artistName: "Test Artist",
              albumArtUrl: "https://example.com/art.jpg",
            },
          ],
          totalDurationMs: 180000,
          characterCount: 0,
          conversationId: "conv-456",
          createdAt: "2024-01-15T10:00:00.000Z",
          updatedAt: "2024-01-15T10:30:00.000Z",
        };

        const result = MixResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });

      it("should validate a mix with voice segments", () => {
        const response = {
          __typename: "Mix",
          id: "mix-124",
          title: "Voice Mix",
          description: null,
          status: "READY",
          failureReason: null,
          segments: [
            {
              __typename: "VoiceSegment",
              id: "seg-2",
              type: "voice",
              startMs: 0,
              endMs: 30000,
              durationMs: 30000,
              audioUrl: "https://storage.example.com/audio.mp3",
              sourceType: "article",
              sourceId: "doc-123",
              sourceTitle: "Test Article",
              sourceUrl: "https://example.com/article",
              contentMode: "summary",
            },
          ],
          totalDurationMs: 30000,
          characterCount: 500,
          conversationId: null,
          createdAt: "2024-01-15T10:00:00.000Z",
          updatedAt: "2024-01-15T10:30:00.000Z",
        };

        const result = MixResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });

      it("should validate a generating mix with empty segments", () => {
        const response = {
          __typename: "Mix",
          id: "mix-125",
          title: "New Mix",
          description: null,
          status: "GENERATING",
          failureReason: null,
          segments: [],
          totalDurationMs: 0,
          characterCount: 0,
          conversationId: null,
          createdAt: "2024-01-15T10:00:00.000Z",
          updatedAt: "2024-01-15T10:00:00.000Z",
        };

        const result = MixResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });

      it("should validate a failed mix with failure reason", () => {
        const response = {
          __typename: "Mix",
          id: "mix-126",
          title: "Failed Mix",
          description: null,
          status: "FAILED",
          failureReason: "Content generation failed due to API timeout",
          segments: [],
          totalDurationMs: 0,
          characterCount: 0,
          conversationId: null,
          createdAt: "2024-01-15T10:00:00.000Z",
          updatedAt: "2024-01-15T10:05:00.000Z",
        };

        const result = MixResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });
    });

    describe("MixErrorResponseSchema", () => {
      it("should validate NOT_FOUND error", () => {
        const response = {
          __typename: "MixError",
          message: "Mix not found",
          code: "NOT_FOUND",
          retryable: false,
        };

        const result = MixErrorResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });

      it("should validate UNAUTHORIZED error", () => {
        const response = {
          __typename: "MixError",
          message: "Service authentication required",
          code: "UNAUTHORIZED",
          retryable: false,
        };

        const result = MixErrorResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });

      it("should validate DATABASE_ERROR (retryable)", () => {
        const response = {
          __typename: "MixError",
          message: "Failed to update mix. Please try again.",
          code: "DATABASE_ERROR",
          retryable: true,
        };

        const result = MixErrorResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });

      it("should validate INTERNAL_ERROR", () => {
        const response = {
          __typename: "MixError",
          message: "An unexpected error occurred",
          code: "INTERNAL_ERROR",
          retryable: false,
        };

        const result = MixErrorResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });
    });

    describe("InternalMixResultSchema", () => {
      it("should validate Mix success result", () => {
        const response = {
          __typename: "Mix",
          id: "mix-127",
          title: "Test Mix",
          description: null,
          status: "READY",
          failureReason: null,
          segments: [],
          totalDurationMs: 0,
          characterCount: 0,
          conversationId: null,
          createdAt: "2024-01-15T10:00:00.000Z",
          updatedAt: "2024-01-15T10:00:00.000Z",
        };

        const result = InternalMixResultSchema.safeParse(response);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.__typename).toBe("Mix");
        }
      });

      it("should validate MixError result", () => {
        const response = {
          __typename: "MixError",
          message: "Mix not found",
          code: "NOT_FOUND",
          retryable: false,
        };

        const result = InternalMixResultSchema.safeParse(response);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.__typename).toBe("MixError");
        }
      });
    });
  });

  describe("GraphQL Response Wrappers", () => {
    describe("UpdateMixStatusResponseSchema", () => {
      it("should validate successful response", () => {
        const response = {
          data: {
            internalUpdateMixStatus: {
              __typename: "Mix",
              id: "mix-128",
              title: "Updated Mix",
              description: null,
              status: "READY",
              failureReason: null,
              segments: [],
              totalDurationMs: 0,
              characterCount: 0,
              conversationId: null,
              createdAt: "2024-01-15T10:00:00.000Z",
              updatedAt: "2024-01-15T10:30:00.000Z",
            },
          },
        };

        const result = UpdateMixStatusResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });

      it("should validate error response", () => {
        const response = {
          data: {
            internalUpdateMixStatus: {
              __typename: "MixError",
              message: "Mix not found",
              code: "NOT_FOUND",
              retryable: false,
            },
          },
        };

        const result = UpdateMixStatusResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });

      it("should validate GraphQL error response", () => {
        const response = {
          data: null,
          errors: [
            {
              message: "Service authentication required",
              locations: [{ line: 1, column: 1 }],
              path: ["internalUpdateMixStatus"],
              extensions: { code: "UNAUTHENTICATED" },
            },
          ],
        };

        const result = UpdateMixStatusResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });
    });

    describe("UpdateMixSegmentsResponseSchema", () => {
      it("should validate successful response with segments", () => {
        const response = {
          data: {
            internalUpdateMixSegments: {
              __typename: "Mix",
              id: "mix-129",
              title: "Mix with Segments",
              description: null,
              status: "READY",
              failureReason: null,
              segments: [
                {
                  __typename: "MusicSegment",
                  id: "seg-1",
                  type: "music",
                  startMs: 0,
                  endMs: 180000,
                  durationMs: 180000,
                  tidalTrackId: "12345",
                  isrc: "USRC12345678",
                  trackTitle: "Test Track",
                  artistName: "Test Artist",
                  albumArtUrl: null,
                },
                {
                  __typename: "VoiceSegment",
                  id: "seg-2",
                  type: "voice",
                  startMs: 180000,
                  endMs: 210000,
                  durationMs: 30000,
                  audioUrl: "https://storage.example.com/audio.mp3",
                  sourceType: "article",
                  sourceId: null,
                  sourceTitle: "Test Article",
                  sourceUrl: null,
                  contentMode: "summary",
                },
              ],
              totalDurationMs: 210000,
              characterCount: 500,
              conversationId: null,
              createdAt: "2024-01-15T10:00:00.000Z",
              updatedAt: "2024-01-15T10:30:00.000Z",
            },
          },
        };

        const result = UpdateMixSegmentsResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });

      it("should validate error response", () => {
        const response = {
          data: {
            internalUpdateMixSegments: {
              __typename: "MixError",
              message: "Mix not found",
              code: "NOT_FOUND",
              retryable: false,
            },
          },
        };

        const result = UpdateMixSegmentsResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });
    });
  });

  describe("Mixed Segment Arrays", () => {
    it("should validate array with both music and voice segments", () => {
      const mixResponse = {
        __typename: "Mix",
        id: "mix-130",
        title: "Mixed Content",
        description: null,
        status: "READY",
        failureReason: null,
        segments: [
          {
            __typename: "MusicSegment",
            id: "seg-1",
            type: "music",
            startMs: 0,
            endMs: 180000,
            durationMs: 180000,
            tidalTrackId: "12345",
            isrc: null,
            trackTitle: "Intro Track",
            artistName: "Artist 1",
            albumArtUrl: null,
          },
          {
            __typename: "VoiceSegment",
            id: "seg-2",
            type: "voice",
            startMs: 180000,
            endMs: 210000,
            durationMs: 30000,
            audioUrl: "https://storage.example.com/voice1.mp3",
            sourceType: "article",
            sourceId: "doc-1",
            sourceTitle: "News Update",
            sourceUrl: null,
            contentMode: "summary",
          },
          {
            __typename: "MusicSegment",
            id: "seg-3",
            type: "music",
            startMs: 210000,
            endMs: 390000,
            durationMs: 180000,
            tidalTrackId: "67890",
            isrc: "USRC98765432",
            trackTitle: "Main Track",
            artistName: "Artist 2",
            albumArtUrl: "https://example.com/art2.jpg",
          },
        ],
        totalDurationMs: 390000,
        characterCount: 250,
        conversationId: "conv-789",
        createdAt: "2024-01-15T10:00:00.000Z",
        updatedAt: "2024-01-15T10:30:00.000Z",
      };

      const result = MixResponseSchema.safeParse(mixResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.segments).toHaveLength(3);
        expect(result.data.segments[0].__typename).toBe("MusicSegment");
        expect(result.data.segments[1].__typename).toBe("VoiceSegment");
        expect(result.data.segments[2].__typename).toBe("MusicSegment");
      }
    });
  });
});
