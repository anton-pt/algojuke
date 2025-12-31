/**
 * Chat Stream Hook
 *
 * Feature: 010-discover-chat
 *
 * Handles streaming chat responses via SSE (Server-Sent Events).
 * Uses fetch with ReadableStream for progressive response handling.
 */

import { useState, useCallback, useRef } from 'react';
import type { ChatMessage } from '../graphql/chat';

// -----------------------------------------------------------------------------
// SSE Event Types (from contracts/chat-sse.md)
// -----------------------------------------------------------------------------

interface MessageStartEvent {
  type: 'message_start';
  messageId: string;
  conversationId: string;
}

interface TextDeltaEvent {
  type: 'text_delta';
  content: string;
}

interface MessageEndEvent {
  type: 'message_end';
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

interface ErrorEvent {
  type: 'error';
  code: string;
  message: string;
  retryable: boolean;
}

type SSEEvent = MessageStartEvent | TextDeltaEvent | MessageEndEvent | ErrorEvent;

// -----------------------------------------------------------------------------
// Hook Types
// -----------------------------------------------------------------------------

export interface StreamError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface UseChatStreamReturn {
  /** All messages in the current conversation */
  messages: ChatMessage[];
  /** Current conversation ID */
  conversationId: string | null;
  /** Whether a response is currently streaming */
  isStreaming: boolean;
  /** Error from streaming (null if no error) */
  error: StreamError | null;
  /** Send a message and stream the response */
  sendMessage: (message: string) => Promise<void>;
  /** Cancel the current stream */
  cancelStream: () => void;
  /** Clear messages and reset state */
  clearChat: () => void;
  /** Set conversation ID (for resuming existing conversations) */
  setConversationId: (id: string | null) => void;
  /** Replace messages (for loading existing conversation) */
  setMessages: (messages: ChatMessage[]) => void;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Parse SSE events from response stream
 */
async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal?: AbortSignal
): AsyncGenerator<SSEEvent> {
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) break;

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Split on double newlines (SSE event delimiter)
      const events = buffer.split('\n\n');
      // Keep last incomplete chunk in buffer
      buffer = events.pop() || '';

      for (const eventText of events) {
        if (eventText.startsWith('data: ')) {
          try {
            const jsonStr = eventText.slice(6);
            const event = JSON.parse(jsonStr) as SSEEvent;
            yield event;
          } catch {
            // Skip malformed events
            console.warn('Failed to parse SSE event:', eventText);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Create a ChatMessage from text content
 */
function createTextMessage(
  id: string,
  role: 'user' | 'assistant',
  text: string
): ChatMessage {
  return {
    id,
    role,
    content: [{ type: 'text', text, toolId: null, toolName: null, toolInput: null, toolResult: null }],
    createdAt: new Date().toISOString(),
  };
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function useChatStream(): UseChatStreamReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<StreamError | null>(null);

  // Abort controller for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Send a message and stream the response
  const sendMessage = useCallback(async (message: string) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isStreaming) return;

    // Clear any previous error
    setError(null);
    setIsStreaming(true);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // Optimistically add user message
    const tempUserMessageId = `temp-user-${Date.now()}`;
    const userMessage = createTextMessage(tempUserMessageId, 'user', trimmedMessage);
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: trimmedMessage,
          conversationId: conversationId || undefined,
        }),
        signal,
      });

      // Handle non-streaming error responses
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to send message');
      }

      if (!response.body) {
        throw new Error('No response body received');
      }

      const reader = response.body.getReader();
      let assistantMessageId = '';
      let currentContent = '';

      // Process SSE events
      for await (const event of parseSSEStream(reader, signal)) {
        if (signal.aborted) break;

        switch (event.type) {
          case 'message_start':
            assistantMessageId = event.messageId;

            // Update conversation ID if this is a new conversation
            if (!conversationId) {
              setConversationId(event.conversationId);
            }

            // Add empty assistant message
            setMessages((prev) => [
              ...prev,
              createTextMessage(assistantMessageId, 'assistant', ''),
            ]);
            break;

          case 'text_delta':
            currentContent += event.content;

            // Update assistant message with new content
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? createTextMessage(assistantMessageId, 'assistant', currentContent)
                  : msg
              )
            );
            break;

          case 'message_end':
            // Stream complete - content is already in state
            break;

          case 'error':
            setError({
              code: event.code,
              message: event.message,
              retryable: event.retryable,
            });
            break;
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // User cancelled - not an error
        return;
      }

      setError({
        code: 'NETWORK_ERROR',
        message: (err as Error).message || 'Failed to connect to chat service',
        retryable: true,
      });
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [conversationId, isStreaming]);

  // Cancel the current stream
  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  // Clear messages and reset state
  const clearChat = useCallback(() => {
    cancelStream();
    setMessages([]);
    setConversationId(null);
    setError(null);
  }, [cancelStream]);

  return {
    messages,
    conversationId,
    isStreaming,
    error,
    sendMessage,
    cancelStream,
    clearChat,
    setConversationId,
    setMessages,
  };
}
