/**
 * ChatSidebar Component Tests
 *
 * Feature: 010-discover-chat
 * Task: T019-IT
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { ChatSidebar } from '../ChatSidebar';
import { GET_CONVERSATIONS } from '../../../graphql/chat';

// Mock conversations data
const mockConversations = [
  {
    __typename: 'Conversation' as const,
    id: '1',
    preview: 'Tell me about jazz music',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageCount: 2,
  },
  {
    __typename: 'Conversation' as const,
    id: '2',
    preview: 'Find upbeat songs',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    messageCount: 4,
  },
  {
    __typename: 'Conversation' as const,
    id: '3',
    preview: 'Relaxing playlist recommendations',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    messageCount: 6,
  },
];

const mocks = [
  {
    request: {
      query: GET_CONVERSATIONS,
    },
    result: {
      data: {
        conversations: {
          __typename: 'ConversationsList',
          conversations: mockConversations,
          totalCount: mockConversations.length,
        },
      },
    },
  },
];

const emptyMocks = [
  {
    request: {
      query: GET_CONVERSATIONS,
    },
    result: {
      data: {
        conversations: {
          __typename: 'ConversationsList',
          conversations: [],
          totalCount: 0,
        },
      },
    },
  },
];

describe('ChatSidebar', () => {
  const defaultProps = {
    selectedId: null,
    onSelect: vi.fn(),
    isStreaming: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders conversation list', async () => {
    render(
      <MockedProvider mocks={mocks}>
        <ChatSidebar {...defaultProps} />
      </MockedProvider>
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText('Tell me about jazz music')).toBeInTheDocument();
    });

    expect(screen.getByText('Find upbeat songs')).toBeInTheDocument();
    expect(screen.getByText('Relaxing playlist recommendations')).toBeInTheDocument();
  });

  it('renders empty state when no conversations', async () => {
    render(
      <MockedProvider mocks={emptyMocks}>
        <ChatSidebar {...defaultProps} />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('No conversations yet')).toBeInTheDocument();
    });

    expect(screen.getByText('Start a new chat to discover music')).toBeInTheDocument();
  });

  it('shows loading skeleton initially', () => {
    render(
      <MockedProvider mocks={mocks} >
        <ChatSidebar {...defaultProps} />
      </MockedProvider>
    );

    // Should show loading skeletons
    const skeletons = document.querySelectorAll('.chat-sidebar__skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('calls onSelect when conversation is clicked', async () => {
    const onSelect = vi.fn();

    render(
      <MockedProvider mocks={mocks} >
        <ChatSidebar {...defaultProps} onSelect={onSelect} />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Tell me about jazz music')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Tell me about jazz music'));
    expect(onSelect).toHaveBeenCalledWith('1');
  });

  it('highlights selected conversation', async () => {
    render(
      <MockedProvider mocks={mocks} >
        <ChatSidebar {...defaultProps} selectedId="2" />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Find upbeat songs')).toBeInTheDocument();
    });

    const selectedItem = screen.getByText('Find upbeat songs').closest('.chat-sidebar__item');
    expect(selectedItem).toHaveClass('chat-sidebar__item--selected');
  });

  it('calls onSelect(null) when New Chat button is clicked', async () => {
    const onSelect = vi.fn();

    render(
      <MockedProvider mocks={mocks} >
        <ChatSidebar {...defaultProps} selectedId="1" onSelect={onSelect} />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('+ New Chat')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('+ New Chat'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('shows confirmation dialog when switching conversations during streaming', async () => {
    const onSelect = vi.fn();

    render(
      <MockedProvider mocks={mocks} >
        <ChatSidebar {...defaultProps} selectedId="1" onSelect={onSelect} isStreaming={true} />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Find upbeat songs')).toBeInTheDocument();
    });

    // Click on a different conversation while streaming
    fireEvent.click(screen.getByText('Find upbeat songs'));

    // Should show confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Leave this page?')).toBeInTheDocument();
    });

    // onSelect should not have been called yet
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('formats relative time correctly', async () => {
    render(
      <MockedProvider mocks={mocks} >
        <ChatSidebar {...defaultProps} />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Tell me about jazz music')).toBeInTheDocument();
    });

    // First conversation should show "Just now" or similar recent time
    expect(screen.getByText(/Just now|m ago/)).toBeInTheDocument();
  });
});
