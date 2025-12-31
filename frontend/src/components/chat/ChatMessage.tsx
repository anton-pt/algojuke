/**
 * Chat Message Component
 *
 * Feature: 010-discover-chat
 *
 * Displays a single message in the chat conversation.
 * Supports user and assistant messages with visual distinction.
 * Assistant messages render Markdown content.
 */

import ReactMarkdown from 'react-markdown';
import type { ChatMessage as ChatMessageType, ContentBlock } from '../../graphql/chat';
import './ChatMessage.css';

interface ChatMessageProps {
  message: ChatMessageType;
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

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const textContent = extractTextContent(message.content);

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
        <div className="chat-message__text">
          {isUser ? (
            textContent || '...'
          ) : (
            <ReactMarkdown>{textContent || '...'}</ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}
