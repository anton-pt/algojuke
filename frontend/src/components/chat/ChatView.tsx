/**
 * Chat View Component
 *
 * Feature: 010-discover-chat
 *
 * Main chat interface that combines message list and input.
 * Handles streaming responses and error display.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@apollo/client';
import { useChatStream } from '../../hooks/useChatStream';
import { useStreaming } from '../../contexts/StreamingContext';
import {
  GET_CONVERSATION,
  GetConversationData,
  GetConversationVars,
  isConversationWithMessages,
} from '../../graphql/chat';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import './ChatView.css';

interface ChatViewProps {
  /** Optional conversation ID to load */
  conversationId?: string | null;
  /** Callback when conversation ID changes (e.g., new conversation created) */
  onConversationChange?: (id: string | null) => void;
  /** Callback when streaming state changes */
  onStreamingChange?: (isStreaming: boolean) => void;
}

export function ChatView({
  conversationId: propsConversationId,
  onConversationChange,
  onStreamingChange,
}: ChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef<number>(0);

  // Track which conversation ID we last fetched to avoid re-fetching
  const lastFetchedIdRef = useRef<string | null>(null);
  // Track if we're in a locally-created conversation (via streaming)
  const isLocalConversationRef = useRef(false);
  // Track the last propsConversationId we processed to prevent effect loops
  const lastProcessedPropsIdRef = useRef<string | null | undefined>(undefined);

  // Streaming context for navigation blocking
  const streaming = useStreaming();

  // Chat streaming hook
  const {
    messages,
    conversationId,
    isStreaming,
    error,
    toolInvocations, // Task 4.5: For real-time tool status display
    streamingParts, // Ordered content for inline tool rendering
    sendMessage,
    cancelStream,
    clearChat,
    setConversationId,
    setMessages,
  } = useChatStream();

  // Update streaming context when streaming state changes
  useEffect(() => {
    streaming?.setStreaming(isStreaming);
  }, [isStreaming, streaming]);

  // Determine if we need to fetch conversation from server
  // Skip if: no ID, streaming, already have messages for this ID, or it's a local conversation
  const shouldFetch = Boolean(
    propsConversationId &&
    !isStreaming &&
    !isLocalConversationRef.current &&
    propsConversationId !== lastFetchedIdRef.current
  );

  // Detect if we're transitioning between states
  // Use lastFetchedIdRef to know if we've actually loaded the target conversation
  const isTransitioningToNewChat = propsConversationId === null &&
    (conversationId !== null || messages.length > 0);

  // We're loading a different conversation if:
  // - propsConversationId is set
  // - It's different from what we've actually loaded (lastFetchedIdRef)
  // - We're not in a locally-created conversation
  const needsToLoadConversation = propsConversationId !== null &&
    propsConversationId !== lastFetchedIdRef.current &&
    !isLocalConversationRef.current;

  const isTransitioning = isTransitioningToNewChat || needsToLoadConversation;

  // Load existing conversation if ID provided and not local
  const { loading: loadingConversation, error: loadError } = useQuery<
    GetConversationData,
    GetConversationVars
  >(GET_CONVERSATION, {
    variables: { id: propsConversationId! },
    skip: !shouldFetch,
    fetchPolicy: 'network-only',
    onCompleted: (data) => {
      if (isConversationWithMessages(data.conversation)) {
        lastFetchedIdRef.current = data.conversation.conversation.id;
        setConversationId(data.conversation.conversation.id);
        setMessages(data.conversation.messages);
      }
    },
  });

  // Detect when a new conversation is created via streaming
  // This happens when conversationId changes but doesn't match propsConversationId
  // (meaning it wasn't loaded from sidebar, but created by sending a message)
  useEffect(() => {
    if (conversationId && conversationId !== propsConversationId && !isLocalConversationRef.current) {
      isLocalConversationRef.current = true;
    }
  }, [conversationId, propsConversationId]);

  // Update parent when a NEW conversation is created via streaming
  // IMPORTANT: Only notify parent when isLocalConversationRef is true
  // This prevents loops when switching between existing conversations
  useEffect(() => {
    if (conversationId && onConversationChange && isLocalConversationRef.current) {
      onConversationChange(conversationId);
    }
  }, [conversationId, onConversationChange]);

  // Notify parent when streaming state changes
  useEffect(() => {
    onStreamingChange?.(isStreaming);
  }, [isStreaming, onStreamingChange]);

  // Handle props conversation ID changes (from sidebar selection or new chat)
  // IMPORTANT: Only depend on propsConversationId to prevent infinite loops
  useEffect(() => {
    // Skip if we already processed this props ID
    if (lastProcessedPropsIdRef.current === propsConversationId) {
      return;
    }

    // Skip if parent is just syncing to a conversation we created locally
    // (This happens when onConversationChange notifies parent of new streaming conversation)
    if (isLocalConversationRef.current && propsConversationId === conversationId) {
      lastProcessedPropsIdRef.current = propsConversationId;
      return;
    }

    lastProcessedPropsIdRef.current = propsConversationId;

    // New chat requested (null passed from parent)
    if (propsConversationId === null) {
      clearChat();
      isLocalConversationRef.current = false;
      lastFetchedIdRef.current = null;
      return;
    }

    // Different conversation selected from sidebar - clear current state
    // The useQuery will handle loading the new conversation
    isLocalConversationRef.current = false;
    setMessages([]);
    setConversationId(propsConversationId ?? null);
  }, [propsConversationId, conversationId, clearChat, setConversationId, setMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Announce new messages to screen readers
  const announceNewMessage = useCallback((message: string) => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = message;
    }
  }, []);

  // Track message count changes and announce to screen readers
  useEffect(() => {
    const currentCount = messages.length;
    const prevCount = prevMessageCountRef.current;

    if (currentCount > prevCount && currentCount > 0) {
      const lastMessage = messages[currentCount - 1];
      if (lastMessage.role === 'assistant') {
        // Announce assistant response (truncate if too long)
        const text = lastMessage.content[0]?.text || 'New response received';
        const truncated = text.length > 100 ? text.slice(0, 100) + '...' : text;
        announceNewMessage(`Assistant: ${truncated}`);
      } else if (lastMessage.role === 'user') {
        announceNewMessage('Message sent');
      }
    }

    prevMessageCountRef.current = currentCount;
  }, [messages, announceNewMessage]);

  // Warn user before navigating away during active streaming (browser navigation)
  useEffect(() => {
    if (!isStreaming) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers require returnValue to show the dialog
      e.returnValue = 'A response is being generated. Are you sure you want to leave?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isStreaming]);

  // Show loading state when we need to load a conversation that isn't loaded yet
  if (needsToLoadConversation) {
    return (
      <div className="chat-view">
        <div className="chat-view__loading">
          <div className="chat-view__loading-spinner" />
          <p>Loading conversation...</p>
        </div>
      </div>
    );
  }

  // Show error for failed conversation load
  if (loadError) {
    return (
      <div className="chat-view">
        <div className="chat-view__error">
          <p>Failed to load conversation</p>
          <p className="chat-view__error-detail">{loadError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-view">
      {/* Screen reader announcements */}
      <div
        ref={liveRegionRef}
        className="chat-view__sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      />
      <div className="chat-view__messages" role="log" aria-label="Chat messages">
        {messages.length === 0 || isTransitioningToNewChat ? (
          <div className="chat-view__empty">
            <div className="chat-view__empty-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
            <h2 className="chat-view__empty-title">Start a conversation</h2>
            <p className="chat-view__empty-text">
              Describe the mood, theme, or feeling you're looking for, and I'll help you discover music from your library.
            </p>
            <div className="chat-view__empty-examples">
              <p className="chat-view__empty-examples-label">Try asking:</p>
              <ul>
                <li>"Something upbeat for a morning workout"</li>
                <li>"Relaxing music for focus and concentration"</li>
                <li>"Songs about new beginnings"</li>
              </ul>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              // Only pass streaming props to the last assistant message (the one being streamed)
              const isLastAssistant = message.role === 'assistant' && index === messages.length - 1;
              return (
                <ChatMessage
                  key={message.id}
                  message={message}
                  toolInvocations={isLastAssistant ? toolInvocations : undefined}
                  streamingParts={isLastAssistant ? streamingParts : undefined}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}

        {/* Streaming indicator */}
        {isStreaming && messages.length > 0 && !isTransitioning && (
          <div className="chat-view__streaming-indicator">
            <span className="chat-view__streaming-dot" />
            <span className="chat-view__streaming-text">Generating response...</span>
          </div>
        )}

        {/* Error message with retry */}
        {error && (
          <div className="chat-view__error-message">
            <p>{error.message}</p>
            {error.retryable && (
              <button
                className="chat-view__retry-button"
                onClick={() => {
                  const lastUserMessage = [...messages]
                    .reverse()
                    .find((m) => m.role === 'user');
                  if (lastUserMessage?.content[0]?.text) {
                    sendMessage(lastUserMessage.content[0].text);
                  }
                }}
              >
                Try Again
              </button>
            )}
          </div>
        )}
      </div>

      <ChatInput
        onSend={sendMessage}
        disabled={loadingConversation || isTransitioning}
        isStreaming={isStreaming}
        onCancel={cancelStream}
      />
    </div>
  );
}
