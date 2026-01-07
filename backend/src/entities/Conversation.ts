import "reflect-metadata";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
  Relation,
} from "typeorm";
import type { Message } from "./Message.js";

/**
 * Conversation entity for chat sessions between user and AI assistant.
 * The id is also used as Langfuse session ID for trace grouping.
 */
@Entity("conversations")
@Index(["userId"])
@Index(["updatedAt"])
export class Conversation {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "varchar", length: 255 })
  userId!: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @OneToMany("Message", "conversation", {
    cascade: true,
    onDelete: "CASCADE",
  })
  messages!: Relation<Message[]>;
}
