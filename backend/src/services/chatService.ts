/**
 * Chat Service
 *
 * Business logic for conversation and message management.
 * Handles CRUD operations for conversations and messages.
 */

import { Repository, DataSource } from "typeorm";
import { Conversation } from "../entities/Conversation.js";
import { Message, ContentBlock } from "../entities/Message.js";
import { isTextBlock } from "../schemas/chat.js";
import { logAccessViolation } from "../utils/securityLogger.js";

/**
 * Maximum conversations to return per SC-004
 */
const MAX_CONVERSATIONS = 100;

/**
 * Maximum characters for conversation preview (FR-012)
 */
const PREVIEW_MAX_LENGTH = 50;

/**
 * Conversation with computed fields for GraphQL
 */
export interface ConversationWithComputed {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  preview: string;
  messageCount: number;
}

export class ChatService {
  private conversationRepo: Repository<Conversation>;
  private messageRepo: Repository<Message>;
  private dataSource: DataSource;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
    this.conversationRepo = dataSource.getRepository(Conversation);
    this.messageRepo = dataSource.getRepository(Message);
  }

  /**
   * Get all conversations for a user, sorted by most recent
   */
  async getConversations(userId: string): Promise<ConversationWithComputed[]> {
    const conversations = await this.conversationRepo.find({
      where: { userId },
      order: { updatedAt: "DESC" },
      take: MAX_CONVERSATIONS,
      relations: ["messages"],
    });

    return conversations.map((conv) => this.toConversationWithComputed(conv));
  }

  /**
   * Get a single conversation with all messages
   * Verifies user ownership before returning
   */
  async getConversation(
    id: string,
    userId: string,
  ): Promise<{
    conversation: ConversationWithComputed;
    messages: Message[];
  } | null> {
    const conversation = await this.conversationRepo.findOne({
      where: { id },
      relations: ["messages"],
    });

    if (!conversation) {
      return null;
    }

    // Verify user ownership (T034, FR-027)
    if (conversation.userId !== userId) {
      logAccessViolation(userId, {
        type: "conversation",
        id,
      });
      return null; // Return null as if not found to avoid information leakage
    }

    // Sort messages by created_at ascending
    const sortedMessages = [...conversation.messages].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    return {
      conversation: this.toConversationWithComputed(conversation),
      messages: sortedMessages,
    };
  }

  /**
   * Create a new empty conversation
   */
  async createConversation(userId: string): Promise<ConversationWithComputed> {
    const conversation = this.conversationRepo.create({
      userId,
      messages: [],
    });
    await this.conversationRepo.save(conversation);

    return this.toConversationWithComputed(conversation);
  }

  /**
   * Delete a conversation and all its messages (cascade)
   * Verifies user ownership before deleting
   */
  async deleteConversation(id: string, userId: string): Promise<boolean> {
    // Verify ownership before deleting (T037, FR-027)
    const conversation = await this.conversationRepo.findOne({ where: { id } });

    if (!conversation) {
      return false;
    }

    if (conversation.userId !== userId) {
      logAccessViolation(userId, {
        type: "conversation",
        id,
      });
      return false; // Return false as if not found to avoid information leakage
    }

    const result = await this.conversationRepo.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  /**
   * Check if a conversation exists and belongs to the user
   */
  async conversationExists(id: string, userId: string): Promise<boolean> {
    const count = await this.conversationRepo.count({ where: { id, userId } });
    return count > 0;
  }

  /**
   * Create a message within a conversation (with transaction)
   * Verifies conversation ownership before creating message
   *
   * @param conversationId - The conversation to add the message to
   * @param userId - The authenticated user ID (must own the conversation)
   * @param role - Message role ('user' or 'assistant')
   * @param content - Message content blocks
   * @returns The created message, or null if conversation doesn't exist or user doesn't own it
   */
  async createMessage(
    conversationId: string,
    userId: string,
    role: "user" | "assistant",
    content: ContentBlock[],
  ): Promise<Message | null> {
    // Verify conversation ownership (T038, FR-027)
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      return null;
    }

    if (conversation.userId !== userId) {
      logAccessViolation(userId, {
        type: "conversation",
        id: conversationId,
      });
      return null;
    }

    return this.dataSource.transaction(async (manager) => {
      const message = manager.create(Message, {
        conversationId,
        role,
        content,
      });
      await manager.save(message);

      // Touch conversation updatedAt
      await manager.update(Conversation, conversationId, {
        updatedAt: new Date(),
      });

      return message;
    });
  }

  /**
   * Create conversation with initial user message (for SSE endpoint)
   */
  async createConversationWithMessage(
    message: string,
    userId: string,
  ): Promise<{ conversation: Conversation; userMessage: Message }> {
    return this.dataSource.transaction(async (manager) => {
      const conversation = manager.create(Conversation, {
        userId,
      });
      await manager.save(conversation);

      const userMessage = manager.create(Message, {
        conversationId: conversation.id,
        role: "user",
        content: [{ type: "text", text: message }],
      });
      await manager.save(userMessage);

      return { conversation, userMessage };
    });
  }

  /**
   * Add user message to existing conversation
   * Verifies conversation ownership before adding
   */
  async addUserMessage(
    conversationId: string,
    userId: string,
    message: string,
  ): Promise<Message | null> {
    return this.createMessage(conversationId, userId, "user", [
      { type: "text", text: message },
    ]);
  }

  /**
   * Add assistant message to conversation
   * Verifies conversation ownership before adding
   */
  async addAssistantMessage(
    conversationId: string,
    userId: string,
    content: ContentBlock[],
  ): Promise<Message | null> {
    return this.createMessage(conversationId, userId, "assistant", content);
  }

  /**
   * Get conversation messages for LLM context
   */
  async getConversationMessages(conversationId: string): Promise<Message[]> {
    return this.messageRepo.find({
      where: { conversationId },
      order: { createdAt: "ASC" },
    });
  }

  /**
   * Convert Conversation entity to GraphQL-ready format with computed fields
   */
  private toConversationWithComputed(
    conversation: Conversation,
  ): ConversationWithComputed {
    const messages = conversation.messages || [];

    return {
      id: conversation.id,
      userId: conversation.userId,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      preview: this.getConversationPreview(messages),
      messageCount: messages.length,
    };
  }

  /**
   * Get preview text from first user message
   */
  private getConversationPreview(messages: Message[]): string {
    const firstUserMessage = messages.find((m) => m.role === "user");
    if (!firstUserMessage) {
      return "New conversation";
    }

    const textBlock = firstUserMessage.content.find((c) => isTextBlock(c));
    if (!textBlock || !isTextBlock(textBlock)) {
      return "New conversation";
    }

    const text = textBlock.text;
    return text.length > PREVIEW_MAX_LENGTH
      ? text.slice(0, PREVIEW_MAX_LENGTH) + "..."
      : text;
  }
}
