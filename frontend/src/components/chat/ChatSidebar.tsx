/**
 * Chat Sidebar Component
 *
 * Feature: 010-discover-chat
 *
 * Displays list of conversations with preview and timestamp.
 * Supports selection, new chat creation, and delete.
 * Uses virtualization for performance with large lists (50+ conversations).
 */

import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useMutation } from '@apollo/client';
import { List } from 'react-window';
import type { CSSProperties, ReactElement } from 'react';
import { toast } from 'sonner';
import { useConversations } from '../../hooks/useConversations';
import {
  DELETE_CONVERSATION,
  DeleteConversationData,
  DeleteConversationVars,
  GET_CONVERSATIONS,
  Conversation,
  isDeleteSuccess,
} from '../../graphql/chat';
import { LeaveConfirmDialog } from './LeaveConfirmDialog';
import './ChatSidebar.css';

/** Threshold for enabling virtualization */
const VIRTUALIZATION_THRESHOLD = 50;

/** Fixed height for each conversation item (matches CSS) */
const ITEM_HEIGHT = 64;

interface ChatSidebarProps {
  /** Currently selected conversation ID */
  selectedId: string | null;
  /** Callback when conversation is selected */
  onSelect: (id: string | null) => void;
  /** Whether streaming is active (disable delete for active conversation) */
  isStreaming?: boolean;
}

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

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Individual conversation item component
 */
interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  isStreaming: boolean;
  deleting: boolean;
  onSelect: (id: string) => void;
  onDelete: (e: React.MouseEvent, conversation: Conversation) => void;
}

function ConversationItem({
  conversation,
  isSelected,
  isStreaming,
  deleting,
  onSelect,
  onDelete,
}: ConversationItemProps) {
  return (
    <div
      className={`chat-sidebar__item ${isSelected ? 'chat-sidebar__item--selected' : ''}`}
      onClick={() => onSelect(conversation.id)}
      role="listitem"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(conversation.id);
        }
      }}
    >
      <div className="chat-sidebar__item-content">
        <span className="chat-sidebar__item-preview">{conversation.preview}</span>
        <span className="chat-sidebar__item-time">{formatRelativeTime(conversation.updatedAt)}</span>
      </div>
      <button
        className="chat-sidebar__item-delete"
        onClick={(e) => onDelete(e, conversation)}
        disabled={deleting || (isStreaming && isSelected)}
        aria-label={`Delete conversation: ${conversation.preview}`}
      >
        ×
      </button>
    </div>
  );
}

/**
 * Props passed to virtualized row component
 */
interface VirtualizedRowProps {
  conversations: Conversation[];
  selectedId: string | null;
  isStreaming: boolean;
  deleting: boolean;
  onSelect: (id: string) => void;
  onDelete: (e: React.MouseEvent, conversation: Conversation) => void;
}

/**
 * Virtualized row renderer for react-window v2
 * Props include index, style, ariaAttributes, plus custom VirtualizedRowProps
 */
interface VirtualizedRowComponentProps extends VirtualizedRowProps {
  index: number;
  style: CSSProperties;
  ariaAttributes: {
    'aria-posinset': number;
    'aria-setsize': number;
    role: 'listitem';
  };
}

function VirtualizedRow({
  index,
  style,
  conversations,
  selectedId,
  isStreaming,
  deleting,
  onSelect,
  onDelete,
}: VirtualizedRowComponentProps): ReactElement {
  const conversation = conversations[index];

  return (
    <div style={style}>
      <ConversationItem
        conversation={conversation}
        isSelected={selectedId === conversation.id}
        isStreaming={isStreaming}
        deleting={deleting}
        onSelect={onSelect}
        onDelete={onDelete}
      />
    </div>
  );
}

export function ChatSidebar({ selectedId, onSelect, isStreaming = false }: ChatSidebarProps) {
  const { conversations, loading, error, retryable, refetch } = useConversations();
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(400);

  // Confirmation dialog for switching conversations during streaming
  const [pendingAction, setPendingAction] = useState<{ type: 'select'; id: string } | { type: 'new' } | null>(null);

  const [deleteConversation, { loading: deleting }] = useMutation<
    DeleteConversationData,
    DeleteConversationVars
  >(DELETE_CONVERSATION, {
    refetchQueries: [{ query: GET_CONVERSATIONS }],
    onCompleted: (data) => {
      if (isDeleteSuccess(data.deleteConversation)) {
        // If deleted conversation was selected, clear selection
        if (selectedId === data.deleteConversation.deletedId) {
          onSelect(null);
        }
      }
    },
    onError: (error) => {
      toast.error('Failed to delete conversation', {
        description: error.message,
      });
    },
  });

  // Sort conversations by updatedAt descending
  const sortedConversations = useMemo(() => {
    return [...conversations].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [conversations]);

  // Handle delete click
  const handleDelete = useCallback(
    (e: React.MouseEvent, conversation: Conversation) => {
      e.stopPropagation(); // Prevent selecting the conversation

      // Don't allow deleting if streaming on this conversation
      if (isStreaming && selectedId === conversation.id) return;

      deleteConversation({ variables: { id: conversation.id } });
    },
    [isStreaming, selectedId, deleteConversation]
  );

  // Handle selection - show confirmation if streaming on a different conversation
  const handleSelect = useCallback(
    (id: string) => {
      // If already selected, do nothing
      if (id === selectedId) return;

      // If streaming, show confirmation dialog
      if (isStreaming) {
        setPendingAction({ type: 'select', id });
        return;
      }

      onSelect(id);
    },
    [onSelect, selectedId, isStreaming]
  );

  // Handle new chat click - show confirmation if streaming
  const handleNewChat = useCallback(() => {
    // If already on new chat, do nothing
    if (selectedId === null) return;

    // If streaming, show confirmation dialog
    if (isStreaming) {
      setPendingAction({ type: 'new' });
      return;
    }

    onSelect(null);
  }, [onSelect, selectedId, isStreaming]);

  // Handle confirmation dialog - stay
  const handleStay = useCallback(() => {
    setPendingAction(null);
  }, []);

  // Handle confirmation dialog - leave
  const handleLeave = useCallback(() => {
    if (pendingAction) {
      if (pendingAction.type === 'select') {
        onSelect(pendingAction.id);
      } else {
        onSelect(null);
      }
      setPendingAction(null);
    }
  }, [pendingAction, onSelect]);

  // Calculate list height based on container
  useEffect(() => {
    const updateHeight = () => {
      if (listContainerRef.current) {
        setListHeight(listContainerRef.current.clientHeight);
      }
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    if (listContainerRef.current) {
      resizeObserver.observe(listContainerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Props for virtualized rows
  const rowProps: VirtualizedRowProps = useMemo(
    () => ({
      conversations: sortedConversations,
      selectedId,
      isStreaming,
      deleting,
      onSelect: handleSelect,
      onDelete: handleDelete,
    }),
    [sortedConversations, selectedId, isStreaming, deleting, handleSelect, handleDelete]
  );

  // Determine if we should use virtualization
  const useVirtualization = sortedConversations.length >= VIRTUALIZATION_THRESHOLD;

  return (
    <aside className="chat-sidebar">
      <div className="chat-sidebar__header">
        <h2 className="chat-sidebar__title">Conversations</h2>
        <button
          className="chat-sidebar__new-button"
          onClick={handleNewChat}
          aria-label="Start new chat"
        >
          + New Chat
        </button>
      </div>

      <div ref={listContainerRef} className="chat-sidebar__list" role="list">
        {loading && conversations.length === 0 && (
          <div className="chat-sidebar__loading">
            <div className="chat-sidebar__skeleton" />
            <div className="chat-sidebar__skeleton" />
            <div className="chat-sidebar__skeleton" />
          </div>
        )}

        {error && (
          <div className="chat-sidebar__error">
            <p>{error}</p>
            {retryable && (
              <button className="chat-sidebar__retry" onClick={() => refetch()}>
                Retry
              </button>
            )}
          </div>
        )}

        {!loading && !error && sortedConversations.length === 0 && (
          <div className="chat-sidebar__empty">
            <p>No conversations yet</p>
            <p className="chat-sidebar__empty-hint">Start a new chat to discover music</p>
          </div>
        )}

        {useVirtualization ? (
          <List<VirtualizedRowProps>
            defaultHeight={listHeight}
            rowCount={sortedConversations.length}
            rowHeight={ITEM_HEIGHT}
            rowComponent={VirtualizedRow}
            rowProps={rowProps}
            overscanCount={5}
          />
        ) : (
          sortedConversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              isSelected={selectedId === conversation.id}
              isStreaming={isStreaming}
              deleting={deleting}
              onSelect={handleSelect}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      <LeaveConfirmDialog
        isOpen={pendingAction !== null}
        onStay={handleStay}
        onLeave={handleLeave}
      />
    </aside>
  );
}
