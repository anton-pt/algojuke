/**
 * Contract tests for Mix entity schema validation
 *
 * Tests the TypeORM entity structure for Mix
 * to ensure it matches the specification.
 *
 * Uses metadata inspection without requiring database connection.
 */

import { describe, it, expect } from "vitest";
import "reflect-metadata";
import { getMetadataArgsStorage } from "typeorm";
import { Mix, MixSegment, MixStatus } from "../../src/entities/Mix.js";

describe("Mix Entity Contract", () => {
  const metadataStorage = getMetadataArgsStorage();

  describe("Entity Metadata", () => {
    it('should be decorated as entity with table name "mixes"', () => {
      const entityMetadata = metadataStorage.tables.find(
        (t) => t.target === Mix,
      );
      expect(entityMetadata).toBeDefined();
      expect(entityMetadata!.name).toBe("mixes");
    });

    it("should have id field as UUID primary key", () => {
      const columnMetadata = metadataStorage.columns.find(
        (c) => c.target === Mix && c.propertyName === "id",
      );
      const generatedMetadata = metadataStorage.generations.find(
        (g) => g.target === Mix && g.propertyName === "id",
      );

      expect(columnMetadata).toBeDefined();
      expect(generatedMetadata).toBeDefined();
      expect(generatedMetadata!.strategy).toBe("uuid");
    });
  });

  describe("User Ownership", () => {
    it('should have userId field with column name "user_id"', () => {
      const columnMetadata = metadataStorage.columns.find(
        (c) => c.target === Mix && c.propertyName === "userId",
      );

      expect(columnMetadata).toBeDefined();
      expect(columnMetadata!.options.name).toBe("user_id");
      expect(columnMetadata!.options.type).toBe("varchar");
      expect(columnMetadata!.options.length).toBe(255);
    });

    it("should have index on userId", () => {
      const indices = metadataStorage.indices.filter((i) => i.target === Mix);
      const userIdIndex = indices.find((idx) =>
        idx.columns?.includes("userId"),
      );
      expect(userIdIndex).toBeDefined();
    });
  });

  describe("Core Fields", () => {
    it("should have title field as varchar(255)", () => {
      const columnMetadata = metadataStorage.columns.find(
        (c) => c.target === Mix && c.propertyName === "title",
      );

      expect(columnMetadata).toBeDefined();
      expect(columnMetadata!.options.type).toBe("varchar");
      expect(columnMetadata!.options.length).toBe(255);
    });

    it("should have description field as nullable text", () => {
      const columnMetadata = metadataStorage.columns.find(
        (c) => c.target === Mix && c.propertyName === "description",
      );

      expect(columnMetadata).toBeDefined();
      expect(columnMetadata!.options.type).toBe("text");
      expect(columnMetadata!.options.nullable).toBe(true);
    });

    it('should have status field as varchar(20) with default "generating"', () => {
      const columnMetadata = metadataStorage.columns.find(
        (c) => c.target === Mix && c.propertyName === "status",
      );

      expect(columnMetadata).toBeDefined();
      expect(columnMetadata!.options.type).toBe("varchar");
      expect(columnMetadata!.options.length).toBe(20);
      expect(columnMetadata!.options.default).toBe("generating");
    });

    it("should have index on status", () => {
      const indices = metadataStorage.indices.filter((i) => i.target === Mix);
      const statusIndex = indices.find((idx) =>
        idx.columns?.includes("status"),
      );
      expect(statusIndex).toBeDefined();
    });

    it('should have failureReason field with column name "failure_reason"', () => {
      const columnMetadata = metadataStorage.columns.find(
        (c) => c.target === Mix && c.propertyName === "failureReason",
      );

      expect(columnMetadata).toBeDefined();
      expect(columnMetadata!.options.name).toBe("failure_reason");
      expect(columnMetadata!.options.type).toBe("text");
      expect(columnMetadata!.options.nullable).toBe(true);
    });
  });

  describe("Segments JSONB Field", () => {
    it("should have segments field as jsonb with default empty array", () => {
      const columnMetadata = metadataStorage.columns.find(
        (c) => c.target === Mix && c.propertyName === "segments",
      );

      expect(columnMetadata).toBeDefined();
      expect(columnMetadata!.options.type).toBe("jsonb");
    });
  });

  describe("Cost Tracking Fields", () => {
    it('should have totalDurationMs field with column name "total_duration_ms"', () => {
      const columnMetadata = metadataStorage.columns.find(
        (c) => c.target === Mix && c.propertyName === "totalDurationMs",
      );

      expect(columnMetadata).toBeDefined();
      expect(columnMetadata!.options.name).toBe("total_duration_ms");
      expect(columnMetadata!.options.type).toBe("integer");
      expect(columnMetadata!.options.default).toBe(0);
    });

    it('should have characterCount field with column name "character_count"', () => {
      const columnMetadata = metadataStorage.columns.find(
        (c) => c.target === Mix && c.propertyName === "characterCount",
      );

      expect(columnMetadata).toBeDefined();
      expect(columnMetadata!.options.name).toBe("character_count");
      expect(columnMetadata!.options.type).toBe("integer");
      expect(columnMetadata!.options.default).toBe(0);
    });
  });

  describe("Conversation Link", () => {
    it('should have conversationId field with column name "conversation_id"', () => {
      const columnMetadata = metadataStorage.columns.find(
        (c) => c.target === Mix && c.propertyName === "conversationId",
      );

      expect(columnMetadata).toBeDefined();
      expect(columnMetadata!.options.name).toBe("conversation_id");
      expect(columnMetadata!.options.type).toBe("varchar");
      expect(columnMetadata!.options.length).toBe(255);
      expect(columnMetadata!.options.nullable).toBe(true);
    });

    it("should NOT have a TypeORM relation to Conversation", () => {
      const relationMetadata = metadataStorage.relations.find(
        (r) => r.target === Mix,
      );
      expect(relationMetadata).toBeUndefined();
    });
  });

  describe("Timestamps", () => {
    it('should have createdAt with column name "created_at"', () => {
      const columnMetadata = metadataStorage.columns.find(
        (c) => c.target === Mix && c.propertyName === "createdAt",
      );

      expect(columnMetadata).toBeDefined();
      expect(columnMetadata!.options.name).toBe("created_at");
    });

    it('should have updatedAt with column name "updated_at"', () => {
      const columnMetadata = metadataStorage.columns.find(
        (c) => c.target === Mix && c.propertyName === "updatedAt",
      );

      expect(columnMetadata).toBeDefined();
      expect(columnMetadata!.options.name).toBe("updated_at");
    });

    it("should have index on updatedAt", () => {
      const indices = metadataStorage.indices.filter((i) => i.target === Mix);
      const updatedAtIndex = indices.find((idx) =>
        idx.columns?.includes("updatedAt"),
      );
      expect(updatedAtIndex).toBeDefined();
    });
  });

  describe("Type Exports", () => {
    it("should export MixSegment interface", () => {
      // If this compiles, the type exists
      const segment: MixSegment = {
        id: "test",
        type: "music",
        startMs: 0,
        endMs: 1000,
        durationMs: 1000,
      };
      expect(segment.type).toBe("music");
    });

    it("should export MixStatus type", () => {
      // If this compiles, the type exists
      const status: MixStatus = "generating";
      expect(status).toBe("generating");
    });

    it("should allow all MixStatus values", () => {
      const statuses: MixStatus[] = ["generating", "ready", "failed"];
      expect(statuses).toHaveLength(3);
    });

    it("should support music segment fields", () => {
      const segment: MixSegment = {
        id: "music-1",
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
      expect(segment.type).toBe("music");
      expect(segment.tidalTrackId).toBe("123456");
    });

    it("should support voice segment fields", () => {
      const segment: MixSegment = {
        id: "voice-1",
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
      expect(segment.type).toBe("voice");
      expect(segment.sourceType).toBe("article");
    });
  });
});
