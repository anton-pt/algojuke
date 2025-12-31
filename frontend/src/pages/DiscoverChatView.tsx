import { ChatPage, ChatErrorBoundary } from '../components/chat';

/**
 * Discover chat view for AI-powered music discovery conversation
 *
 * Feature: 010-discover-chat
 *
 * Wrapper component for the ChatPage within the Discover page tabs.
 * Includes error boundary for graceful error recovery.
 */

export function DiscoverChatView() {
  return (
    <div className="discover-chat-view">
      <ChatErrorBoundary>
        <ChatPage />
      </ChatErrorBoundary>
    </div>
  );
}
