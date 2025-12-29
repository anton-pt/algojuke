/**
 * Musixmatch Client Contract Tests
 *
 * Tests the Musixmatch API client response schema validation.
 * These tests verify that the client correctly handles various API responses.
 */

import { describe, it, expect } from "vitest";
import { MusixmatchLyricsResponseSchema } from "../../src/clients/musixmatch.js";

describe("Musixmatch Client Contract", () => {
  describe("Lyrics Response Schema", () => {
    it("should validate a complete lyrics response", () => {
      const response = {
        message: {
          header: {
            status_code: 200,
            execute_time: 0.023,
          },
          body: {
            lyrics: {
              lyrics_id: 12345678,
              lyrics_body: "Is this the real life?\nIs this just fantasy?\nCaught in a landslide\nNo escape from reality",
              lyrics_language: "en",
              explicit: 0,
              lyrics_copyright: "Licensed to MusixMatch",
              updated_time: "2024-01-15T10:30:00Z",
            },
          },
        },
      };

      const result = MusixmatchLyricsResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it("should validate response with minimal lyrics data", () => {
      const response = {
        message: {
          header: {
            status_code: 200,
            execute_time: 0.015,
          },
          body: {
            lyrics: {
              lyrics_id: 12345678,
              lyrics_body: "Some lyrics here",
            },
          },
        },
      };

      const result = MusixmatchLyricsResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it("should validate response with no lyrics (instrumental)", () => {
      const response = {
        message: {
          header: {
            status_code: 200,
            execute_time: 0.010,
          },
          body: {},
        },
      };

      const result = MusixmatchLyricsResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it("should validate 404 not found response", () => {
      const response = {
        message: {
          header: {
            status_code: 404,
            execute_time: 0.005,
          },
          body: {},
        },
      };

      const result = MusixmatchLyricsResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it("should validate 401 unauthorized response", () => {
      const response = {
        message: {
          header: {
            status_code: 401,
            execute_time: 0.003,
          },
          body: {},
        },
      };

      const result = MusixmatchLyricsResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it("should validate 429 rate limit response", () => {
      const response = {
        message: {
          header: {
            status_code: 429,
            execute_time: 0.002,
          },
          body: {},
        },
      };

      const result = MusixmatchLyricsResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it("should reject missing header", () => {
      const response = {
        message: {
          body: {
            lyrics: {
              lyrics_id: 12345678,
              lyrics_body: "Some lyrics",
            },
          },
        },
      };

      const result = MusixmatchLyricsResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it("should reject missing status_code in header", () => {
      const response = {
        message: {
          header: {
            execute_time: 0.010,
          },
          body: {},
        },
      };

      const result = MusixmatchLyricsResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it("should validate explicit lyrics flag", () => {
      const response = {
        message: {
          header: {
            status_code: 200,
            execute_time: 0.020,
          },
          body: {
            lyrics: {
              lyrics_id: 12345678,
              lyrics_body: "Explicit content here",
              explicit: 1,
            },
          },
        },
      };

      const result = MusixmatchLyricsResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message.body.lyrics?.explicit).toBe(1);
      }
    });
  });
});
