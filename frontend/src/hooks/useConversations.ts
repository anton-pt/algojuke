/**
 * Conversations List Hook
 *
 * Feature: 010-discover-chat
 *
 * Fetches and manages the list of conversations for the current user.
 */

import { useQuery } from '@apollo/client';
import {
  GET_CONVERSATIONS,
  GetConversationsData,
  Conversation,
  isConversationsList,
  isChatError,
} from '../graphql/chat';

export interface UseConversationsReturn {
  /** List of conversations */
  conversations: Conversation[];
  /** Total count of conversations */
  totalCount: number;
  /** Loading state */
  loading: boolean;
  /** Error message (null if no error) */
  error: string | null;
  /** Whether error is retryable */
  retryable: boolean;
  /** Refetch conversations */
  refetch: () => void;
}

export function useConversations(): UseConversationsReturn {
  const { data, loading, error: apolloError, refetch } = useQuery<GetConversationsData>(
    GET_CONVERSATIONS,
    {
      fetchPolicy: 'cache-and-network',
      pollInterval: 30000, // Poll every 30 seconds for updates
    }
  );

  // Handle GraphQL response
  if (data?.conversations) {
    if (isConversationsList(data.conversations)) {
      return {
        conversations: data.conversations.conversations,
        totalCount: data.conversations.totalCount,
        loading,
        error: null,
        retryable: false,
        refetch,
      };
    }

    if (isChatError(data.conversations)) {
      return {
        conversations: [],
        totalCount: 0,
        loading,
        error: data.conversations.message,
        retryable: data.conversations.retryable,
        refetch,
      };
    }
  }

  // Handle Apollo errors
  if (apolloError) {
    return {
      conversations: [],
      totalCount: 0,
      loading,
      error: apolloError.message,
      retryable: true,
      refetch,
    };
  }

  // Default loading state
  return {
    conversations: [],
    totalCount: 0,
    loading,
    error: null,
    retryable: false,
    refetch,
  };
}
