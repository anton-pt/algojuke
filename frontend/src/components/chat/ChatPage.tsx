/**
 * Chat Page Component
 *
 * Feature: 010-discover-chat
 *
 * Combines ChatSidebar and ChatView into the full chat interface.
 * Manages conversation selection and navigation state.
 * Note: Browser navigation warning is handled in ChatView via beforeunload.
 * Internal React Router navigation blocking requires a data router which
 * is not currently used in this app.
 */

import { useState, useCallback } from 'react';
import { ChatSidebar } from './ChatSidebar';
import { ChatView } from './ChatView';
import './ChatPage.css';

export function ChatPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  // Handle conversation selection from sidebar
  const handleSelectConversation = useCallback((id: string | null) => {
    setSelectedConversationId(id);
  }, []);

  // Handle conversation ID changes from ChatView (e.g., new conversation created)
  const handleConversationChange = useCallback((id: string | null) => {
    setSelectedConversationId((prev) => (prev !== id ? id : prev));
  }, []);

  // Track streaming state to disable delete during active stream
  const handleStreamingChange = useCallback((streaming: boolean) => {
    setIsStreaming(streaming);
  }, []);

  return (
    <div className="chat-page">
      <ChatSidebar
        selectedId={selectedConversationId}
        onSelect={handleSelectConversation}
        isStreaming={isStreaming}
      />
      <main className="chat-page__main">
        <ChatView
          conversationId={selectedConversationId}
          onConversationChange={handleConversationChange}
          onStreamingChange={handleStreamingChange}
        />
      </main>
    </div>
  );
}
