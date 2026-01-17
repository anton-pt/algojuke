import "reflect-metadata";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

/**
 * Represents a segment within a radio mix.
 * Segments can be either music tracks or voice narration.
 */
export interface MixSegment {
  id: string;
  type: "music" | "voice";
  startMs: number;
  endMs: number;
  durationMs: number;

  // Music segments (type === "music")
  tidalTrackId?: string;
  isrc?: string;
  trackTitle?: string;
  artistName?: string;
  albumArtUrl?: string;

  // Voice segments (type === "voice")
  audioUrl?: string; // GCS signed URL
  sourceType?: "article" | "highlight" | "newsletter";
  sourceId?: string; // Readwise document ID
  sourceTitle?: string;
  sourceUrl?: string; // Original article URL
  contentMode?: "summary" | "excerpt" | "full";
}

export type MixStatus = "generating" | "ready" | "failed";

/**
 * Mix entity for radio station feature.
 * Stores radio mixes with music tracks and voice segments interleaved.
 */
@Entity("mixes")
@Index(["userId"])
@Index(["status"])
@Index(["updatedAt"])
export class Mix {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "varchar", length: 255 })
  userId!: string;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "text", nullable: true })
  description: string | null = null;

  @Column({ type: "varchar", length: 20, default: "generating" })
  status!: MixStatus;

  @Column({ name: "failure_reason", type: "text", nullable: true })
  failureReason: string | null = null;

  @Column({ type: "jsonb", default: () => "'[]'" })
  segments!: MixSegment[];

  @Column({ name: "total_duration_ms", type: "integer", default: 0 })
  totalDurationMs!: number;

  @Column({ name: "character_count", type: "integer", default: 0 })
  characterCount!: number;

  @Column({
    name: "conversation_id",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  conversationId: string | null = null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
