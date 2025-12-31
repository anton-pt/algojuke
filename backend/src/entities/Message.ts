import 'reflect-metadata';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Conversation } from './Conversation.js';

/**
 * Content block types for message content.
 * Matches Claude API message structure for future tool support.
 */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: unknown };

/**
 * Message entity representing a single communication within a conversation.
 * Content is stored as JSONB array of content blocks for extensibility.
 */
@Entity('messages')
@Index(['conversationId'])
@Index(['createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @Column({ type: 'varchar', length: '20' })
  role!: 'user' | 'assistant';

  @Column({ type: 'jsonb', default: '[]' })
  content!: ContentBlock[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Conversation;
}
