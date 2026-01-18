/**
 * Mix Service
 *
 * Business logic for radio mix management.
 * Handles CRUD operations for mixes and status transitions.
 */

import { Repository, DataSource } from "typeorm";
import { Mix, MixSegment, MixStatus } from "../entities/Mix.js";
import { logger } from "../utils/logger.js";
import { mapPostgresError } from "../utils/errors.js";

/**
 * Input for creating a new mix
 */
export interface CreateMixInput {
  userId: string;
  title: string;
  description?: string;
  conversationId?: string;
}

/**
 * Input for updating a mix
 */
export interface UpdateMixInput {
  title?: string;
  description?: string;
  segments?: MixSegment[];
  totalDurationMs?: number;
  characterCount?: number;
}

export class MixService {
  private mixRepository: Repository<Mix>;
  private dataSource: DataSource;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
    this.mixRepository = dataSource.getRepository(Mix);
  }

  /**
   * Create a new mix in "generating" status
   */
  async createMix(input: CreateMixInput): Promise<Mix> {
    logger.info("create_mix_start", {
      userId: input.userId,
      title: input.title,
    });

    try {
      const mix = this.mixRepository.create({
        userId: input.userId,
        title: input.title,
        description: input.description ?? null,
        conversationId: input.conversationId ?? null,
        status: "generating",
        segments: [],
        totalDurationMs: 0,
        characterCount: 0,
      });

      const saved = await this.mixRepository.save(mix);
      logger.info("create_mix_success", {
        mixId: saved.id,
        userId: input.userId,
      });
      return saved;
    } catch (error) {
      logger.error("create_mix_failed", {
        userId: input.userId,
        error: String(error),
      });
      throw mapPostgresError(error, "Failed to create mix");
    }
  }

  /**
   * Get a mix by ID with user ownership verification
   */
  async getMix(id: string, userId: string): Promise<Mix | null> {
    logger.info("get_mix", { id, userId });

    try {
      const mix = await this.mixRepository.findOne({ where: { id, userId } });

      if (!mix) {
        logger.info("mix_not_found", { id, userId });
      }

      return mix;
    } catch (error) {
      logger.error("get_mix_failed", { id, userId, error: String(error) });
      throw mapPostgresError(error, "Failed to fetch mix");
    }
  }

  /**
   * Get all mixes for a user, sorted by most recent
   */
  async getMixesByUser(userId: string): Promise<Mix[]> {
    logger.info("get_mixes_by_user", { userId });

    try {
      const mixes = await this.mixRepository.find({
        where: { userId },
        order: { updatedAt: "DESC" },
      });

      logger.info("get_mixes_by_user_success", { userId, count: mixes.length });
      return mixes;
    } catch (error) {
      logger.error("get_mixes_by_user_failed", {
        userId,
        error: String(error),
      });
      throw mapPostgresError(error, "Failed to fetch mixes");
    }
  }

  /**
   * Generic update for mix fields (title, description, segments, etc.)
   * Verifies user ownership before updating.
   */
  async updateMix(
    id: string,
    userId: string,
    updates: UpdateMixInput,
  ): Promise<Mix | null> {
    logger.info("update_mix_start", {
      id,
      userId,
      fields: Object.keys(updates),
    });

    try {
      const existing = await this.mixRepository.findOne({
        where: { id, userId },
      });
      if (!existing) {
        logger.info("update_mix_not_found", { id, userId });
        return null;
      }

      Object.assign(existing, updates);
      const saved = await this.mixRepository.save(existing);

      logger.info("update_mix_success", { id, userId });
      return saved;
    } catch (error) {
      logger.error("update_mix_failed", { id, userId, error: String(error) });
      throw mapPostgresError(error, "Failed to update mix");
    }
  }

  /**
   * Dedicated method for status transitions with optional failure reason.
   * Used by the worker service to update mix generation status.
   * Verifies user ownership before updating.
   */
  async updateMixStatus(
    id: string,
    userId: string,
    status: MixStatus,
    failureReason?: string,
  ): Promise<Mix | null> {
    logger.info("update_mix_status_start", { id, userId, status });

    try {
      const existing = await this.mixRepository.findOne({
        where: { id, userId },
      });
      if (!existing) {
        logger.info("update_mix_status_not_found", { id, userId });
        return null;
      }

      existing.status = status;

      // Only set failure reason when status is "failed"
      if (status === "failed") {
        existing.failureReason = failureReason ?? "Unknown error";
      } else {
        existing.failureReason = null;
      }

      const saved = await this.mixRepository.save(existing);
      logger.info("update_mix_status_success", { id, userId, status });
      return saved;
    } catch (error) {
      logger.error("update_mix_status_failed", {
        id,
        userId,
        status,
        error: String(error),
      });
      throw mapPostgresError(error, "Failed to update mix status");
    }
  }

  // ===========================================================================
  // Internal methods (no user ownership check - for service-to-service calls)
  // ===========================================================================

  /**
   * Get a mix by ID without user ownership verification.
   * Internal use only - for service-to-service operations.
   */
  async getMixById(id: string): Promise<Mix | null> {
    logger.info("get_mix_by_id_internal", { id });

    try {
      const mix = await this.mixRepository.findOne({ where: { id } });

      if (!mix) {
        logger.info("mix_not_found_internal", { id });
      }

      return mix;
    } catch (error) {
      logger.error("get_mix_by_id_internal_failed", {
        id,
        error: String(error),
      });
      throw mapPostgresError(error, "Failed to fetch mix");
    }
  }

  /**
   * Update mix status without user ownership verification.
   * Internal use only - for worker service status updates.
   */
  async updateMixStatusInternal(
    id: string,
    status: MixStatus,
    failureReason?: string,
  ): Promise<Mix | null> {
    logger.info("update_mix_status_internal_start", { id, status });

    try {
      const existing = await this.mixRepository.findOne({ where: { id } });
      if (!existing) {
        logger.info("update_mix_status_internal_not_found", { id });
        return null;
      }

      existing.status = status;

      // Only set failure reason when status is "failed"
      if (status === "failed") {
        existing.failureReason = failureReason ?? "Unknown error";
      } else {
        existing.failureReason = null;
      }

      const saved = await this.mixRepository.save(existing);
      logger.info("update_mix_status_internal_success", { id, status });
      return saved;
    } catch (error) {
      logger.error("update_mix_status_internal_failed", {
        id,
        status,
        error: String(error),
      });
      throw mapPostgresError(error, "Failed to update mix status");
    }
  }

  /**
   * Update mix segments without user ownership verification.
   * Internal use only - for worker service segment updates.
   */
  async updateMixSegmentsInternal(
    id: string,
    segments: MixSegment[],
    totalDurationMs: number,
    characterCount: number,
  ): Promise<Mix | null> {
    logger.info("update_mix_segments_internal_start", {
      id,
      segmentCount: segments.length,
      totalDurationMs,
      characterCount,
    });

    try {
      const existing = await this.mixRepository.findOne({ where: { id } });
      if (!existing) {
        logger.info("update_mix_segments_internal_not_found", { id });
        return null;
      }

      existing.segments = segments;
      existing.totalDurationMs = totalDurationMs;
      existing.characterCount = characterCount;

      const saved = await this.mixRepository.save(existing);
      logger.info("update_mix_segments_internal_success", {
        id,
        segmentCount: segments.length,
      });
      return saved;
    } catch (error) {
      logger.error("update_mix_segments_internal_failed", {
        id,
        error: String(error),
      });
      throw mapPostgresError(error, "Failed to update mix segments");
    }
  }

  /**
   * Delete a mix with user ownership verification
   */
  async deleteMix(id: string, userId: string): Promise<boolean> {
    logger.info("delete_mix_start", { id, userId });

    try {
      const result = await this.mixRepository.delete({ id, userId });

      if (result.affected === 0) {
        logger.info("delete_mix_not_found", { id, userId });
        return false;
      }

      logger.info("delete_mix_success", { id, userId });
      return true;
    } catch (error) {
      logger.error("delete_mix_failed", { id, userId, error: String(error) });
      throw mapPostgresError(error, "Failed to delete mix");
    }
  }
}
