/**
 * Chat Service
 *
 * Business logic for conversation and message management.
 * Handles CRUD operations for conversations and messages.
 */

import { Repository, DataSource } from 'typeorm';
import { Conversation } from '../entities/Conversation.js';
import { Message, ContentBlock } from '../entities/Message.js';
import { isTextBlock } from '../schemas/chat.js';

/**
 * Default user ID for single-user mode
 */
export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

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
  async getConversations(userId: string = DEFAULT_USER_ID): Promise<ConversationWithComputed[]> {
    const conversations = await this.conversationRepo.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
      take: MAX_CONVERSATIONS,
      relations: ['messages'],
    });

    return conversations.map(conv => this.toConversationWithComputed(conv));
  }

  /**
   * Get a single conversation with all messages
   */
  async getConversation(id: string): Promise<{ conversation: ConversationWithComputed; messages: Message[] } | null> {
    const conversation = await this.conversationRepo.findOne({
      where: { id },
      relations: ['messages'],
    });

    if (!conversation) {
      return null;
    }

    // Sort messages by created_at ascending
    const sortedMessages = [...conversation.messages].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    return {
      conversation: this.toConversationWithComputed(conversation),
      messages: sortedMessages,
    };
  }

  /**
   * Create a new empty conversation
   */
  async createConversation(userId: string = DEFAULT_USER_ID): Promise<ConversationWithComputed> {
    const conversation = this.conversationRepo.create({
      userId,
      messages: [],
    });
    await this.conversationRepo.save(conversation);

    return this.toConversationWithComputed(conversation);
  }

  /**
   * Delete a conversation and all its messages (cascade)
   */
  async deleteConversation(id: string): Promise<boolean> {
    const result = await this.conversationRepo.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  /**
   * Check if a conversation exists
   */
  async conversationExists(id: string): Promise<boolean> {
    const count = await this.conversationRepo.count({ where: { id } });
    return count > 0;
  }

  /**
   * Create a message within a conversation (with transaction)
   */
  async createMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: ContentBlock[]
  ): Promise<Message> {
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
    userId: string = DEFAULT_USER_ID
  ): Promise<{ conversation: Conversation; userMessage: Message }> {
    return this.dataSource.transaction(async (manager) => {
      const conversation = manager.create(Conversation, {
        userId,
      });
      await manager.save(conversation);

      const userMessage = manager.create(Message, {
        conversationId: conversation.id,
        role: 'user',
        content: [{ type: 'text', text: message }],
      });
      await manager.save(userMessage);

      return { conversation, userMessage };
    });
  }

  /**
   * Add user message to existing conversation
   */
  async addUserMessage(conversationId: string, message: string): Promise<Message> {
    return this.createMessage(conversationId, 'user', [{ type: 'text', text: message }]);
  }

  /**
   * Add assistant message to conversation
   */
  async addAssistantMessage(conversationId: string, content: ContentBlock[]): Promise<Message> {
    return this.createMessage(conversationId, 'assistant', content);
  }

  /**
   * Get conversation messages for LLM context
   */
  async getConversationMessages(conversationId: string): Promise<Message[]> {
    return this.messageRepo.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Convert Conversation entity to GraphQL-ready format with computed fields
   */
  private toConversationWithComputed(conversation: Conversation): ConversationWithComputed {
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
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (!firstUserMessage) {
      return 'New conversation';
    }

    const textBlock = firstUserMessage.content.find(c => isTextBlock(c));
    if (!textBlock || !isTextBlock(textBlock)) {
      return 'New conversation';
    }

    const text = textBlock.text;
    return text.length > PREVIEW_MAX_LENGTH
      ? text.slice(0, PREVIEW_MAX_LENGTH) + '...'
      : text;
  }
}
