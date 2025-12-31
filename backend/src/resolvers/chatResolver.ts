/**
 * Chat GraphQL Resolvers
 *
 * Handles GraphQL queries and mutations for conversation management.
 * Streaming chat is handled via REST+SSE (see chatRoutes.ts).
 */

import { ChatService, ConversationWithComputed } from '../services/chatService.js';
import { Message, ContentBlock } from '../entities/Message.js';
import { logger } from '../utils/logger.js';
import { isTextBlock, isToolUseBlock, isToolResultBlock } from '../schemas/chat.js';

/**
 * GraphQL context with chat service
 */
interface ChatContext {
  chatService: ChatService;
}

/**
 * Error codes for chat operations
 */
type ChatErrorCode =
  | 'NOT_FOUND'
  | 'OPERATION_IN_PROGRESS'
  | 'DATABASE_ERROR'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR';

/**
 * Chat error type for GraphQL
 */
interface ChatError {
  __typename: 'ChatError';
  message: string;
  code: ChatErrorCode;
  retryable: boolean;
}

/**
 * GraphQL Conversation type
 */
interface GraphQLConversation {
  id: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

/**
 * GraphQL Message type
 */
interface GraphQLMessage {
  id: string;
  role: 'user' | 'assistant';
  content: GraphQLContentBlock[];
  createdAt: string;
}

/**
 * GraphQL ContentBlock type
 */
interface GraphQLContentBlock {
  type: string;
  text: string | null;
  toolId: string | null;
  toolName: string | null;
  toolInput: string | null;
  toolResult: string | null;
}

/**
 * Conversation list result
 */
interface ConversationsList {
  __typename: 'ConversationsList';
  conversations: GraphQLConversation[];
  totalCount: number;
}

/**
 * Conversation with messages result
 */
interface ConversationWithMessages {
  __typename: 'ConversationWithMessages';
  conversation: GraphQLConversation;
  messages: GraphQLMessage[];
}

/**
 * Delete success result
 */
interface DeleteSuccess {
  __typename: 'DeleteSuccess';
  deletedId: string;
  message: string;
}

/**
 * Transform Conversation entity for GraphQL response
 */
function toGraphQLConversation(conv: ConversationWithComputed): GraphQLConversation {
  return {
    id: conv.id,
    preview: conv.preview,
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString(),
    messageCount: conv.messageCount,
  };
}

/**
 * Transform Message entity for GraphQL response
 */
function toGraphQLMessage(msg: Message): GraphQLMessage {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content.map(toGraphQLContentBlock),
    createdAt: msg.createdAt.toISOString(),
  };
}

/**
 * Transform ContentBlock for GraphQL response
 */
function toGraphQLContentBlock(block: ContentBlock): GraphQLContentBlock {
  if (isTextBlock(block)) {
    return {
      type: 'text',
      text: block.text,
      toolId: null,
      toolName: null,
      toolInput: null,
      toolResult: null,
    };
  } else if (isToolUseBlock(block)) {
    return {
      type: 'tool_use',
      text: null,
      toolId: block.id,
      toolName: block.name,
      toolInput: JSON.stringify(block.input),
      toolResult: null,
    };
  } else if (isToolResultBlock(block)) {
    return {
      type: 'tool_result',
      text: null,
      toolId: block.tool_use_id,
      toolName: null,
      toolInput: null,
      toolResult: JSON.stringify(block.content),
    };
  }
  // Fallback for unknown types (shouldn't happen with proper validation)
  return {
    type: 'unknown',
    text: null,
    toolId: null,
    toolName: null,
    toolInput: null,
    toolResult: null,
  };
}

/**
 * Create error response
 */
function createError(message: string, code: ChatErrorCode, retryable: boolean): ChatError {
  return {
    __typename: 'ChatError',
    message,
    code,
    retryable,
  };
}

export const chatResolvers = {
  Query: {
    /**
     * List all conversations for the current user
     */
    conversations: async (
      _: unknown,
      __: unknown,
      context: ChatContext
    ): Promise<ConversationsList | ChatError> => {
      try {
        const conversations = await context.chatService.getConversations();

        return {
          __typename: 'ConversationsList',
          conversations: conversations.map(toGraphQLConversation),
          totalCount: conversations.length,
        };
      } catch (error) {
        logger.error('chat_list_conversations_error', {
          error: error instanceof Error ? error.message : String(error),
        });

        return createError(
          'Failed to load conversations. Please try again.',
          'DATABASE_ERROR',
          true
        );
      }
    },

    /**
     * Get a single conversation with all messages
     */
    conversation: async (
      _: unknown,
      { id }: { id: string },
      context: ChatContext
    ): Promise<ConversationWithMessages | ChatError> => {
      try {
        const result = await context.chatService.getConversation(id);

        if (!result) {
          return createError(
            'Conversation not found',
            'NOT_FOUND',
            false
          );
        }

        return {
          __typename: 'ConversationWithMessages',
          conversation: toGraphQLConversation(result.conversation),
          messages: result.messages.map(toGraphQLMessage),
        };
      } catch (error) {
        logger.error('chat_get_conversation_error', {
          conversationId: id,
          error: error instanceof Error ? error.message : String(error),
        });

        return createError(
          'Failed to load conversation. Please try again.',
          'DATABASE_ERROR',
          true
        );
      }
    },
  },

  Mutation: {
    /**
     * Delete a conversation and all its messages
     */
    deleteConversation: async (
      _: unknown,
      { id }: { id: string },
      context: ChatContext
    ): Promise<DeleteSuccess | ChatError> => {
      try {
        // Check if conversation exists first
        const exists = await context.chatService.conversationExists(id);
        if (!exists) {
          return createError(
            'Conversation not found',
            'NOT_FOUND',
            false
          );
        }

        const deleted = await context.chatService.deleteConversation(id);

        if (!deleted) {
          return createError(
            'Failed to delete conversation',
            'DATABASE_ERROR',
            true
          );
        }

        logger.info('chat_conversation_deleted', { conversationId: id });

        return {
          __typename: 'DeleteSuccess',
          deletedId: id,
          message: 'Conversation deleted successfully',
        };
      } catch (error) {
        logger.error('chat_delete_conversation_error', {
          conversationId: id,
          error: error instanceof Error ? error.message : String(error),
        });

        return createError(
          'Failed to delete conversation. Please try again.',
          'DATABASE_ERROR',
          true
        );
      }
    },

    /**
     * Create a new empty conversation
     */
    createConversation: async (
      _: unknown,
      __: unknown,
      context: ChatContext
    ): Promise<ConversationWithMessages | ChatError> => {
      try {
        const conversation = await context.chatService.createConversation();

        logger.info('chat_conversation_created', { conversationId: conversation.id });

        return {
          __typename: 'ConversationWithMessages',
          conversation: toGraphQLConversation(conversation),
          messages: [],
        };
      } catch (error) {
        logger.error('chat_create_conversation_error', {
          error: error instanceof Error ? error.message : String(error),
        });

        return createError(
          'Failed to create conversation. Please try again.',
          'DATABASE_ERROR',
          true
        );
      }
    },
  },

  // Union type resolvers
  ConversationsResult: {
    __resolveType(obj: ConversationsList | ChatError) {
      return obj.__typename;
    },
  },

  ConversationResult: {
    __resolveType(obj: ConversationWithMessages | ChatError) {
      return obj.__typename;
    },
  },

  DeleteConversationResult: {
    __resolveType(obj: DeleteSuccess | ChatError) {
      return obj.__typename;
    },
  },
};
