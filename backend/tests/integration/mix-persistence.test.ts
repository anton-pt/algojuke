/**
 * Mix Persistence Integration Tests
 *
 * Feature: Radio Station Phase 1 (ALG-78)
 *
 * Tests for MixService CRUD operations and user isolation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { DataSource } from "typeorm";
import type { MixSegment, MixStatus } from "../../src/entities/Mix.js";

const createMockMix = (overrides = {}) => ({
  id: "550e8400-e29b-41d4-a716-446655440000",
  userId: "user-123",
  title: "Evening Wind-Down",
  description: "Relaxing mix for the evening",
  status: "generating" as MixStatus,
  failureReason: null,
  segments: [] as MixSegment[],
  totalDurationMs: 0,
  characterCount: 0,
  conversationId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("Mix Persistence Integration Tests", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("createMix", () => {
    it("creates a new mix with generating status", async () => {
      const savedMix = createMockMix();

      const mockMixRepo = {
        create: vi.fn().mockReturnValue(savedMix),
        save: vi.fn().mockResolvedValue(savedMix),
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue(mockMixRepo),
      };

      const { MixService } = await import("../../src/services/mixService.js");
      const mixService = new MixService(
        mockDataSource as unknown as DataSource,
      );

      const result = await mixService.createMix({
        userId: "user-123",
        title: "Evening Wind-Down",
        description: "Relaxing mix for the evening",
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(savedMix.id);
      expect(result.status).toBe("generating");
      expect(result.segments).toEqual([]);
      expect(mockMixRepo.create).toHaveBeenCalledWith({
        userId: "user-123",
        title: "Evening Wind-Down",
        description: "Relaxing mix for the evening",
        conversationId: null,
        status: "generating",
        segments: [],
        totalDurationMs: 0,
        characterCount: 0,
      });
    });

    it("creates a mix with conversationId link", async () => {
      const savedMix = createMockMix({ conversationId: "conv-123" });

      const mockMixRepo = {
        create: vi.fn().mockReturnValue(savedMix),
        save: vi.fn().mockResolvedValue(savedMix),
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue(mockMixRepo),
      };

      const { MixService } = await import("../../src/services/mixService.js");
      const mixService = new MixService(
        mockDataSource as unknown as DataSource,
      );

      const result = await mixService.createMix({
        userId: "user-123",
        title: "Chat Mix",
        conversationId: "conv-123",
      });

      expect(result.conversationId).toBe("conv-123");
    });
  });

  describe("getMix", () => {
    it("retrieves a mix by id with user ownership", async () => {
      const mix = createMockMix();

      const mockMixRepo = {
        findOne: vi.fn().mockResolvedValue(mix),
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue(mockMixRepo),
      };

      const { MixService } = await import("../../src/services/mixService.js");
      const mixService = new MixService(
        mockDataSource as unknown as DataSource,
      );

      const result = await mixService.getMix(mix.id, "user-123");

      expect(result).toBeDefined();
      expect(result!.id).toBe(mix.id);
      expect(mockMixRepo.findOne).toHaveBeenCalledWith({
        where: { id: mix.id, userId: "user-123" },
      });
    });

    it("returns null when mix not found", async () => {
      const mockMixRepo = {
        findOne: vi.fn().mockResolvedValue(null),
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue(mockMixRepo),
      };

      const { MixService } = await import("../../src/services/mixService.js");
      const mixService = new MixService(
        mockDataSource as unknown as DataSource,
      );

      const result = await mixService.getMix("nonexistent-id", "user-123");

      expect(result).toBeNull();
    });

    it("returns null when user does not own the mix (user isolation)", async () => {
      // Mix exists but belongs to different user - query with wrong userId returns null
      const mockMixRepo = {
        findOne: vi.fn().mockResolvedValue(null),
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue(mockMixRepo),
      };

      const { MixService } = await import("../../src/services/mixService.js");
      const mixService = new MixService(
        mockDataSource as unknown as DataSource,
      );

      const result = await mixService.getMix("mix-id", "wrong-user");

      expect(result).toBeNull();
      expect(mockMixRepo.findOne).toHaveBeenCalledWith({
        where: { id: "mix-id", userId: "wrong-user" },
      });
    });
  });

  describe("getMixesByUser", () => {
    it("retrieves all mixes for a user sorted by updatedAt DESC", async () => {
      const mixes = [
        createMockMix({ id: "mix-1", updatedAt: new Date("2024-01-02") }),
        createMockMix({ id: "mix-2", updatedAt: new Date("2024-01-01") }),
      ];

      const mockMixRepo = {
        find: vi.fn().mockResolvedValue(mixes),
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue(mockMixRepo),
      };

      const { MixService } = await import("../../src/services/mixService.js");
      const mixService = new MixService(
        mockDataSource as unknown as DataSource,
      );

      const result = await mixService.getMixesByUser("user-123");

      expect(result).toHaveLength(2);
      expect(mockMixRepo.find).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        order: { updatedAt: "DESC" },
      });
    });

    it("returns empty array when user has no mixes", async () => {
      const mockMixRepo = {
        find: vi.fn().mockResolvedValue([]),
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue(mockMixRepo),
      };

      const { MixService } = await import("../../src/services/mixService.js");
      const mixService = new MixService(
        mockDataSource as unknown as DataSource,
      );

      const result = await mixService.getMixesByUser("user-123");

      expect(result).toEqual([]);
    });
  });

  describe("updateMix", () => {
    it("updates mix fields", async () => {
      const existingMix = createMockMix();
      const updatedMix = {
        ...existingMix,
        title: "Updated Title",
        segments: [
          {
            id: "seg-1",
            type: "music" as const,
            startMs: 0,
            endMs: 180000,
            durationMs: 180000,
            trackTitle: "Test Track",
          },
        ],
        totalDurationMs: 180000,
      };

      const mockMixRepo = {
        findOne: vi.fn().mockResolvedValue({ ...existingMix }),
        save: vi.fn().mockResolvedValue(updatedMix),
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue(mockMixRepo),
      };

      const { MixService } = await import("../../src/services/mixService.js");
      const mixService = new MixService(
        mockDataSource as unknown as DataSource,
      );

      const result = await mixService.updateMix(existingMix.id, "user-123", {
        title: "Updated Title",
        segments: updatedMix.segments,
        totalDurationMs: 180000,
      });

      expect(result).toBeDefined();
      expect(result!.title).toBe("Updated Title");
      expect(result!.totalDurationMs).toBe(180000);
    });

    it("returns null when mix not found", async () => {
      const mockMixRepo = {
        findOne: vi.fn().mockResolvedValue(null),
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue(mockMixRepo),
      };

      const { MixService } = await import("../../src/services/mixService.js");
      const mixService = new MixService(
        mockDataSource as unknown as DataSource,
      );

      const result = await mixService.updateMix("nonexistent-id", "user-123", {
        title: "New Title",
      });

      expect(result).toBeNull();
    });
  });

  describe("updateMixStatus", () => {
    it("updates status to ready", async () => {
      const existingMix = createMockMix();
      const updatedMix = { ...existingMix, status: "ready" as MixStatus };

      const mockMixRepo = {
        findOne: vi.fn().mockResolvedValue({ ...existingMix }),
        save: vi.fn().mockResolvedValue(updatedMix),
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue(mockMixRepo),
      };

      const { MixService } = await import("../../src/services/mixService.js");
      const mixService = new MixService(
        mockDataSource as unknown as DataSource,
      );

      const result = await mixService.updateMixStatus(
        existingMix.id,
        "user-123",
        "ready",
      );

      expect(result).toBeDefined();
      expect(result!.status).toBe("ready");
      expect(result!.failureReason).toBeNull();
    });

    it("updates status to failed with failureReason", async () => {
      const existingMix = createMockMix();
      const updatedMix = {
        ...existingMix,
        status: "failed" as MixStatus,
        failureReason: "ElevenLabs API quota exceeded",
      };

      const mockMixRepo = {
        findOne: vi.fn().mockResolvedValue({ ...existingMix }),
        save: vi.fn().mockResolvedValue(updatedMix),
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue(mockMixRepo),
      };

      const { MixService } = await import("../../src/services/mixService.js");
      const mixService = new MixService(
        mockDataSource as unknown as DataSource,
      );

      const result = await mixService.updateMixStatus(
        existingMix.id,
        "user-123",
        "failed",
        "ElevenLabs API quota exceeded",
      );

      expect(result).toBeDefined();
      expect(result!.status).toBe("failed");
      expect(result!.failureReason).toBe("ElevenLabs API quota exceeded");
    });

    it("sets default failure reason when status is failed but no reason provided", async () => {
      const existingMix = createMockMix();

      const mockMixRepo = {
        findOne: vi.fn().mockResolvedValue({ ...existingMix }),
        save: vi.fn().mockImplementation(async (mix) => mix),
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue(mockMixRepo),
      };

      const { MixService } = await import("../../src/services/mixService.js");
      const mixService = new MixService(
        mockDataSource as unknown as DataSource,
      );

      const result = await mixService.updateMixStatus(
        existingMix.id,
        "user-123",
        "failed",
      );

      expect(result!.failureReason).toBe("Unknown error");
    });

    it("clears failureReason when transitioning to non-failed status", async () => {
      const existingMix = createMockMix({
        status: "failed",
        failureReason: "Previous error",
      });

      const mockMixRepo = {
        findOne: vi.fn().mockResolvedValue({ ...existingMix }),
        save: vi.fn().mockImplementation(async (mix) => mix),
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue(mockMixRepo),
      };

      const { MixService } = await import("../../src/services/mixService.js");
      const mixService = new MixService(
        mockDataSource as unknown as DataSource,
      );

      const result = await mixService.updateMixStatus(
        existingMix.id,
        "user-123",
        "ready",
      );

      expect(result!.status).toBe("ready");
      expect(result!.failureReason).toBeNull();
    });

    it("returns null when mix not found", async () => {
      const mockMixRepo = {
        findOne: vi.fn().mockResolvedValue(null),
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue(mockMixRepo),
      };

      const { MixService } = await import("../../src/services/mixService.js");
      const mixService = new MixService(
        mockDataSource as unknown as DataSource,
      );

      const result = await mixService.updateMixStatus(
        "nonexistent-id",
        "user-123",
        "ready",
      );

      expect(result).toBeNull();
    });
  });

  describe("deleteMix", () => {
    it("deletes a mix and returns true", async () => {
      const mockMixRepo = {
        delete: vi.fn().mockResolvedValue({ affected: 1 }),
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue(mockMixRepo),
      };

      const { MixService } = await import("../../src/services/mixService.js");
      const mixService = new MixService(
        mockDataSource as unknown as DataSource,
      );

      const result = await mixService.deleteMix("mix-id", "user-123");

      expect(result).toBe(true);
      expect(mockMixRepo.delete).toHaveBeenCalledWith({
        id: "mix-id",
        userId: "user-123",
      });
    });

    it("returns false when mix not found", async () => {
      const mockMixRepo = {
        delete: vi.fn().mockResolvedValue({ affected: 0 }),
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue(mockMixRepo),
      };

      const { MixService } = await import("../../src/services/mixService.js");
      const mixService = new MixService(
        mockDataSource as unknown as DataSource,
      );

      const result = await mixService.deleteMix("nonexistent-id", "user-123");

      expect(result).toBe(false);
    });

    it("enforces user isolation on delete", async () => {
      const mockMixRepo = {
        delete: vi.fn().mockResolvedValue({ affected: 0 }),
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue(mockMixRepo),
      };

      const { MixService } = await import("../../src/services/mixService.js");
      const mixService = new MixService(
        mockDataSource as unknown as DataSource,
      );

      // Attempt to delete another user's mix
      const result = await mixService.deleteMix("mix-id", "wrong-user");

      expect(result).toBe(false);
      expect(mockMixRepo.delete).toHaveBeenCalledWith({
        id: "mix-id",
        userId: "wrong-user",
      });
    });
  });

  describe("JSONB Segments", () => {
    it("stores music segments correctly", async () => {
      const musicSegment: MixSegment = {
        id: "seg-1",
        type: "music",
        startMs: 0,
        endMs: 180000,
        durationMs: 180000,
        tidalTrackId: "123456",
        isrc: "USRC12345678",
        trackTitle: "Test Track",
        artistName: "Test Artist",
        albumArtUrl: "https://example.com/art.jpg",
      };

      const existingMix = createMockMix();
      const updatedMix = { ...existingMix, segments: [musicSegment] };

      const mockMixRepo = {
        findOne: vi.fn().mockResolvedValue({ ...existingMix }),
        save: vi.fn().mockResolvedValue(updatedMix),
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue(mockMixRepo),
      };

      const { MixService } = await import("../../src/services/mixService.js");
      const mixService = new MixService(
        mockDataSource as unknown as DataSource,
      );

      const result = await mixService.updateMix(existingMix.id, "user-123", {
        segments: [musicSegment],
      });

      expect(result!.segments).toHaveLength(1);
      expect(result!.segments[0].type).toBe("music");
      expect(result!.segments[0].tidalTrackId).toBe("123456");
    });

    it("stores voice segments correctly", async () => {
      const voiceSegment: MixSegment = {
        id: "seg-1",
        type: "voice",
        startMs: 180000,
        endMs: 240000,
        durationMs: 60000,
        audioUrl: "https://storage.example.com/voice.mp3",
        sourceType: "article",
        sourceId: "readwise-123",
        sourceTitle: "Test Article",
        sourceUrl: "https://example.com/article",
        contentMode: "summary",
      };

      const existingMix = createMockMix();
      const updatedMix = { ...existingMix, segments: [voiceSegment] };

      const mockMixRepo = {
        findOne: vi.fn().mockResolvedValue({ ...existingMix }),
        save: vi.fn().mockResolvedValue(updatedMix),
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue(mockMixRepo),
      };

      const { MixService } = await import("../../src/services/mixService.js");
      const mixService = new MixService(
        mockDataSource as unknown as DataSource,
      );

      const result = await mixService.updateMix(existingMix.id, "user-123", {
        segments: [voiceSegment],
      });

      expect(result!.segments).toHaveLength(1);
      expect(result!.segments[0].type).toBe("voice");
      expect(result!.segments[0].sourceType).toBe("article");
    });
  });
});
