/**
 * Chat Message Component
 *
 * Feature: 010-discover-chat, 011-agent-tools
 *
 * Displays a single message in the chat conversation.
 * Supports user and assistant messages with visual distinction.
 * Assistant messages render Markdown content and ToolInvocation components.
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage as ChatMessageType, ContentBlock } from '../../graphql/chat';
import { ToolInvocation, type ToolInvocationProps } from './ToolInvocation';
import type { ToolInvocationsMap, StreamingContentPart } from '../../hooks/useChatStream';
import './ChatMessage.css';

interface ChatMessageProps {
  message: ChatMessageType;
  /** Map of active tool invocations for real-time status (Task 4.5) */
  toolInvocations?: ToolInvocationsMap;
  /** Ordered content parts for inline tool rendering during streaming */
  streamingParts?: StreamingContentPart[];
}

/**
 * Extract text content from content blocks
 */
function extractTextContent(content: ContentBlock[]): string {
  return content
    .filter((block) => block.type === 'text' && block.text)
    .map((block) => block.text)
    .join('\n');
}

/**
 * Format timestamp for display
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * User avatar icon (person silhouette)
 */
function UserIcon() {
  return (
    <svg
      className="chat-message__avatar-icon"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

/**
 * AlgoJuke avatar icon (music note)
 */
function AlgoJukeIcon() {
  return (
    <svg
      className="chat-message__avatar-icon"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    </svg>
  );
}

/**
 * Build a map of toolId -> ToolInvocationProps from persisted content blocks.
 * Merges tool_use blocks with their corresponding tool_result blocks.
 */
function buildToolInvocationMap(content: ContentBlock[]): Map<string, ToolInvocationProps> {
  const invocationMap = new Map<string, ToolInvocationProps>();

  // Build a map of toolId -> tool_result content
  const resultMap = new Map<string, unknown>();
  for (const block of content) {
    if (block.type === 'tool_result' && block.toolId && block.toolResult) {
      try {
        resultMap.set(block.toolId, JSON.parse(block.toolResult));
      } catch {
        resultMap.set(block.toolId, block.toolResult);
      }
    }
  }

  // Build invocation props from tool_use blocks, merged with results
  for (const block of content) {
    if (block.type === 'tool_use' && block.toolId && block.toolName) {
      let input: unknown = null;
      if (block.toolInput) {
        try {
          input = JSON.parse(block.toolInput);
        } catch {
          input = block.toolInput;
        }
      }

      const output = resultMap.get(block.toolId);
      const resultCount = extractResultCount(output);

      invocationMap.set(block.toolId, {
        toolCallId: block.toolId,
        toolName: block.toolName,
        input,
        status: 'completed', // Persisted blocks are already complete
        output,
        resultCount,
        summary: buildSummary(block.toolName, resultCount),
      });
    }
  }

  return invocationMap;
}

/**
 * Render persisted content blocks inline in order.
 * Renders text and tool_use blocks, skips tool_result blocks (merged with tool_use).
 */
function renderPersistedContentInline(
  content: ContentBlock[],
  toolInvocationMap: Map<string, ToolInvocationProps>
): React.ReactNode[] {
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < content.length; i++) {
    const block = content[i];

    if (block.type === 'text' && block.text) {
      elements.push(
        <div key={`text-${i}`} className="chat-message__text">
          <ReactMarkdown>{block.text}</ReactMarkdown>
        </div>
      );
    } else if (block.type === 'tool_use' && block.toolId) {
      const invocation = toolInvocationMap.get(block.toolId);
      if (invocation) {
        elements.push(
          <div key={block.toolId} className="chat-message__tools">
            <ToolInvocation {...invocation} />
          </div>
        );
      }
    }
    // Skip tool_result blocks - they're merged with tool_use
  }

  return elements;
}

/**
 * Extract result count from tool output
 */
function extractResultCount(output: unknown): number {
  if (!output || typeof output !== 'object') return 0;
  const data = output as Record<string, unknown>;
  if (Array.isArray(data.tracks)) return data.tracks.length;
  if (Array.isArray(data.albums)) return data.albums.length;
  return 0;
}

/**
 * Build summary string for tool invocation
 */
function buildSummary(toolName: string, count: number): string {
  if (count === 0) return 'No results';
  const itemType = toolName === 'albumTracks' ? 'track' :
                   toolName === 'tidalSearch' && count > 0 ? 'result' : 'track';
  return `Found ${count} ${itemType}${count !== 1 ? 's' : ''}`;
}

export function ChatMessage({ message, toolInvocations, streamingParts }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const textContent = extractTextContent(message.content);

  // Check if we're streaming (have real-time invocations)
  const hasRealtimeInvocations = toolInvocations && toolInvocations.size > 0;

  // Build tool invocation map for persisted content
  const persistedToolMap = buildToolInvocationMap(message.content);
  const hasPersistedTools = persistedToolMap.size > 0;

  // Determine rendering mode:
  // 1. Streaming with ordered parts: use streamingParts for inline rendering
  // 2. Persisted with tools: render content blocks inline in order
  // 3. Simple text: just render text
  const useStreamingInline = streamingParts && streamingParts.length > 0 && hasRealtimeInvocations;
  const usePersistedInline = !useStreamingInline && hasPersistedTools;

  return (
    <div className={`chat-message ${isUser ? 'chat-message--user' : 'chat-message--assistant'}`}>
      <div className="chat-message__avatar">
        {isUser ? <UserIcon /> : <AlgoJukeIcon />}
      </div>
      <div className="chat-message__content">
        <div className="chat-message__header">
          <span className="chat-message__role">{isUser ? 'You' : 'AlgoJuke'}</span>
          <span className="chat-message__time">{formatTime(message.createdAt)}</span>
        </div>

        {isUser ? (
          // User message: simple text
          <div className="chat-message__text">
            {textContent || '...'}
          </div>
        ) : useStreamingInline ? (
          // Streaming assistant message: render parts inline in order
          <div className="chat-message__inline-content">
            {streamingParts.map((part, index) => {
              if (part.type === 'text') {
                return (
                  <div key={`text-${index}`} className="chat-message__text">
                    <ReactMarkdown>{part.content || '...'}</ReactMarkdown>
                  </div>
                );
              } else {
                // Tool invocation
                const invocation = toolInvocations?.get(part.toolId);
                if (invocation) {
                  return (
                    <div key={part.toolId} className="chat-message__tools">
                      <ToolInvocation {...invocation} />
                    </div>
                  );
                }
                return null;
              }
            })}
          </div>
        ) : usePersistedInline ? (
          // Persisted assistant message with tools: render content blocks inline in order
          <div className="chat-message__inline-content">
            {renderPersistedContentInline(message.content, persistedToolMap)}
          </div>
        ) : (
          // Simple assistant message: just text
          <div className="chat-message__text">
            <ReactMarkdown>{textContent || '...'}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
