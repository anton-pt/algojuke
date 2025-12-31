/**
 * Chat Mutations Integration Tests
 *
 * Feature: 010-discover-chat
 * Tasks: T020-IT, T024-IT
 *
 * Tests for GraphQL mutations: deleteConversation, createConversation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataSource, Repository } from 'typeorm';

// Mock TypeORM entities
const mockConversation = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  userId: 'user-123',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockMessages = [
  {
    id: 'msg-1',
    conversationId: '550e8400-e29b-41d4-a716-446655440000',
    role: 'user',
    content: [{ type: 'text', text: 'Hello' }],
    createdAt: new Date(),
  },
  {
    id: 'msg-2',
    conversationId: '550e8400-e29b-41d4-a716-446655440000',
    role: 'assistant',
    content: [{ type: 'text', text: 'Hi there!' }],
    createdAt: new Date(),
  },
];

describe('Chat Mutations Integration Tests', () => {
  describe('T020-IT: deleteConversation cascades messages', () => {
    it('deletes conversation and returns true when found', async () => {
      let deleteWasCalled = false;

      // Mock repository with delete method
      const mockConversationRepo = {
        delete: vi.fn().mockImplementation(async () => {
          deleteWasCalled = true;
          return { affected: 1 };
        }),
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue(mockConversationRepo),
      };

      // Import and test ChatService
      const { ChatService } = await import('../../src/services/chatService.js');
      const chatService = new ChatService(mockDataSource as unknown as DataSource);

      // Delete the conversation
      const result = await chatService.deleteConversation(mockConversation.id);

      // Verify conversation was deleted
      expect(result).toBe(true);
      expect(deleteWasCalled).toBe(true);

      // Verify delete was called with correct id
      expect(mockConversationRepo.delete).toHaveBeenCalledWith({ id: mockConversation.id });
    });

    it('returns false when conversation not found', async () => {
      const mockConversationRepo = {
        delete: vi.fn().mockResolvedValue({ affected: 0 }),
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue(mockConversationRepo),
      };

      const { ChatService } = await import('../../src/services/chatService.js');
      const chatService = new ChatService(mockDataSource as unknown as DataSource);

      const result = await chatService.deleteConversation('nonexistent-id');

      expect(result).toBe(false);
    });

    it('relies on database cascade for message deletion', async () => {
      // Note: The actual cascade is handled by TypeORM entity relations
      // with onDelete: 'CASCADE' on the Message -> Conversation relationship.
      // This test verifies the service calls delete on the conversation.
      const mockConversationRepo = {
        delete: vi.fn().mockResolvedValue({ affected: 1 }),
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue(mockConversationRepo),
      };

      const { ChatService } = await import('../../src/services/chatService.js');
      const chatService = new ChatService(mockDataSource as unknown as DataSource);

      await chatService.deleteConversation(mockConversation.id);

      // Verify only conversation delete is called (cascade handles messages)
      expect(mockConversationRepo.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('T024-IT: createConversation mutation', () => {
    it('creates a new conversation with userId', async () => {
      const createdConversation = {
        id: 'new-conv-id',
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue({
          create: vi.fn().mockReturnValue(createdConversation),
          save: vi.fn().mockResolvedValue(createdConversation),
        }),
        transaction: vi.fn().mockImplementation(async (callback) => {
          const mockManager = {
            create: vi.fn().mockReturnValue(createdConversation),
            save: vi.fn().mockResolvedValue(createdConversation),
          };
          return callback(mockManager);
        }),
      };

      const { ChatService } = await import('../../src/services/chatService.js');
      const chatService = new ChatService(mockDataSource as unknown as DataSource);

      const result = await chatService.createConversation('user-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('new-conv-id');
    });

    it('returns conversation with UUID id', async () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      const createdConversation = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue({
          create: vi.fn().mockReturnValue(createdConversation),
          save: vi.fn().mockResolvedValue(createdConversation),
        }),
        transaction: vi.fn().mockImplementation(async (callback) => {
          const mockManager = {
            create: vi.fn().mockReturnValue(createdConversation),
            save: vi.fn().mockResolvedValue(createdConversation),
          };
          return callback(mockManager);
        }),
      };

      const { ChatService } = await import('../../src/services/chatService.js');
      const chatService = new ChatService(mockDataSource as unknown as DataSource);

      const result = await chatService.createConversation('user-123');

      expect(result.id).toMatch(uuidRegex);
    });

    it('sets createdAt and updatedAt timestamps', async () => {
      const now = new Date();
      const createdConversation = {
        id: 'conv-id',
        userId: 'user-123',
        createdAt: now,
        updatedAt: now,
      };

      const mockDataSource = {
        getRepository: vi.fn().mockReturnValue({
          create: vi.fn().mockReturnValue(createdConversation),
          save: vi.fn().mockResolvedValue(createdConversation),
        }),
        transaction: vi.fn().mockImplementation(async (callback) => {
          const mockManager = {
            create: vi.fn().mockReturnValue(createdConversation),
            save: vi.fn().mockResolvedValue(createdConversation),
          };
          return callback(mockManager);
        }),
      };

      const { ChatService } = await import('../../src/services/chatService.js');
      const chatService = new ChatService(mockDataSource as unknown as DataSource);

      const result = await chatService.createConversation('user-123');

      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });
  });
});
