/**
 * Chat Stream Hook
 *
 * Feature: 010-discover-chat, 011-agent-tools
 *
 * Handles streaming chat responses via SSE (Server-Sent Events).
 * Uses fetch with ReadableStream for progressive response handling.
 * Tracks tool invocations for display in ChatMessage.
 */

import { useState, useCallback, useRef } from 'react';
import type { ChatMessage } from '../graphql/chat';
import type { ToolInvocationProps } from '../components/chat/ToolInvocation';

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

/**
 * Tool call start event - sent when tool execution begins
 */
interface ToolCallStartEvent {
  type: 'tool_call_start';
  toolCallId: string;
  toolName: string;
  input: unknown;
}

/**
 * Tool call end event - sent when tool completes successfully
 */
interface ToolCallEndEvent {
  type: 'tool_call_end';
  toolCallId: string;
  summary: string;
  resultCount: number;
  durationMs: number;
  output?: unknown;
}

/**
 * Tool call error event - sent when tool execution fails
 */
interface ToolCallErrorEvent {
  type: 'tool_call_error';
  toolCallId: string;
  error: string;
  retryable: boolean;
  wasRetried: boolean;
}

type SSEEvent =
  | MessageStartEvent
  | TextDeltaEvent
  | MessageEndEvent
  | ErrorEvent
  | ToolCallStartEvent
  | ToolCallEndEvent
  | ToolCallErrorEvent;

// -----------------------------------------------------------------------------
// Hook Types
// -----------------------------------------------------------------------------

export interface StreamError {
  code: string;
  message: string;
  retryable: boolean;
}

/**
 * Tool invocation state for real-time updates
 * Maps toolCallId to current invocation state
 */
export type ToolInvocationsMap = Map<string, ToolInvocationProps>;

/**
 * Streaming content part for inline rendering
 * Tracks the order of text and tool invocations as they arrive
 */
export type StreamingContentPart =
  | { type: 'text'; content: string }
  | { type: 'tool'; toolId: string };

export interface UseChatStreamReturn {
  /** All messages in the current conversation */
  messages: ChatMessage[];
  /** Current conversation ID */
  conversationId: string | null;
  /** Whether a response is currently streaming */
  isStreaming: boolean;
  /** Error from streaming (null if no error) */
  error: StreamError | null;
  /** Active tool invocations by toolCallId (Task 4.4) */
  toolInvocations: ToolInvocationsMap;
  /** Ordered content parts for inline tool rendering during streaming */
  streamingParts: StreamingContentPart[];
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
  // Task 4.4: Track tool invocations for real-time display
  const [toolInvocations, setToolInvocations] = useState<ToolInvocationsMap>(new Map());
  // Track ordered content parts for inline tool rendering
  const [streamingParts, setStreamingParts] = useState<StreamingContentPart[]>([]);

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

            // Clear tool invocations and streaming parts from previous message
            setToolInvocations(new Map());
            setStreamingParts([]);

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

            // Track content parts for inline rendering
            setStreamingParts((prev) => {
              const newParts = [...prev];
              const lastPart = newParts[newParts.length - 1];
              if (lastPart && lastPart.type === 'text') {
                // Append to existing text part
                newParts[newParts.length - 1] = {
                  type: 'text',
                  content: lastPart.content + event.content,
                };
              } else {
                // Start new text part
                newParts.push({ type: 'text', content: event.content });
              }
              return newParts;
            });
            break;

          case 'message_end':
            // Stream complete - keep tool invocations for display
            // They'll be cleared on next message_start
            break;

          case 'error':
            setError({
              code: event.code,
              message: event.message,
              retryable: event.retryable,
            });
            break;

          // Task 4.4: Handle tool invocation events
          case 'tool_call_start':
            setToolInvocations((prev) => {
              const next = new Map(prev);
              next.set(event.toolCallId, {
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                input: event.input,
                status: 'executing',
              });
              return next;
            });
            // Add tool part for inline rendering
            setStreamingParts((prev) => [
              ...prev,
              { type: 'tool', toolId: event.toolCallId },
            ]);
            break;

          case 'tool_call_end':
            setToolInvocations((prev) => {
              const next = new Map(prev);
              const existing = next.get(event.toolCallId);
              next.set(event.toolCallId, {
                toolCallId: event.toolCallId,
                toolName: existing?.toolName || 'unknown',
                input: existing?.input,
                status: 'completed',
                summary: event.summary,
                resultCount: event.resultCount,
                durationMs: event.durationMs,
                output: event.output,
              });
              return next;
            });
            break;

          case 'tool_call_error':
            setToolInvocations((prev) => {
              const next = new Map(prev);
              const existing = next.get(event.toolCallId);
              next.set(event.toolCallId, {
                toolCallId: event.toolCallId,
                toolName: existing?.toolName || 'unknown',
                input: existing?.input,
                status: 'failed',
                error: event.error,
              });
              return next;
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
    setToolInvocations(new Map()); // Task 4.4
    setStreamingParts([]); // Clear inline content parts
  }, [cancelStream]);

  return {
    messages,
    conversationId,
    isStreaming,
    error,
    toolInvocations, // Task 4.4
    streamingParts, // Ordered content for inline tool rendering
    sendMessage,
    cancelStream,
    clearChat,
    setConversationId,
    setMessages,
  };
}
