/**
 * Chat GraphQL Queries and Types
 *
 * Feature: 010-discover-chat
 *
 * Provides GraphQL operations for conversation management.
 * Streaming chat responses are handled via REST/SSE (see useChatStream hook).
 */

import { gql } from '@apollo/client';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Content block in a message */
export interface ContentBlock {
  type: string;
  text: string | null;
  toolId: string | null;
  toolName: string | null;
  toolInput: string | null;
  toolResult: string | null;
}

/** Single message in a conversation */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: ContentBlock[];
  createdAt: string;
}

/** Conversation summary for list view */
export interface Conversation {
  id: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

/** Chat error response */
export interface ChatError {
  __typename: 'ChatError';
  message: string;
  code: string;
  retryable: boolean;
}

/** Success response for conversation list */
export interface ConversationsList {
  __typename: 'ConversationsList';
  conversations: Conversation[];
  totalCount: number;
}

/** Success response for single conversation with messages */
export interface ConversationWithMessages {
  __typename: 'ConversationWithMessages';
  conversation: Conversation;
  messages: ChatMessage[];
}

/** Success response for delete operation */
export interface DeleteSuccess {
  __typename: 'DeleteSuccess';
  deletedId: string;
  message: string;
}

// Union type discriminators
export type ConversationsResult = ConversationsList | ChatError;
export type ConversationResult = ConversationWithMessages | ChatError;
export type DeleteConversationResult = DeleteSuccess | ChatError;

// Type guards
export function isConversationsList(
  result: ConversationsResult
): result is ConversationsList {
  return result.__typename === 'ConversationsList';
}

export function isConversationWithMessages(
  result: ConversationResult
): result is ConversationWithMessages {
  return result.__typename === 'ConversationWithMessages';
}

export function isDeleteSuccess(
  result: DeleteConversationResult
): result is DeleteSuccess {
  return result.__typename === 'DeleteSuccess';
}

export function isChatError(
  result: ConversationsResult | ConversationResult | DeleteConversationResult
): result is ChatError {
  return result.__typename === 'ChatError';
}

// -----------------------------------------------------------------------------
// Fragments
// -----------------------------------------------------------------------------

export const CONVERSATION_FRAGMENT = gql`
  fragment ConversationFields on Conversation {
    id
    preview
    createdAt
    updatedAt
    messageCount
  }
`;

export const MESSAGE_FRAGMENT = gql`
  fragment MessageFields on ChatMessage {
    id
    role
    content {
      type
      text
      toolId
      toolName
      toolInput
      toolResult
    }
    createdAt
  }
`;

export const CHAT_ERROR_FRAGMENT = gql`
  fragment ChatErrorFields on ChatError {
    message
    code
    retryable
  }
`;

// -----------------------------------------------------------------------------
// Queries
// -----------------------------------------------------------------------------

/** Get all conversations for the current user */
export const GET_CONVERSATIONS = gql`
  ${CONVERSATION_FRAGMENT}
  ${CHAT_ERROR_FRAGMENT}
  query GetConversations {
    conversations {
      __typename
      ... on ConversationsList {
        conversations {
          ...ConversationFields
        }
        totalCount
      }
      ... on ChatError {
        ...ChatErrorFields
      }
    }
  }
`;

export interface GetConversationsData {
  conversations: ConversationsResult;
}

/** Get a single conversation with all messages */
export const GET_CONVERSATION = gql`
  ${CONVERSATION_FRAGMENT}
  ${MESSAGE_FRAGMENT}
  ${CHAT_ERROR_FRAGMENT}
  query GetConversation($id: ID!) {
    conversation(id: $id) {
      __typename
      ... on ConversationWithMessages {
        conversation {
          ...ConversationFields
        }
        messages {
          ...MessageFields
        }
      }
      ... on ChatError {
        ...ChatErrorFields
      }
    }
  }
`;

export interface GetConversationData {
  conversation: ConversationResult;
}

export interface GetConversationVars {
  id: string;
}

// -----------------------------------------------------------------------------
// Mutations
// -----------------------------------------------------------------------------

/** Create a new empty conversation */
export const CREATE_CONVERSATION = gql`
  ${CONVERSATION_FRAGMENT}
  ${CHAT_ERROR_FRAGMENT}
  mutation CreateConversation {
    createConversation {
      __typename
      ... on ConversationWithMessages {
        conversation {
          ...ConversationFields
        }
        messages {
          id
          role
          content {
            type
            text
          }
          createdAt
        }
      }
      ... on ChatError {
        ...ChatErrorFields
      }
    }
  }
`;

export interface CreateConversationData {
  createConversation: ConversationResult;
}

/** Delete a conversation and all its messages */
export const DELETE_CONVERSATION = gql`
  ${CHAT_ERROR_FRAGMENT}
  mutation DeleteConversation($id: ID!) {
    deleteConversation(id: $id) {
      __typename
      ... on DeleteSuccess {
        deletedId
        message
      }
      ... on ChatError {
        ...ChatErrorFields
      }
    }
  }
`;

export interface DeleteConversationData {
  deleteConversation: DeleteConversationResult;
}

export interface DeleteConversationVars {
  id: string;
}
