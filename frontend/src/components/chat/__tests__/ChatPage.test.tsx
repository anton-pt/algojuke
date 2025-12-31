/**
 * ChatPage Navigation Blocking Tests
 *
 * Feature: 010-discover-chat
 * Task: T023-CT
 *
 * Tests that navigation is blocked during active streaming.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { ChatPage } from '../ChatPage';
import { GET_CONVERSATIONS } from '../../../graphql/chat';

// Mock the useChatStream hook
vi.mock('../../../hooks/useChatStream', () => ({
  useChatStream: vi.fn(() => ({
    messages: [],
    conversationId: null,
    isStreaming: false,
    error: null,
    sendMessage: vi.fn(),
    cancelStream: vi.fn(),
    clearChat: vi.fn(),
    setConversationId: vi.fn(),
    setMessages: vi.fn(),
  })),
}));

// Import the mocked module
import { useChatStream } from '../../../hooks/useChatStream';

const mockConversations = [
  {
    __typename: 'Conversation' as const,
    id: '1',
    preview: 'Test conversation',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageCount: 2,
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

function renderChatPage() {
  return render(
    <MemoryRouter>
      <MockedProvider mocks={mocks} >
        <ChatPage />
      </MockedProvider>
    </MemoryRouter>
  );
}

describe('ChatPage Navigation Blocking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders ChatSidebar and ChatView', async () => {
    renderChatPage();

    // Should render the sidebar
    expect(screen.getByText('Conversations')).toBeInTheDocument();
    expect(screen.getByText('+ New Chat')).toBeInTheDocument();

    // Should render the chat view empty state
    await waitFor(() => {
      expect(screen.getByText('Start a conversation')).toBeInTheDocument();
    });
  });

  it('allows selecting conversation when not streaming', async () => {
    renderChatPage();

    await waitFor(() => {
      expect(screen.getByText('Test conversation')).toBeInTheDocument();
    });

    // Click on conversation
    fireEvent.click(screen.getByText('Test conversation'));

    // Should select without showing confirmation
    expect(screen.queryByText('Leave this page?')).not.toBeInTheDocument();
  });

  it('shows confirmation dialog when switching conversations during streaming', async () => {
    // Mock streaming state
    vi.mocked(useChatStream).mockReturnValue({
      messages: [
        {
          id: '1',
          role: 'user' as const,
          content: [{ type: 'text' as const, text: 'Hello', toolId: null, toolName: null, toolInput: null, toolResult: null }],
          createdAt: new Date().toISOString(),
        },
      ],
      conversationId: '1',
      isStreaming: true,
      error: null,
      sendMessage: vi.fn(),
      cancelStream: vi.fn(),
      clearChat: vi.fn(),
      setConversationId: vi.fn(),
      setMessages: vi.fn(),
    });

    renderChatPage();

    await waitFor(() => {
      expect(screen.getByText('Test conversation')).toBeInTheDocument();
    });

    // Try to click New Chat while streaming
    fireEvent.click(screen.getByText('+ New Chat'));

    // Should show confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Leave this page?')).toBeInTheDocument();
    });

    expect(screen.getByText(/A response is being generated/)).toBeInTheDocument();
  });

  it('stays on current conversation when user clicks Stay', async () => {
    vi.mocked(useChatStream).mockReturnValue({
      messages: [
        {
          id: '1',
          role: 'user' as const,
          content: [{ type: 'text' as const, text: 'Hello', toolId: null, toolName: null, toolInput: null, toolResult: null }],
          createdAt: new Date().toISOString(),
        },
      ],
      conversationId: '1',
      isStreaming: true,
      error: null,
      sendMessage: vi.fn(),
      cancelStream: vi.fn(),
      clearChat: vi.fn(),
      setConversationId: vi.fn(),
      setMessages: vi.fn(),
    });

    renderChatPage();

    await waitFor(() => {
      expect(screen.getByText('Test conversation')).toBeInTheDocument();
    });

    // Try to click New Chat
    fireEvent.click(screen.getByText('+ New Chat'));

    // Wait for dialog
    await waitFor(() => {
      expect(screen.getByText('Leave this page?')).toBeInTheDocument();
    });

    // Click Stay
    fireEvent.click(screen.getByText('Stay'));

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByText('Leave this page?')).not.toBeInTheDocument();
    });
  });

  it('navigates when user clicks Leave anyway', async () => {
    const mockClearChat = vi.fn();

    vi.mocked(useChatStream).mockReturnValue({
      messages: [
        {
          id: '1',
          role: 'user' as const,
          content: [{ type: 'text' as const, text: 'Hello', toolId: null, toolName: null, toolInput: null, toolResult: null }],
          createdAt: new Date().toISOString(),
        },
      ],
      conversationId: '1',
      isStreaming: true,
      error: null,
      sendMessage: vi.fn(),
      cancelStream: vi.fn(),
      clearChat: mockClearChat,
      setConversationId: vi.fn(),
      setMessages: vi.fn(),
    });

    renderChatPage();

    await waitFor(() => {
      expect(screen.getByText('Test conversation')).toBeInTheDocument();
    });

    // Try to click New Chat
    fireEvent.click(screen.getByText('+ New Chat'));

    // Wait for dialog
    await waitFor(() => {
      expect(screen.getByText('Leave this page?')).toBeInTheDocument();
    });

    // Click Leave anyway
    fireEvent.click(screen.getByText('Leave anyway'));

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByText('Leave this page?')).not.toBeInTheDocument();
    });
  });

  it('closes dialog when Escape key is pressed', async () => {
    vi.mocked(useChatStream).mockReturnValue({
      messages: [],
      conversationId: '1',
      isStreaming: true,
      error: null,
      sendMessage: vi.fn(),
      cancelStream: vi.fn(),
      clearChat: vi.fn(),
      setConversationId: vi.fn(),
      setMessages: vi.fn(),
    });

    renderChatPage();

    await waitFor(() => {
      expect(screen.getByText('Test conversation')).toBeInTheDocument();
    });

    // Try to click New Chat
    fireEvent.click(screen.getByText('+ New Chat'));

    // Wait for dialog
    await waitFor(() => {
      expect(screen.getByText('Leave this page?')).toBeInTheDocument();
    });

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByText('Leave this page?')).not.toBeInTheDocument();
    });
  });
});
