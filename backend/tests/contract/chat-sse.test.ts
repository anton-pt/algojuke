/**
 * Chat SSE Contract Tests
 *
 * Validates SSE event format shapes as defined in contracts/chat-sse.md.
 * These tests ensure event structures match the contract before implementation.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * SSE Event Schemas based on contracts/chat-sse.md
 */

// message_start event
// Note: messageId may be a temp ID (temp-{timestamp}) during streaming,
// or a UUID after the message is persisted. The conversationId is always a UUID.
const MessageStartEventSchema = z.object({
  type: z.literal('message_start'),
  messageId: z.string().min(1), // Can be temp-{timestamp} or UUID
  conversationId: z.string().uuid(),
});

// text_delta event
const TextDeltaEventSchema = z.object({
  type: z.literal('text_delta'),
  content: z.string(),
});

// message_end event
const MessageEndEventSchema = z.object({
  type: z.literal('message_end'),
  usage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
  }),
});

// error event
const ErrorCodeSchema = z.enum([
  'AI_SERVICE_UNAVAILABLE',
  'DATABASE_ERROR',
  'VALIDATION_ERROR',
  'RATE_LIMITED',
  'TIMEOUT',
  'INTERNAL_ERROR',
  'NOT_FOUND',
]);

const ErrorEventSchema = z.object({
  type: z.literal('error'),
  code: ErrorCodeSchema,
  message: z.string().min(1),
  retryable: z.boolean(),
});

// Union of all SSE events
const SSEEventSchema = z.union([
  MessageStartEventSchema,
  TextDeltaEventSchema,
  MessageEndEventSchema,
  ErrorEventSchema,
]);

describe('Chat SSE Contract Tests', () => {
  describe('message_start event', () => {
    it('validates correct message_start event format', () => {
      const event = {
        type: 'message_start',
        messageId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
      };

      expect(() => MessageStartEventSchema.parse(event)).not.toThrow();
    });

    it('requires type to be message_start', () => {
      const event = {
        type: 'wrong_type',
        messageId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
      };

      expect(() => MessageStartEventSchema.parse(event)).toThrow();
    });

    it('accepts temp message ID format', () => {
      const event = {
        type: 'message_start',
        messageId: 'temp-1735600000000',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
      };

      expect(() => MessageStartEventSchema.parse(event)).not.toThrow();
    });

    it('accepts UUID message ID format', () => {
      const event = {
        type: 'message_start',
        messageId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
      };

      expect(() => MessageStartEventSchema.parse(event)).not.toThrow();
    });

    it('rejects empty messageId', () => {
      const event = {
        type: 'message_start',
        messageId: '',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
      };

      expect(() => MessageStartEventSchema.parse(event)).toThrow();
    });

    it('requires valid UUID for conversationId', () => {
      const event = {
        type: 'message_start',
        messageId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        conversationId: 'invalid',
      };

      expect(() => MessageStartEventSchema.parse(event)).toThrow();
    });

    it('requires all fields to be present', () => {
      expect(() => MessageStartEventSchema.parse({ type: 'message_start' })).toThrow();
      expect(() =>
        MessageStartEventSchema.parse({
          type: 'message_start',
          messageId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        })
      ).toThrow();
    });
  });

  describe('text_delta event', () => {
    it('validates correct text_delta event format', () => {
      const event = {
        type: 'text_delta',
        content: 'Here are some ',
      };

      expect(() => TextDeltaEventSchema.parse(event)).not.toThrow();
    });

    it('allows empty content string', () => {
      const event = {
        type: 'text_delta',
        content: '',
      };

      expect(() => TextDeltaEventSchema.parse(event)).not.toThrow();
    });

    it('allows content with newlines and special characters', () => {
      const event = {
        type: 'text_delta',
        content: 'Hello\n\nWorld! 🎵',
      };

      expect(() => TextDeltaEventSchema.parse(event)).not.toThrow();
    });

    it('requires type to be text_delta', () => {
      const event = {
        type: 'wrong_type',
        content: 'test',
      };

      expect(() => TextDeltaEventSchema.parse(event)).toThrow();
    });

    it('requires content field to be present', () => {
      const event = {
        type: 'text_delta',
      };

      expect(() => TextDeltaEventSchema.parse(event)).toThrow();
    });

    it('requires content to be a string', () => {
      const event = {
        type: 'text_delta',
        content: 123,
      };

      expect(() => TextDeltaEventSchema.parse(event)).toThrow();
    });
  });

  describe('message_end event', () => {
    it('validates correct message_end event format', () => {
      const event = {
        type: 'message_end',
        usage: {
          inputTokens: 245,
          outputTokens: 189,
        },
      };

      expect(() => MessageEndEventSchema.parse(event)).not.toThrow();
    });

    it('allows zero tokens', () => {
      const event = {
        type: 'message_end',
        usage: {
          inputTokens: 0,
          outputTokens: 0,
        },
      };

      expect(() => MessageEndEventSchema.parse(event)).not.toThrow();
    });

    it('requires type to be message_end', () => {
      const event = {
        type: 'wrong_type',
        usage: { inputTokens: 100, outputTokens: 100 },
      };

      expect(() => MessageEndEventSchema.parse(event)).toThrow();
    });

    it('requires usage object to be present', () => {
      const event = {
        type: 'message_end',
      };

      expect(() => MessageEndEventSchema.parse(event)).toThrow();
    });

    it('requires inputTokens in usage', () => {
      const event = {
        type: 'message_end',
        usage: { outputTokens: 100 },
      };

      expect(() => MessageEndEventSchema.parse(event)).toThrow();
    });

    it('requires outputTokens in usage', () => {
      const event = {
        type: 'message_end',
        usage: { inputTokens: 100 },
      };

      expect(() => MessageEndEventSchema.parse(event)).toThrow();
    });

    it('requires tokens to be non-negative integers', () => {
      expect(() =>
        MessageEndEventSchema.parse({
          type: 'message_end',
          usage: { inputTokens: -1, outputTokens: 100 },
        })
      ).toThrow();

      expect(() =>
        MessageEndEventSchema.parse({
          type: 'message_end',
          usage: { inputTokens: 100, outputTokens: -5 },
        })
      ).toThrow();

      expect(() =>
        MessageEndEventSchema.parse({
          type: 'message_end',
          usage: { inputTokens: 10.5, outputTokens: 100 },
        })
      ).toThrow();
    });
  });

  describe('error event', () => {
    it('validates correct error event format', () => {
      const event = {
        type: 'error',
        code: 'AI_SERVICE_UNAVAILABLE',
        message: 'The AI service is temporarily unavailable. Please try again.',
        retryable: true,
      };

      expect(() => ErrorEventSchema.parse(event)).not.toThrow();
    });

    it('validates all error codes', () => {
      const errorCodes = [
        'AI_SERVICE_UNAVAILABLE',
        'DATABASE_ERROR',
        'VALIDATION_ERROR',
        'RATE_LIMITED',
        'TIMEOUT',
        'INTERNAL_ERROR',
        'NOT_FOUND',
      ];

      for (const code of errorCodes) {
        const event = {
          type: 'error',
          code,
          message: 'Test error message',
          retryable: false,
        };

        expect(() => ErrorEventSchema.parse(event)).not.toThrow();
      }
    });

    it('rejects invalid error codes', () => {
      const event = {
        type: 'error',
        code: 'UNKNOWN_ERROR',
        message: 'Test error',
        retryable: true,
      };

      expect(() => ErrorEventSchema.parse(event)).toThrow();
    });

    it('requires type to be error', () => {
      const event = {
        type: 'wrong_type',
        code: 'INTERNAL_ERROR',
        message: 'Test',
        retryable: true,
      };

      expect(() => ErrorEventSchema.parse(event)).toThrow();
    });

    it('requires non-empty message', () => {
      const event = {
        type: 'error',
        code: 'INTERNAL_ERROR',
        message: '',
        retryable: true,
      };

      expect(() => ErrorEventSchema.parse(event)).toThrow();
    });

    it('requires retryable to be boolean', () => {
      const event = {
        type: 'error',
        code: 'INTERNAL_ERROR',
        message: 'Test',
        retryable: 'true',
      };

      expect(() => ErrorEventSchema.parse(event)).toThrow();
    });

    it('requires all fields to be present', () => {
      expect(() =>
        ErrorEventSchema.parse({
          type: 'error',
          code: 'INTERNAL_ERROR',
          message: 'Test',
        })
      ).toThrow();

      expect(() =>
        ErrorEventSchema.parse({
          type: 'error',
          code: 'INTERNAL_ERROR',
          retryable: true,
        })
      ).toThrow();
    });
  });

  describe('SSE event union', () => {
    it('discriminates message_start events', () => {
      const event = {
        type: 'message_start',
        messageId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
      };

      const result = SSEEventSchema.parse(event);
      expect(result.type).toBe('message_start');
    });

    it('discriminates text_delta events', () => {
      const event = {
        type: 'text_delta',
        content: 'Hello',
      };

      const result = SSEEventSchema.parse(event);
      expect(result.type).toBe('text_delta');
    });

    it('discriminates message_end events', () => {
      const event = {
        type: 'message_end',
        usage: { inputTokens: 100, outputTokens: 50 },
      };

      const result = SSEEventSchema.parse(event);
      expect(result.type).toBe('message_end');
    });

    it('discriminates error events', () => {
      const event = {
        type: 'error',
        code: 'TIMEOUT',
        message: 'Request timed out',
        retryable: true,
      };

      const result = SSEEventSchema.parse(event);
      expect(result.type).toBe('error');
    });

    it('rejects unknown event types', () => {
      const event = {
        type: 'unknown_event',
        data: 'test',
      };

      expect(() => SSEEventSchema.parse(event)).toThrow();
    });
  });

  describe('SSE format compliance', () => {
    it('events serialize to valid JSON', () => {
      const events = [
        {
          type: 'message_start',
          messageId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          conversationId: '550e8400-e29b-41d4-a716-446655440000',
        },
        { type: 'text_delta', content: 'Hello world' },
        { type: 'message_end', usage: { inputTokens: 100, outputTokens: 50 } },
        { type: 'error', code: 'INTERNAL_ERROR', message: 'Test', retryable: true },
      ];

      for (const event of events) {
        const json = JSON.stringify(event);
        expect(JSON.parse(json)).toEqual(event);
      }
    });

    it('events can be formatted as SSE data lines', () => {
      const event = {
        type: 'text_delta',
        content: 'Test content',
      };

      const sseLine = `data: ${JSON.stringify(event)}\n\n`;
      expect(sseLine).toMatch(/^data: \{.*\}\n\n$/);
    });
  });
});
