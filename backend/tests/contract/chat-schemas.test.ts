/**
 * Contract tests for Chat Zod schema validation
 *
 * Tests the Zod schemas for ContentBlock, Message, and ChatStreamRequest
 * to ensure they match the data-model.md specification.
 */

import { describe, it, expect } from 'vitest';
import {
  ContentBlockSchema,
  MessageSchema,
  ChatStreamRequestSchema,
  type ContentBlock,
  type Message,
  type ChatStreamRequest,
} from '../../src/schemas/chat.js';

describe('Chat Zod Schemas Contract', () => {
  describe('ContentBlockSchema', () => {
    describe('text type', () => {
      it('should accept valid text block', () => {
        const block = { type: 'text', text: 'Hello world' };
        const result = ContentBlockSchema.safeParse(block);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.type).toBe('text');
          expect((result.data as { type: 'text'; text: string }).text).toBe('Hello world');
        }
      });

      it('should reject text block with empty text', () => {
        const block = { type: 'text', text: '' };
        const result = ContentBlockSchema.safeParse(block);

        expect(result.success).toBe(false);
      });

      it('should reject text block without text field', () => {
        const block = { type: 'text' };
        const result = ContentBlockSchema.safeParse(block);

        expect(result.success).toBe(false);
      });
    });

    describe('tool_use type', () => {
      it('should accept valid tool_use block', () => {
        const block = {
          type: 'tool_use',
          id: 'toolu_123',
          name: 'search_library',
          input: { query: 'jazz' },
        };
        const result = ContentBlockSchema.safeParse(block);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.type).toBe('tool_use');
        }
      });

      it('should reject tool_use block without id', () => {
        const block = {
          type: 'tool_use',
          name: 'search_library',
          input: { query: 'jazz' },
        };
        const result = ContentBlockSchema.safeParse(block);

        expect(result.success).toBe(false);
      });

      it('should reject tool_use block without name', () => {
        const block = {
          type: 'tool_use',
          id: 'toolu_123',
          input: { query: 'jazz' },
        };
        const result = ContentBlockSchema.safeParse(block);

        expect(result.success).toBe(false);
      });
    });

    describe('tool_result type', () => {
      it('should accept valid tool_result block', () => {
        const block = {
          type: 'tool_result',
          tool_use_id: 'toolu_123',
          content: { tracks: ['track1', 'track2'] },
        };
        const result = ContentBlockSchema.safeParse(block);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.type).toBe('tool_result');
        }
      });

      it('should reject tool_result block without tool_use_id', () => {
        const block = {
          type: 'tool_result',
          content: { tracks: [] },
        };
        const result = ContentBlockSchema.safeParse(block);

        expect(result.success).toBe(false);
      });
    });

    describe('invalid types', () => {
      it('should reject unknown block type', () => {
        const block = { type: 'image', url: 'http://example.com' };
        const result = ContentBlockSchema.safeParse(block);

        expect(result.success).toBe(false);
      });
    });
  });

  describe('MessageSchema', () => {
    it('should accept valid user message', () => {
      const message = {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
      };
      const result = MessageSchema.safeParse(message);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('user');
        expect(result.data.content).toHaveLength(1);
      }
    });

    it('should accept valid assistant message', () => {
      const message = {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hi there!' }],
      };
      const result = MessageSchema.safeParse(message);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('assistant');
      }
    });

    it('should accept message with multiple content blocks', () => {
      const message = {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me search for that...' },
          { type: 'tool_use', id: 'toolu_1', name: 'search', input: {} },
        ],
      };
      const result = MessageSchema.safeParse(message);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toHaveLength(2);
      }
    });

    it('should reject message with empty content', () => {
      const message = {
        role: 'user',
        content: [],
      };
      const result = MessageSchema.safeParse(message);

      expect(result.success).toBe(false);
    });

    it('should reject message with invalid role', () => {
      const message = {
        role: 'system',
        content: [{ type: 'text', text: 'Hello' }],
      };
      const result = MessageSchema.safeParse(message);

      expect(result.success).toBe(false);
    });
  });

  describe('ChatStreamRequestSchema', () => {
    it('should accept valid request without conversationId', () => {
      const request = { message: 'Hello, can you help me?' };
      const result = ChatStreamRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toBe('Hello, can you help me?');
        expect(result.data.conversationId).toBeUndefined();
      }
    });

    it('should accept valid request with conversationId', () => {
      const request = {
        message: 'Continue our chat',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
      };
      const result = ChatStreamRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.conversationId).toBe('550e8400-e29b-41d4-a716-446655440000');
      }
    });

    it('should reject empty message', () => {
      const request = { message: '' };
      const result = ChatStreamRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
    });

    it('should reject whitespace-only message', () => {
      const request = { message: '   \n\t   ' };
      const result = ChatStreamRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
    });

    it('should reject message exceeding 10000 characters', () => {
      const request = { message: 'a'.repeat(10001) };
      const result = ChatStreamRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
    });

    it('should accept message at exactly 10000 characters', () => {
      const request = { message: 'a'.repeat(10000) };
      const result = ChatStreamRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID for conversationId', () => {
      const request = {
        message: 'Hello',
        conversationId: 'not-a-uuid',
      };
      const result = ChatStreamRequestSchema.safeParse(request);

      expect(result.success).toBe(false);
    });

    it('should trim whitespace from message for validation', () => {
      // Even with leading/trailing whitespace, the message should be validated
      const request = { message: '  Hello world  ' };
      const result = ChatStreamRequestSchema.safeParse(request);

      expect(result.success).toBe(true);
    });
  });

  describe('Type exports', () => {
    it('should export ContentBlock type', () => {
      const block: ContentBlock = { type: 'text', text: 'test' };
      expect(block.type).toBe('text');
    });

    it('should export Message type', () => {
      const message: Message = {
        role: 'user',
        content: [{ type: 'text', text: 'test' }],
      };
      expect(message.role).toBe('user');
    });

    it('should export ChatStreamRequest type', () => {
      const request: ChatStreamRequest = { message: 'test' };
      expect(request.message).toBe('test');
    });
  });
});
