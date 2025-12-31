/**
 * Single Conversation Hook
 *
 * Feature: 010-discover-chat
 *
 * Fetches a single conversation with its messages.
 */

import { useQuery } from '@apollo/client';
import {
  GET_CONVERSATION,
  GetConversationData,
  GetConversationVars,
  Conversation,
  ChatMessage,
  isConversationWithMessages,
  isChatError,
} from '../graphql/chat';

export interface UseConversationReturn {
  /** Conversation details */
  conversation: Conversation | null;
  /** Messages in the conversation */
  messages: ChatMessage[];
  /** Loading state */
  loading: boolean;
  /** Error message (null if no error) */
  error: string | null;
  /** Whether error is retryable */
  retryable: boolean;
  /** Refetch conversation */
  refetch: () => void;
}

export function useConversation(conversationId: string | null): UseConversationReturn {
  const { data, loading, error: apolloError, refetch } = useQuery<
    GetConversationData,
    GetConversationVars
  >(GET_CONVERSATION, {
    variables: { id: conversationId! },
    skip: !conversationId,
    fetchPolicy: 'cache-and-network',
  });

  // Handle GraphQL response
  if (data?.conversation) {
    if (isConversationWithMessages(data.conversation)) {
      return {
        conversation: data.conversation.conversation,
        messages: data.conversation.messages,
        loading,
        error: null,
        retryable: false,
        refetch,
      };
    }

    if (isChatError(data.conversation)) {
      return {
        conversation: null,
        messages: [],
        loading,
        error: data.conversation.message,
        retryable: data.conversation.retryable,
        refetch,
      };
    }
  }

  // Handle Apollo errors
  if (apolloError) {
    return {
      conversation: null,
      messages: [],
      loading,
      error: apolloError.message,
      retryable: true,
      refetch,
    };
  }

  // Default loading state
  return {
    conversation: null,
    messages: [],
    loading,
    error: null,
    retryable: false,
    refetch,
  };
}
