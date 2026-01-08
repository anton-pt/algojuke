/**
 * Chat Page Component
 *
 * Feature: 010-discover-chat, 029-chat-default-mobile-friendly
 *
 * Combines ChatSidebar and ChatView into the full chat interface.
 * Manages conversation selection and navigation state.
 * Includes mobile drawer for conversation history on narrow screens.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { ChatSidebar } from "./ChatSidebar";
import { ChatView } from "./ChatView";
import { MobileDrawer } from "./MobileDrawer";
import "./ChatPage.css";

/** localStorage key for sidebar collapsed preference */
const SIDEBAR_COLLAPSED_KEY = "algojuke-sidebar-collapsed";

export function ChatPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  });

  const hamburgerRef = useRef<HTMLButtonElement>(null);

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

  // Toggle sidebar collapse
  const handleToggleCollapse = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  // Open mobile drawer
  const handleOpenDrawer = useCallback(() => {
    setIsDrawerOpen(true);
  }, []);

  // Close mobile drawer
  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  // Close drawer when resizing to desktop
  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 769px)");

    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsDrawerOpen(false);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return (
    <div className="chat-page">
      <ChatSidebar
        selectedId={selectedConversationId}
        onSelect={handleSelectConversation}
        isStreaming={isStreaming}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />
      <main className="chat-page__main">
        {/* Mobile header with hamburger - visible only on mobile */}
        <div className="chat-page__mobile-header">
          <button
            ref={hamburgerRef}
            className="chat-page__hamburger"
            onClick={handleOpenDrawer}
            aria-label="Open conversation history"
            aria-expanded={isDrawerOpen}
            aria-controls="mobile-drawer"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="chat-page__mobile-title">Conversations</span>
        </div>
        <ChatView
          conversationId={selectedConversationId}
          onConversationChange={handleConversationChange}
          onStreamingChange={handleStreamingChange}
        />
      </main>

      {/* Mobile drawer for conversation history */}
      <MobileDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        selectedId={selectedConversationId}
        onSelect={handleSelectConversation}
        isStreaming={isStreaming}
      />
    </div>
  );
}
