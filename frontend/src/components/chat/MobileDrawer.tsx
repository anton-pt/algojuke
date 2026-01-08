/**
 * Mobile Drawer Component
 *
 * Feature: 029-chat-default-mobile-friendly
 *
 * Slide-out drawer for mobile conversation history access.
 * Renders on screens narrower than 768px when hamburger menu is tapped.
 */

import { useEffect, useRef, useCallback } from "react";
import { useMutation } from "@apollo/client";
import { toast } from "sonner";
import { useConversations } from "../../hooks/useConversations";
import {
  DELETE_CONVERSATION,
  DeleteConversationData,
  DeleteConversationVars,
  GET_CONVERSATIONS,
  Conversation,
  isDeleteSuccess,
} from "../../graphql/chat";
import { LeaveConfirmDialog } from "./LeaveConfirmDialog";
import { useState } from "react";
import "./MobileDrawer.css";

/**
 * Format relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface MobileDrawerProps {
  /** Whether the drawer is open */
  isOpen: boolean;
  /** Callback to close the drawer */
  onClose: () => void;
  /** Currently selected conversation ID */
  selectedId: string | null;
  /** Callback when conversation is selected */
  onSelect: (id: string | null) => void;
  /** Whether streaming is active */
  isStreaming?: boolean;
}

export function MobileDrawer({
  isOpen,
  onClose,
  selectedId,
  onSelect,
  isStreaming = false,
}: MobileDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const { conversations, loading, error, retryable, refetch } =
    useConversations();

  // Confirmation dialog for switching conversations during streaming
  const [pendingAction, setPendingAction] = useState<
    { type: "select"; id: string } | { type: "new" } | null
  >(null);

  const [deleteConversation, { loading: deleting }] = useMutation<
    DeleteConversationData,
    DeleteConversationVars
  >(DELETE_CONVERSATION, {
    refetchQueries: [{ query: GET_CONVERSATIONS }],
    onCompleted: (data) => {
      if (isDeleteSuccess(data.deleteConversation)) {
        if (selectedId === data.deleteConversation.deletedId) {
          onSelect(null);
        }
      }
    },
    onError: (error) => {
      toast.error("Failed to delete conversation", {
        description: error.message,
      });
    },
  });

  // Sort conversations by updatedAt descending
  const sortedConversations = [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  // Handle delete click
  const handleDelete = useCallback(
    (e: React.MouseEvent, conversation: Conversation) => {
      e.stopPropagation();
      if (isStreaming && selectedId === conversation.id) return;
      deleteConversation({ variables: { id: conversation.id } });
    },
    [isStreaming, selectedId, deleteConversation],
  );

  // Handle selection - close drawer after selection
  const handleSelect = useCallback(
    (id: string) => {
      if (id === selectedId) {
        onClose();
        return;
      }

      if (isStreaming) {
        setPendingAction({ type: "select", id });
        return;
      }

      onSelect(id);
      onClose();
    },
    [onSelect, onClose, selectedId, isStreaming],
  );

  // Handle new chat click
  const handleNewChat = useCallback(() => {
    if (selectedId === null) {
      onClose();
      return;
    }

    if (isStreaming) {
      setPendingAction({ type: "new" });
      return;
    }

    onSelect(null);
    onClose();
  }, [onSelect, onClose, selectedId, isStreaming]);

  // Handle confirmation dialog - stay
  const handleStay = useCallback(() => {
    setPendingAction(null);
  }, []);

  // Handle confirmation dialog - leave
  const handleLeave = useCallback(() => {
    if (pendingAction) {
      if (pendingAction.type === "select") {
        onSelect(pendingAction.id);
      } else {
        onSelect(null);
      }
      setPendingAction(null);
      onClose();
    }
  }, [pendingAction, onSelect, onClose]);

  // Focus management - store previous focus and focus close button when opening
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus close button after a brief delay to allow animation
      requestAnimationFrame(() => {
        closeButtonRef.current?.focus();
      });
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !drawerRef.current) return;

    const drawer = drawerRef.current;
    const focusableElements = drawer.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    drawer.addEventListener("keydown", handleTab);
    return () => drawer.removeEventListener("keydown", handleTab);
  }, [isOpen]);

  // Escape key handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="mobile-drawer__overlay"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Conversation history"
        id="mobile-drawer"
      >
        <div className="mobile-drawer__header">
          <h2 className="mobile-drawer__title">Conversations</h2>
          <button
            ref={closeButtonRef}
            className="mobile-drawer__close"
            onClick={onClose}
            aria-label="Close conversation history"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <button
          className="mobile-drawer__new-button"
          onClick={handleNewChat}
          aria-label="Start new chat"
        >
          + New Chat
        </button>

        <div className="mobile-drawer__list" role="list">
          {loading && conversations.length === 0 && (
            <div className="mobile-drawer__loading">
              <div className="mobile-drawer__skeleton" />
              <div className="mobile-drawer__skeleton" />
              <div className="mobile-drawer__skeleton" />
            </div>
          )}

          {error && (
            <div className="mobile-drawer__error">
              <p>{error}</p>
              {retryable && (
                <button
                  className="mobile-drawer__retry"
                  onClick={() => refetch()}
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {!loading && !error && sortedConversations.length === 0 && (
            <div className="mobile-drawer__empty">
              <p>No conversations yet</p>
              <p className="mobile-drawer__empty-hint">
                Start a new chat to discover music
              </p>
            </div>
          )}

          {sortedConversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`mobile-drawer__item ${selectedId === conversation.id ? "mobile-drawer__item--selected" : ""}`}
              onClick={() => handleSelect(conversation.id)}
              role="listitem"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSelect(conversation.id);
                }
              }}
            >
              <div className="mobile-drawer__item-content">
                <span className="mobile-drawer__item-preview">
                  {conversation.preview}
                </span>
                <span className="mobile-drawer__item-time">
                  {formatRelativeTime(conversation.updatedAt)}
                </span>
              </div>
              <button
                className="mobile-drawer__item-delete"
                onClick={(e) => handleDelete(e, conversation)}
                disabled={
                  deleting || (isStreaming && selectedId === conversation.id)
                }
                aria-label={`Delete conversation: ${conversation.preview}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <LeaveConfirmDialog
          isOpen={pendingAction !== null}
          onStay={handleStay}
          onLeave={handleLeave}
        />
      </div>
    </>
  );
}
