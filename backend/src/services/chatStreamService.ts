/**
 * Chat Stream Service
 *
 * Handles AI response generation using Claude via Vercel AI SDK.
 * Integrates with Langfuse for observability.
 */

import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { ChatService } from './chatService.js';
import { Message, ContentBlock } from '../entities/Message.js';
import { getLangfuseClient, flushLangfuse } from '../utils/langfuse.js';
import { logger } from '../utils/logger.js';

/**
 * Model ID for chat responses
 * Using the alias for better SDK compatibility
 */
const CHAT_MODEL = 'claude-sonnet-4-5';

/**
 * Maximum tokens for response generation
 */
const MAX_TOKENS = 4096;

/**
 * System prompt for music discovery assistant
 */
const SYSTEM_PROMPT = `You are a music discovery assistant for AlgoJuke. Your role is to help users discover music that matches their mood and preferences.

Key capabilities:
- Recommend music based on mood, theme, or emotional context
- Discuss songs, artists, albums, and musical styles
- Help users explore their existing music library in new ways
- Suggest tracks based on lyric themes and interpretations

Personality:
- Knowledgeable and passionate about music
- Conversational but focused on music discovery
- Ask clarifying questions to understand what the user is looking for

Note: In this version, you don't have access to search tools. Engage in conversation about music and provide general recommendations. Future updates will add the ability to search the user's library and Tidal.`;

/**
 * SSE Event types
 */
export interface MessageStartEvent {
  type: 'message_start';
  messageId: string;
  conversationId: string;
}

export interface TextDeltaEvent {
  type: 'text_delta';
  content: string;
}

export interface MessageEndEvent {
  type: 'message_end';
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface ErrorEvent {
  type: 'error';
  code: string;
  message: string;
  retryable: boolean;
}

export type SSEEvent = MessageStartEvent | TextDeltaEvent | MessageEndEvent | ErrorEvent;

/**
 * Stream response result
 */
export interface StreamResult {
  conversationId: string;
  assistantMessageId: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Chat Stream Service for handling AI response generation
 */
export class ChatStreamService {
  private chatService: ChatService;

  constructor(chatService: ChatService) {
    this.chatService = chatService;
  }

  /**
   * Stream a chat response
   *
   * @param message User message text
   * @param conversationId Optional existing conversation ID
   * @param onEvent Callback for SSE events
   * @param signal AbortSignal for cancellation
   * @returns Stream result with IDs and token usage
   */
  async streamResponse(
    message: string,
    conversationId: string | undefined,
    onEvent: (event: SSEEvent) => void,
    signal?: AbortSignal
  ): Promise<StreamResult | null> {
    let conversation: { id: string };
    let existingMessages: Message[] = [];
    let assistantMessageId = '';
    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      // Create or get conversation
      if (conversationId) {
        const exists = await this.chatService.conversationExists(conversationId);
        if (!exists) {
          onEvent({
            type: 'error',
            code: 'NOT_FOUND',
            message: 'Conversation not found',
            retryable: false,
          });
          return null;
        }

        // Get existing messages for context
        existingMessages = await this.chatService.getConversationMessages(conversationId);

        // Add user message
        await this.chatService.addUserMessage(conversationId, message);
        conversation = { id: conversationId };
      } else {
        // Create new conversation with user message
        const result = await this.chatService.createConversationWithMessage(message);
        conversation = result.conversation;
        conversationId = conversation.id;
      }

      // Build message history for LLM
      const llmMessages = this.buildLLMMessages(existingMessages, message);

      // Create Langfuse trace with conversation as session
      const langfuseClient = getLangfuseClient();
      const trace = langfuseClient?.trace({
        name: 'chat-message',
        sessionId: conversationId,
        metadata: {
          messageContent: message.slice(0, 100),
          messageCount: llmMessages.length,
        },
        tags: ['chat', 'discover'],
      });

      // Create generation span
      const generation = trace?.generation({
        name: 'claude-response',
        model: CHAT_MODEL,
        input: llmMessages,
      });

      // Send message_start event
      // We'll update with real message ID after saving
      const tempMessageId = `temp-${Date.now()}`;
      onEvent({
        type: 'message_start',
        messageId: tempMessageId,
        conversationId: conversationId!,
      });

      // Track timing for SC-001 (first token within 3 seconds)
      const requestStartTime = Date.now();
      let timeToFirstToken: number | null = null;

      // Stream response from Claude
      logger.info('chat_stream_starting_llm', {
        conversationId,
        model: CHAT_MODEL,
        messageCount: llmMessages.length,
      });

      // Check if signal is already aborted before making API call
      if (signal?.aborted) {
        logger.warn('chat_stream_signal_already_aborted', { conversationId });
        return null;
      }

      const result = streamText({
        model: anthropic(CHAT_MODEL),
        system: SYSTEM_PROMPT,
        messages: llmMessages,
        maxOutputTokens: MAX_TOKENS,
        abortSignal: signal,
        onError: ({ error }) => {
          logger.error('chat_stream_on_error', {
            conversationId,
            error: error instanceof Error ? error.message : String(error),
          });
        },
        onChunk: ({ chunk }) => {
          logger.info('chat_stream_on_chunk', {
            conversationId,
            chunkType: chunk.type,
          });
        },
        onFinish: ({ text, finishReason, usage, response }) => {
          logger.info('chat_stream_on_finish', {
            conversationId,
            finishReason,
            textLength: text?.length,
            usage,
            responseId: response?.id,
          });
        },
      });

      logger.info('chat_stream_llm_started', { conversationId });

      // Stream text chunks
      let chunkCount = 0;
      let wasAborted = false;
      try {
        for await (const chunk of result.textStream) {
          chunkCount++;

          // Track time to first token (SC-001)
          if (chunkCount === 1) {
            timeToFirstToken = Date.now() - requestStartTime;
            logger.info('chat_stream_first_token', {
              conversationId,
              timeToFirstTokenMs: timeToFirstToken,
              meetsTarget: timeToFirstToken <= 3000, // SC-001: within 3 seconds
            });
          }

          if (signal?.aborted) {
            logger.info('chat_stream_signal_aborted_in_loop', { conversationId, chunkCount });
            wasAborted = true;
            break;
          }

          fullContent += chunk;
          onEvent({
            type: 'text_delta',
            content: chunk,
          });
        }

        // Handle abort case - save partial content and exit cleanly
        if (wasAborted && fullContent.length > 0 && conversationId) {
          logger.info('chat_stream_saving_partial_on_abort', {
            conversationId,
            chunkCount,
            contentLength: fullContent.length,
          });

          try {
            const assistantMessage = await this.chatService.addAssistantMessage(
              conversationId,
              [{ type: 'text', text: fullContent }]
            );
            assistantMessageId = assistantMessage.id;

            // End Langfuse generation with partial content
            const totalDurationMs = Date.now() - requestStartTime;
            generation?.end({
              output: fullContent,
              metadata: {
                aborted: true,
                timeToFirstTokenMs: timeToFirstToken,
                totalDurationMs,
              },
            });
            await flushLangfuse();

            logger.info('chat_stream_partial_saved', {
              conversationId,
              assistantMessageId,
              contentLength: fullContent.length,
            });
          } catch (saveError) {
            logger.error('chat_save_partial_on_abort_failed', {
              conversationId,
              error: saveError instanceof Error ? saveError.message : String(saveError),
            });
          }

          return {
            conversationId,
            assistantMessageId,
            inputTokens: 0,
            outputTokens: 0,
          };
        }

        // Get finish reason for logging (only if not aborted)
        const finishReason = await result.finishReason;

        logger.info('chat_stream_loop_completed', {
          conversationId,
          chunkCount,
          contentLength: fullContent.length,
          finishReason,
        });
      } catch (streamError) {
        logger.error('chat_stream_loop_error', {
          conversationId,
          chunkCount,
          error: streamError instanceof Error ? streamError.message : String(streamError),
          stack: streamError instanceof Error ? streamError.stack : undefined,
        });
        throw streamError;
      }

      // Get usage info
      const usage = await result.usage;
      inputTokens = usage.inputTokens ?? 0;
      outputTokens = usage.outputTokens ?? 0;

      // Save assistant message
      const assistantMessage = await this.chatService.addAssistantMessage(
        conversationId!,
        [{ type: 'text', text: fullContent }]
      );
      assistantMessageId = assistantMessage.id;

      // End Langfuse generation with timing metadata (SC-001)
      const totalDurationMs = Date.now() - requestStartTime;
      generation?.end({
        output: fullContent,
        usage: {
          input: inputTokens,
          output: outputTokens,
        },
        metadata: {
          timeToFirstTokenMs: timeToFirstToken,
          totalDurationMs,
          meetsTargetTTFT: timeToFirstToken !== null && timeToFirstToken <= 3000,
        },
      });

      // Send message_end event
      onEvent({
        type: 'message_end',
        usage: {
          inputTokens,
          outputTokens,
        },
      });

      // Flush Langfuse events
      await flushLangfuse();

      logger.info('chat_stream_completed', {
        conversationId,
        inputTokens,
        outputTokens,
        contentLength: fullContent.length,
        timeToFirstTokenMs: timeToFirstToken,
        totalDurationMs,
      });

      return {
        conversationId: conversationId!,
        assistantMessageId,
        inputTokens,
        outputTokens,
      };
    } catch (error) {
      // Save partial content if we have any
      if (fullContent.length > 0 && conversationId) {
        try {
          const assistantMessage = await this.chatService.addAssistantMessage(
            conversationId,
            [{ type: 'text', text: fullContent }]
          );
          assistantMessageId = assistantMessage.id;
        } catch (saveError) {
          logger.error('chat_save_partial_failed', {
            conversationId,
            error: saveError instanceof Error ? saveError.message : String(saveError),
          });
        }
      }

      // Determine error type
      if (signal?.aborted) {
        logger.info('chat_stream_aborted', {
          conversationId,
          partialContentLength: fullContent.length,
        });
        // Don't send error for user-initiated abort
        return conversationId
          ? {
              conversationId,
              assistantMessageId,
              inputTokens,
              outputTokens,
            }
          : null;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('chat_stream_error', {
        conversationId,
        error: errorMessage,
      });

      // Check for specific error types
      let code = 'INTERNAL_ERROR';
      let userMessage = 'An unexpected error occurred. Please try again.';
      let retryable = true;

      if (errorMessage.includes('API key') || errorMessage.includes('authentication')) {
        code = 'AI_SERVICE_UNAVAILABLE';
        userMessage = 'The AI service is temporarily unavailable. Please try again later.';
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        code = 'RATE_LIMITED';
        userMessage = 'Too many requests. Please wait a moment and try again.';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
        code = 'TIMEOUT';
        userMessage = 'The request timed out. Please try again.';
      }

      onEvent({
        type: 'error',
        code,
        message: userMessage,
        retryable,
      });

      return null;
    }
  }

  /**
   * Build LLM message array from conversation history
   */
  private buildLLMMessages(
    existingMessages: Message[],
    newMessage: string
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Add existing messages
    for (const msg of existingMessages) {
      const textContent = this.extractTextContent(msg.content);
      if (textContent) {
        messages.push({
          role: msg.role,
          content: textContent,
        });
      }
    }

    // Add new user message
    messages.push({
      role: 'user',
      content: newMessage,
    });

    // Apply context limit (100K tokens ~ keep last 10 messages as safety)
    // For now, we'll use a simple message count limit
    const MAX_MESSAGES = 20; // 10 exchanges = 20 messages
    if (messages.length > MAX_MESSAGES) {
      return messages.slice(-MAX_MESSAGES);
    }

    return messages;
  }

  /**
   * Extract text content from content blocks
   */
  private extractTextContent(content: ContentBlock[]): string | null {
    const textBlocks = content.filter(b => b.type === 'text') as Array<{ type: 'text'; text: string }>;
    if (textBlocks.length === 0) {
      return null;
    }
    return textBlocks.map(b => b.text).join('\n');
  }
}
