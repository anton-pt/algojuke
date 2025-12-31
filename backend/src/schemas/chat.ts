/**
 * Zod schemas for chat validation
 *
 * These schemas are used to validate:
 * - Message content blocks (text, tool_use, tool_result)
 * - Chat stream requests from the frontend
 * - Message structure for database storage
 */

import { z } from 'zod';

/**
 * Text content block schema
 */
const TextBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string().min(1),
});

/**
 * Tool use content block schema (for future tool integration)
 */
const ToolUseBlockSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.unknown(),
});

/**
 * Tool result content block schema (for future tool integration)
 */
const ToolResultBlockSchema = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string(),
  content: z.unknown(),
});

/**
 * Content block discriminated union schema
 * Matches Claude API message structure
 */
export const ContentBlockSchema = z.discriminatedUnion('type', [
  TextBlockSchema,
  ToolUseBlockSchema,
  ToolResultBlockSchema,
]);

/**
 * Message schema for database storage
 */
export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.array(ContentBlockSchema).min(1),
});

/**
 * Chat stream request schema
 * Validates incoming SSE stream requests
 */
export const ChatStreamRequestSchema = z
  .object({
    conversationId: z.string().uuid().optional(),
    message: z.string().min(1).max(10000),
  })
  .refine(
    (data) => data.message.trim().length > 0,
    { message: 'Message cannot be empty or whitespace-only', path: ['message'] }
  );

/**
 * Exported types
 */
export type ContentBlock = z.infer<typeof ContentBlockSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type ChatStreamRequest = z.infer<typeof ChatStreamRequestSchema>;

/**
 * Type guard for text content block
 */
export function isTextBlock(
  block: ContentBlock
): block is { type: 'text'; text: string } {
  return block.type === 'text';
}

/**
 * Type guard for tool use content block
 */
export function isToolUseBlock(
  block: ContentBlock
): block is { type: 'tool_use'; id: string; name: string; input: unknown } {
  return block.type === 'tool_use';
}

/**
 * Type guard for tool result content block
 */
export function isToolResultBlock(
  block: ContentBlock
): block is { type: 'tool_result'; tool_use_id: string; content: unknown } {
  return block.type === 'tool_result';
}
