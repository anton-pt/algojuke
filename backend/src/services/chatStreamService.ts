/**
 * Chat Stream Service
 *
 * Handles AI response generation using Claude via Vercel AI SDK.
 * Integrates with Langfuse for observability.
 *
 * Feature 011-agent-tools:
 * - Tool definitions for semantic search, Tidal search, album tracks
 * - Multi-step agent workflows with stopWhen (AI SDK v6)
 * - SSE streaming for tool invocations
 */

import { streamText, tool, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { Repository } from 'typeorm';
import { ChatService } from './chatService.js';
import { Message, ContentBlock } from '../entities/Message.js';
import { getLangfuseClient, flushLangfuse, type DiscoveryTrace } from '../utils/langfuse.js';
import { logger } from '../utils/logger.js';
import { CHAT_SYSTEM_PROMPT } from '../prompts/chatSystemPrompt.js';

// Agent tool imports
import { DiscoveryService } from './discoveryService.js';
import { TrackMetadataService } from './trackMetadataService.js';
import { TidalService } from './tidalService.js';
import { BackendQdrantClient } from '../clients/qdrantClient.js';
import { LibraryTrack } from '../entities/LibraryTrack.js';
import { LibraryAlbum } from '../entities/LibraryAlbum.js';
import {
  SemanticSearchInputSchema,
  TidalSearchInputSchema,
  AlbumTracksInputSchema,
  BatchMetadataInputSchema,
  SuggestPlaylistInputSchema,
  type SemanticSearchInput,
  type TidalSearchInput,
  type AlbumTracksInput,
  type BatchMetadataInput,
  type SuggestPlaylistInput,
} from '../schemas/agentTools.js';
import type {
  SemanticSearchOutput,
  OptimizedSemanticSearchOutput,
  TidalSearchOutput,
  AlbumTracksOutput,
  BatchMetadataOutput,
  SuggestPlaylistOutput,
  ToolError,
} from '../types/agentTools.js';
import { executeSemanticSearch, type SemanticSearchContext } from './agentTools/semanticSearchTool.js';
import { executeTidalSearch, type TidalSearchContext } from './agentTools/tidalSearchTool.js';
import { executeAlbumTracks, type AlbumTracksContext } from './agentTools/albumTracksTool.js';
import { executeBatchMetadata, type BatchMetadataContext } from './agentTools/batchMetadataTool.js';
import { executeSuggestPlaylist, type SuggestPlaylistContext } from './agentTools/suggestPlaylistTool.js';
import { executeWithRetry } from './agentTools/retry.js';
import { createToolSpan } from './agentTools/tracing.js';

/**
 * Model ID for chat responses
 *
 * Configurable via CHAT_MODEL env var. Defaults to claude-haiku for cost efficiency.
 * Set to 'claude-sonnet-4-5' for better reasoning on complex agentic tasks.
 *
 * Valid models:
 * - claude-haiku-4-5-20251001 (default, fast/cheap)
 * - claude-sonnet-4-5-20241022 (better reasoning)
 * - claude-opus-4-5-20251101 (best quality)
 */
const CHAT_MODEL = process.env.CHAT_MODEL || 'claude-haiku-4-5-20251001';

/**
 * Maximum tokens for response generation
 */
const MAX_TOKENS = parseInt(process.env.CHAT_MAX_TOKENS || '4096', 10);

/**
 * Maximum steps for agent tool loops
 */
const MAX_STEPS = 20;

/**
 * Mock user ID for MVP (single-user system)
 */
const CURRENT_USER_ID = '00000000-0000-0000-0000-000000000001';

// System prompt imported from prompts/chatSystemPrompt.ts

/**
 * SSE Event types
 */
export interface MessageStartEvent {
  type: 'message_start';
  messageId: string;
  conversationId: string;
}

export interface TextDeltaEvent {
  type: 'text_delta';
  content: string;
}

export interface MessageEndEvent {
  type: 'message_end';
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface ErrorEvent {
  type: 'error';
  code: string;
  message: string;
  retryable: boolean;
}

/**
 * Tool call start event - sent when tool execution begins
 */
export interface ToolCallStartEvent {
  type: 'tool_call_start';
  toolCallId: string;
  toolName: string;
  input: unknown;
}

/**
 * Tool call end event - sent when tool completes successfully
 */
export interface ToolCallEndEvent {
  type: 'tool_call_end';
  toolCallId: string;
  summary: string;
  resultCount: number;
  durationMs: number;
  output?: unknown;
}

/**
 * Tool call error event - sent when tool execution fails
 */
export interface ToolCallErrorEvent {
  type: 'tool_call_error';
  toolCallId: string;
  error: string;
  retryable: boolean;
  wasRetried: boolean;
}

export type SSEEvent =
  | MessageStartEvent
  | TextDeltaEvent
  | MessageEndEvent
  | ErrorEvent
  | ToolCallStartEvent
  | ToolCallEndEvent
  | ToolCallErrorEvent;

/**
 * Stream response result
 */
export interface StreamResult {
  conversationId: string;
  assistantMessageId: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Ordered content part for tracking content in streaming order
 */
type OrderedContentPart =
  | { type: 'text'; content: string }
  | { type: 'tool'; toolCallId: string };

/**
 * Tool execution context passed to tool functions
 */
interface ToolContext {
  discoveryService: DiscoveryService;
  trackMetadataService: TrackMetadataService;
  tidalService: TidalService;
  qdrantClient: BackendQdrantClient;
  libraryTrackRepository: Repository<LibraryTrack>;
  libraryAlbumRepository: Repository<LibraryAlbum>;
  userId: string;
  onEvent: (event: SSEEvent) => void;
  trace: DiscoveryTrace | null;
  // Maps for tracking tool calls for persistence (Task 4.2)
  toolCallsMap: Map<string, { name: string; input: unknown }>;
  toolResultsMap: Map<string, unknown>;
}

/**
 * Chat Stream Service for handling AI response generation
 */
export class ChatStreamService {
  private chatService: ChatService;
  private discoveryService?: DiscoveryService;
  private trackMetadataService?: TrackMetadataService;
  private tidalService?: TidalService;
  private qdrantClient?: BackendQdrantClient;
  private libraryTrackRepository?: Repository<LibraryTrack>;
  private libraryAlbumRepository?: Repository<LibraryAlbum>;

  constructor(
    chatService: ChatService,
    options?: {
      discoveryService?: DiscoveryService;
      trackMetadataService?: TrackMetadataService;
      tidalService?: TidalService;
      qdrantClient?: BackendQdrantClient;
      libraryTrackRepository?: Repository<LibraryTrack>;
      libraryAlbumRepository?: Repository<LibraryAlbum>;
    }
  ) {
    this.chatService = chatService;
    this.discoveryService = options?.discoveryService;
    this.trackMetadataService = options?.trackMetadataService;
    this.tidalService = options?.tidalService;
    this.qdrantClient = options?.qdrantClient;
    this.libraryTrackRepository = options?.libraryTrackRepository;
    this.libraryAlbumRepository = options?.libraryAlbumRepository;
  }

  /**
   * Create tool definitions for agent
   *
   * Uses the tool() helper from AI SDK. Type inference is handled by the
   * `any` type assertion in streamOptions to avoid memory issues.
   */
  private createTools(context: ToolContext) {
    const semanticSearchTool = tool({
      description: 'Search the user\'s indexed library by lyrical themes and interpreted meaning. IMPORTANT: This tool matches based on LYRICS INTERPRETATION, not musical style or audio features. A query like "ambient music" will find tracks with ambient themes in lyrics, NOT necessarily ambient-sounding music. For style/genre recommendations, use your music knowledge with tidalSearch instead. Results include shortDescription for each track.',
      inputSchema: SemanticSearchInputSchema,
      execute: async (input, options) => {
        const typedInput = input as SemanticSearchInput;
        const toolCallId = options.toolCallId;

        // Track tool call for persistence (Task 4.2)
        context.toolCallsMap.set(toolCallId, { name: 'semanticSearch', input });

        // Emit tool_call_start
        context.onEvent({
          type: 'tool_call_start',
          toolCallId,
          toolName: 'semanticSearch',
          input,
        });

        const span = createToolSpan(context.trace, {
          toolName: 'semanticSearch',
          toolCallId,
          input,
        });

        const startTime = Date.now();

        try {
          const semanticContext: SemanticSearchContext = {
            discoveryService: context.discoveryService,
            trackMetadataService: context.trackMetadataService,
            libraryTrackRepository: context.libraryTrackRepository,
            libraryAlbumRepository: context.libraryAlbumRepository,
            userId: context.userId,
          };

          const { result, wasRetried } = await executeWithRetry(
            async () => executeSemanticSearch(typedInput, semanticContext),
            'semanticSearch'
          );

          const durationMs = Date.now() - startTime;

          span.endSuccess({
            summary: result.summary,
            resultCount: result.totalFound,
            durationMs,
            metadata: { wasRetried },
          });

          // Track tool result for persistence (Task 4.2)
          context.toolResultsMap.set(toolCallId, result);

          // Emit tool_call_end with output for frontend expand/collapse
          context.onEvent({
            type: 'tool_call_end',
            toolCallId,
            summary: result.summary,
            resultCount: result.totalFound,
            durationMs,
            output: result,
          });

          return result;
        } catch (error) {
          const durationMs = Date.now() - startTime;
          const toolError = error as ToolError;
          const errorMessage = error instanceof Error ? error.message : String(error);
          const retryable = 'retryable' in toolError ? toolError.retryable : true;
          const wasRetried = 'wasRetried' in toolError ? toolError.wasRetried : false;

          span.endError({
            error: errorMessage,
            retryable,
            wasRetried,
            durationMs,
          });

          // Track error result for persistence (Task 4.2)
          context.toolResultsMap.set(toolCallId, { error: errorMessage, retryable });

          // Emit tool_call_error
          context.onEvent({
            type: 'tool_call_error',
            toolCallId,
            error: errorMessage,
            retryable,
            wasRetried,
          });

          throw error;
        }
      },
    });

    const tidalSearchTool = tool({
      description: 'Search the Tidal music catalogue by artist name, album name, or track title. IMPORTANT: This tool only supports text-based keyword search - it does NOT understand mood, theme, or semantic queries. For mood-based requests, use semanticSearch first, then use this tool with specific artist/album names you know match the mood. Returns results with library and index status flags.',
      inputSchema: TidalSearchInputSchema,
      execute: async (input, options) => {
        const typedInput = input as TidalSearchInput;
        const toolCallId = options.toolCallId;

        // Track tool call for persistence (Task 4.2)
        context.toolCallsMap.set(toolCallId, { name: 'tidalSearch', input });

        context.onEvent({
          type: 'tool_call_start',
          toolCallId,
          toolName: 'tidalSearch',
          input,
        });

        const span = createToolSpan(context.trace, {
          toolName: 'tidalSearch',
          toolCallId,
          input,
        });

        const startTime = Date.now();

        try {
          const tidalContext: TidalSearchContext = {
            tidalService: context.tidalService,
            qdrantClient: context.qdrantClient,
            libraryTrackRepository: context.libraryTrackRepository,
            libraryAlbumRepository: context.libraryAlbumRepository,
            userId: context.userId,
          };

          const { result, wasRetried } = await executeWithRetry(
            async () => executeTidalSearch(typedInput, tidalContext),
            'tidalSearch'
          );

          const durationMs = Date.now() - startTime;
          const resultCount =
            (result.totalFound.tracks || 0) + (result.totalFound.albums || 0);

          span.endSuccess({
            summary: result.summary,
            resultCount,
            durationMs,
            metadata: { wasRetried },
          });

          // Track tool result for persistence (Task 4.2)
          context.toolResultsMap.set(toolCallId, result);

          context.onEvent({
            type: 'tool_call_end',
            toolCallId,
            summary: result.summary,
            resultCount,
            durationMs,
            output: result,
          });

          return result;
        } catch (error) {
          const durationMs = Date.now() - startTime;
          const toolError = error as ToolError;
          const errorMessage = error instanceof Error ? error.message : String(error);
          const retryable = 'retryable' in toolError ? toolError.retryable : true;
          const wasRetried = 'wasRetried' in toolError ? toolError.wasRetried : false;

          span.endError({
            error: errorMessage,
            retryable,
            wasRetried,
            durationMs,
          });

          // Track error result for persistence (Task 4.2)
          context.toolResultsMap.set(toolCallId, { error: errorMessage, retryable });

          context.onEvent({
            type: 'tool_call_error',
            toolCallId,
            error: errorMessage,
            retryable,
            wasRetried,
          });

          throw error;
        }
      },
    });

    const albumTracksTool = tool({
      description: 'Get all tracks from a specific album by its Tidal album ID. Use this after tidalSearch to see the full track listing of an album.',
      inputSchema: AlbumTracksInputSchema,
      execute: async (input, options) => {
        const typedInput = input as AlbumTracksInput;
        const toolCallId = options.toolCallId;

        // Track tool call for persistence (Task 4.2)
        context.toolCallsMap.set(toolCallId, { name: 'albumTracks', input });

        context.onEvent({
          type: 'tool_call_start',
          toolCallId,
          toolName: 'albumTracks',
          input,
        });

        const span = createToolSpan(context.trace, {
          toolName: 'albumTracks',
          toolCallId,
          input,
        });

        const startTime = Date.now();

        try {
          const albumContext: AlbumTracksContext = {
            tidalService: context.tidalService,
            qdrantClient: context.qdrantClient,
            libraryTrackRepository: context.libraryTrackRepository,
            libraryAlbumRepository: context.libraryAlbumRepository,
            userId: context.userId,
          };

          const { result, wasRetried } = await executeWithRetry(
            async () => executeAlbumTracks(typedInput, albumContext),
            'albumTracks'
          );

          const durationMs = Date.now() - startTime;
          const resultCount = result.tracks.length;

          span.endSuccess({
            summary: result.summary,
            resultCount,
            durationMs,
            metadata: { wasRetried },
          });

          // Track tool result for persistence (Task 4.2)
          context.toolResultsMap.set(toolCallId, result);

          context.onEvent({
            type: 'tool_call_end',
            toolCallId,
            summary: result.summary,
            resultCount,
            durationMs,
            output: result,
          });

          return result;
        } catch (error) {
          const durationMs = Date.now() - startTime;
          const toolError = error as ToolError;
          const errorMessage = error instanceof Error ? error.message : String(error);
          const retryable = 'retryable' in toolError ? toolError.retryable : true;
          const wasRetried = 'wasRetried' in toolError ? toolError.wasRetried : false;

          span.endError({
            error: errorMessage,
            retryable,
            wasRetried,
            durationMs,
          });

          // Track error result for persistence (Task 4.2)
          context.toolResultsMap.set(toolCallId, { error: errorMessage, retryable });

          context.onEvent({
            type: 'tool_call_error',
            toolCallId,
            error: errorMessage,
            retryable,
            wasRetried,
          });

          throw error;
        }
      },
    });

    const batchMetadataTool = tool({
      description: 'Get full metadata (lyrics, interpretation, audio features) for multiple tracks by their ISRCs. Use this to get detailed information about specific tracks you want to recommend. Maximum 100 ISRCs per request.',
      inputSchema: BatchMetadataInputSchema,
      execute: async (input, options) => {
        const typedInput = input as BatchMetadataInput;
        const toolCallId = options.toolCallId;

        // Track tool call for persistence (Task 4.2)
        context.toolCallsMap.set(toolCallId, { name: 'batchMetadata', input });

        context.onEvent({
          type: 'tool_call_start',
          toolCallId,
          toolName: 'batchMetadata',
          input,
        });

        const span = createToolSpan(context.trace, {
          toolName: 'batchMetadata',
          toolCallId,
          input,
        });

        const startTime = Date.now();

        try {
          const batchContext: BatchMetadataContext = {
            qdrantClient: context.qdrantClient,
            libraryTrackRepository: context.libraryTrackRepository,
            libraryAlbumRepository: context.libraryAlbumRepository,
            userId: context.userId,
          };

          const { result, wasRetried } = await executeWithRetry(
            async () => executeBatchMetadata(typedInput, batchContext),
            'batchMetadata'
          );

          const durationMs = Date.now() - startTime;
          const resultCount = result.tracks.length;

          span.endSuccess({
            summary: result.summary,
            resultCount,
            durationMs,
            metadata: { wasRetried, notFoundCount: result.notFound.length },
          });

          // Track tool result for persistence (Task 4.2)
          context.toolResultsMap.set(toolCallId, result);

          context.onEvent({
            type: 'tool_call_end',
            toolCallId,
            summary: result.summary,
            resultCount,
            durationMs,
            output: result,
          });

          return result;
        } catch (error) {
          const durationMs = Date.now() - startTime;
          const toolError = error as ToolError;
          const errorMessage = error instanceof Error ? error.message : String(error);
          const retryable = 'retryable' in toolError ? toolError.retryable : true;
          const wasRetried = 'wasRetried' in toolError ? toolError.wasRetried : false;

          span.endError({
            error: errorMessage,
            retryable,
            wasRetried,
            durationMs,
          });

          // Track error result for persistence (Task 4.2)
          context.toolResultsMap.set(toolCallId, { error: errorMessage, retryable });

          context.onEvent({
            type: 'tool_call_error',
            toolCallId,
            error: errorMessage,
            retryable,
            wasRetried,
          });

          throw error;
        }
      },
    });

    const suggestPlaylistTool = tool({
      description: 'Present a curated playlist to the user with visual album artwork. Use this ONLY when you have finalized your track selection and are ready to present the playlist. The tool enriches each track with Tidal metadata (album artwork, duration). Provide a descriptive title and include a one-sentence reasoning for each track explaining why it fits the playlist.',
      inputSchema: SuggestPlaylistInputSchema,
      execute: async (input, options) => {
        const typedInput = input as SuggestPlaylistInput;
        const toolCallId = options.toolCallId;

        // Track tool call for persistence (Task 4.2)
        context.toolCallsMap.set(toolCallId, { name: 'suggestPlaylist', input });

        context.onEvent({
          type: 'tool_call_start',
          toolCallId,
          toolName: 'suggestPlaylist',
          input,
        });

        const span = createToolSpan(context.trace, {
          toolName: 'suggestPlaylist',
          toolCallId,
          input,
        });

        const startTime = Date.now();

        try {
          const playlistContext: SuggestPlaylistContext = {
            tidalService: context.tidalService,
          };

          // Note: suggestPlaylist does its own retry logic internally
          const result = await executeSuggestPlaylist(typedInput, playlistContext);

          const durationMs = Date.now() - startTime;
          const resultCount = result.tracks.length;

          span.endSuccess({
            summary: result.summary,
            resultCount,
            durationMs,
            metadata: {
              enrichedTracks: result.stats.enrichedTracks,
              failedTracks: result.stats.failedTracks,
            },
          });

          // Track tool result for persistence (Task 4.2)
          context.toolResultsMap.set(toolCallId, result);

          // Emit tool_call_end with full output for PlaylistCard rendering
          context.onEvent({
            type: 'tool_call_end',
            toolCallId,
            summary: result.summary,
            resultCount,
            durationMs,
            output: result,
          });

          return result;
        } catch (error) {
          const durationMs = Date.now() - startTime;
          const toolError = error as ToolError;
          const errorMessage = error instanceof Error ? error.message : String(error);
          const retryable = 'retryable' in toolError ? toolError.retryable : true;
          const wasRetried = 'wasRetried' in toolError ? toolError.wasRetried : false;

          span.endError({
            error: errorMessage,
            retryable,
            wasRetried,
            durationMs,
          });

          // Track error result for persistence (Task 4.2)
          context.toolResultsMap.set(toolCallId, { error: errorMessage, retryable });

          context.onEvent({
            type: 'tool_call_error',
            toolCallId,
            error: errorMessage,
            retryable,
            wasRetried,
          });

          throw error;
        }
      },
    });

    return {
      semanticSearch: semanticSearchTool,
      tidalSearch: tidalSearchTool,
      albumTracks: albumTracksTool,
      batchMetadata: batchMetadataTool,
      suggestPlaylist: suggestPlaylistTool,
    };
  }

  /**
   * Check if tools are available
   */
  private hasToolSupport(): boolean {
    return !!(
      this.discoveryService &&
      this.trackMetadataService &&
      this.tidalService &&
      this.qdrantClient &&
      this.libraryTrackRepository &&
      this.libraryAlbumRepository
    );
  }

  /**
   * Stream a chat response
   *
   * @param message User message text
   * @param conversationId Optional existing conversation ID
   * @param onEvent Callback for SSE events
   * @param signal AbortSignal for cancellation
   * @returns Stream result with IDs and token usage
   */
  async streamResponse(
    message: string,
    conversationId: string | undefined,
    onEvent: (event: SSEEvent) => void,
    signal?: AbortSignal
  ): Promise<StreamResult | null> {
    let conversation: { id: string };
    let existingMessages: Message[] = [];
    let assistantMessageId = '';
    let inputTokens = 0;
    let outputTokens = 0;
    const contentBlocks: ContentBlock[] = [];

    // Track tool calls for persistence
    const toolCallsMap = new Map<string, { name: string; input: unknown }>();
    const toolResultsMap = new Map<string, unknown>();

    // Track content in streaming order for correct persistence
    // This ensures tools appear inline where they were called, not grouped at end
    const orderedParts: OrderedContentPart[] = [];
    let currentTextBuffer = '';

    try {
      // Create or get conversation
      if (conversationId) {
        const exists = await this.chatService.conversationExists(conversationId);
        if (!exists) {
          onEvent({
            type: 'error',
            code: 'NOT_FOUND',
            message: 'Conversation not found',
            retryable: false,
          });
          return null;
        }

        // Get existing messages for context
        existingMessages = await this.chatService.getConversationMessages(conversationId);

        // Add user message
        await this.chatService.addUserMessage(conversationId, message);
        conversation = { id: conversationId };
      } else {
        // Create new conversation with user message
        const result = await this.chatService.createConversationWithMessage(message);
        conversation = result.conversation;
        conversationId = conversation.id;
      }

      // Build message history for LLM
      const llmMessages = this.buildLLMMessages(existingMessages, message);

      // Create Langfuse trace with conversation as session
      // Note: Per-step LLM generation tracking is handled by OpenTelemetry via experimental_telemetry
      const langfuseClient = getLangfuseClient();
      const trace = langfuseClient?.trace({
        name: 'chat-message',
        sessionId: conversationId,
        metadata: {
          messageContent: message.slice(0, 100),
          messageCount: llmMessages.length,
          toolsEnabled: this.hasToolSupport(),
        },
        tags: ['chat', 'discover', ...(this.hasToolSupport() ? ['tools'] : [])],
      });

      // Send message_start event
      // We'll update with real message ID after saving
      const tempMessageId = `temp-${Date.now()}`;
      onEvent({
        type: 'message_start',
        messageId: tempMessageId,
        conversationId: conversationId!,
      });

      // Track timing for SC-001 (first token within 3 seconds)
      const requestStartTime = Date.now();
      let timeToFirstToken: number | null = null;

      // Stream response from Claude
      logger.info('chat_stream_starting_llm', {
        conversationId,
        model: CHAT_MODEL,
        messageCount: llmMessages.length,
        toolsEnabled: this.hasToolSupport(),
      });

      // Check if signal is already aborted before making API call
      if (signal?.aborted) {
        logger.warn('chat_stream_signal_already_aborted', { conversationId });
        return null;
      }

      // Create tool context if tools are available
      const toolContext: ToolContext | null = this.hasToolSupport()
        ? {
            discoveryService: this.discoveryService!,
            trackMetadataService: this.trackMetadataService!,
            tidalService: this.tidalService!,
            qdrantClient: this.qdrantClient!,
            libraryTrackRepository: this.libraryTrackRepository!,
            libraryAlbumRepository: this.libraryAlbumRepository!,
            userId: CURRENT_USER_ID,
            onEvent,
            trace: trace ?? null,
            // Task 4.2: Pass tracking maps for persistence
            toolCallsMap,
            toolResultsMap,
          }
        : null;

      // Build streamText options - conditionally include tools
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const streamOptions: any = {
        model: anthropic(CHAT_MODEL),
        system: CHAT_SYSTEM_PROMPT,
        messages: llmMessages,
        maxOutputTokens: MAX_TOKENS,
        abortSignal: signal,
        // Enable OpenTelemetry integration for per-step Langfuse tracing
        // This automatically creates generation spans for each LLM call with system prompt
        experimental_telemetry: {
          isEnabled: true,
          functionId: 'chat-stream',
          metadata: {
            conversationId,
            messageCount: llmMessages.length,
            toolsEnabled: this.hasToolSupport(),
          },
        },
        onError: ({ error }: { error: unknown }) => {
          logger.error('chat_stream_on_error', {
            conversationId,
            error: error instanceof Error ? error.message : String(error),
          });
        },
        onChunk: ({ chunk }: { chunk: { type: string } }) => {
          logger.debug('chat_stream_on_chunk', {
            conversationId,
            chunkType: chunk.type,
          });
        },
        onFinish: ({ text, finishReason, usage, response }: { text?: string; finishReason: string; usage: unknown; response?: { id: string } }) => {
          logger.info('chat_stream_on_finish', {
            conversationId,
            finishReason,
            textLength: text?.length,
            usage,
            responseId: response?.id,
          });
        },
      };

      // Add tools if tool support is available
      // In AI SDK v6, use stopWhen: stepCountIs(N) instead of maxSteps for multi-step tool calling
      if (toolContext) {
        streamOptions.tools = this.createTools(toolContext);
        streamOptions.stopWhen = stepCountIs(MAX_STEPS);
      }

      const result = streamText(streamOptions);

      logger.info('chat_stream_llm_started', { conversationId });

      // Stream all events including tool calls using fullStream for multi-step support
      // Using fullStream instead of textStream is required for stopWhen to work properly
      // See: https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
      let chunkCount = 0;
      let wasAborted = false;
      try {
        for await (const event of result.fullStream) {
          // Handle abort signal
          if (signal?.aborted) {
            logger.info('chat_stream_signal_aborted_in_loop', { conversationId, chunkCount });
            wasAborted = true;
            break;
          }

          // Handle different event types from fullStream
          switch (event.type) {
            case 'text-delta':
              chunkCount++;

              // Track time to first token (SC-001)
              if (chunkCount === 1) {
                timeToFirstToken = Date.now() - requestStartTime;
                logger.info('chat_stream_first_token', {
                  conversationId,
                  timeToFirstTokenMs: timeToFirstToken,
                  meetsTarget: timeToFirstToken <= 3000, // SC-001: within 3 seconds
                });
              }

              // Accumulate text in buffer for ordered persistence
              currentTextBuffer += event.text;
              onEvent({
                type: 'text_delta',
                content: event.text,
              });
              break;

            case 'tool-call':
              // Tool call detected - flush accumulated text and record tool position
              // This ensures content blocks are ordered: text → tool → text → tool → ...
              if (currentTextBuffer.length > 0) {
                orderedParts.push({ type: 'text', content: currentTextBuffer });
                currentTextBuffer = '';
              }
              orderedParts.push({ type: 'tool', toolCallId: event.toolCallId });
              logger.debug('chat_stream_tool_call', {
                conversationId,
                toolCallId: event.toolCallId,
                toolName: event.toolName,
              });
              break;

            case 'finish-step':
              // Log step completion for debugging multi-step flows
              logger.debug('chat_stream_finish_step', {
                conversationId,
                finishReason: event.finishReason,
              });
              break;

            case 'finish':
              // Final finish event - log completion
              logger.info('chat_stream_finish', {
                conversationId,
                finishReason: event.finishReason,
              });
              break;

            case 'error':
              // Handle streaming errors
              logger.error('chat_stream_error_event', {
                conversationId,
                error: event.error,
              });
              break;

            // Tool call events are handled by the tool's execute function
            // which emits tool_call_start/tool_call_end/tool_call_error events
            default:
              // Log other event types for debugging
              logger.debug('chat_stream_event', {
                conversationId,
                eventType: event.type,
              });
              break;
          }
        }

        // Handle abort case - save partial content and exit cleanly
        const totalTextLength = currentTextBuffer.length + orderedParts.filter(p => p.type === 'text').reduce((sum, p) => sum + (p as { type: 'text'; content: string }).content.length, 0);
        if (wasAborted && (totalTextLength > 0 || toolCallsMap.size > 0) && conversationId) {
          logger.info('chat_stream_saving_partial_on_abort', {
            conversationId,
            chunkCount,
            contentLength: totalTextLength,
            toolCallCount: toolCallsMap.size,
          });

          try {
            // Flush any remaining text buffer
            if (currentTextBuffer.length > 0) {
              orderedParts.push({ type: 'text', content: currentTextBuffer });
            }

            // Build content blocks from ordered parts (Task 4.2 fix)
            for (const part of orderedParts) {
              if (part.type === 'text') {
                contentBlocks.push({ type: 'text', text: part.content });
              } else if (part.type === 'tool') {
                const toolCall = toolCallsMap.get(part.toolCallId);
                if (toolCall) {
                  contentBlocks.push({
                    type: 'tool_use',
                    id: part.toolCallId,
                    name: toolCall.name,
                    input: toolCall.input,
                  });

                  const toolResult = toolResultsMap.get(part.toolCallId);
                  if (toolResult !== undefined) {
                    contentBlocks.push({
                      type: 'tool_result',
                      tool_use_id: part.toolCallId,
                      content: toolResult,
                    });
                  }
                }
              }
            }

            const assistantMessage = await this.chatService.addAssistantMessage(
              conversationId,
              contentBlocks.length > 0 ? contentBlocks : [{ type: 'text', text: '' }]
            );
            assistantMessageId = assistantMessage.id;

            // Flush Langfuse (OpenTelemetry handles generation spans automatically)
            await flushLangfuse();

            logger.info('chat_stream_partial_saved', {
              conversationId,
              assistantMessageId,
              contentLength: totalTextLength,
            });
          } catch (saveError) {
            logger.error('chat_save_partial_on_abort_failed', {
              conversationId,
              error: saveError instanceof Error ? saveError.message : String(saveError),
            });
          }

          return {
            conversationId,
            assistantMessageId,
            inputTokens: 0,
            outputTokens: 0,
          };
        }

        // Get finish reason for logging (only if not aborted)
        const finishReason = await result.finishReason;

        // Calculate total text content length for logging
        const completedTextLength = currentTextBuffer.length + orderedParts.filter(p => p.type === 'text').reduce((sum, p) => sum + (p as { type: 'text'; content: string }).content.length, 0);
        logger.info('chat_stream_loop_completed', {
          conversationId,
          chunkCount,
          contentLength: completedTextLength,
          finishReason,
        });
      } catch (streamError) {
        logger.error('chat_stream_loop_error', {
          conversationId,
          chunkCount,
          error: streamError instanceof Error ? streamError.message : String(streamError),
          stack: streamError instanceof Error ? streamError.stack : undefined,
        });
        throw streamError;
      }

      // Get usage info
      const usage = await result.usage;
      inputTokens = usage.inputTokens ?? 0;
      outputTokens = usage.outputTokens ?? 0;

      // Flush any remaining text buffer to ordered parts
      if (currentTextBuffer.length > 0) {
        orderedParts.push({ type: 'text', content: currentTextBuffer });
        currentTextBuffer = '';
      }

      // Build final content blocks in streaming order (Task 4.2 fix)
      // This ensures tool invocations appear inline where they were called
      for (const part of orderedParts) {
        if (part.type === 'text') {
          contentBlocks.push({ type: 'text', text: part.content });
        } else if (part.type === 'tool') {
          const toolCall = toolCallsMap.get(part.toolCallId);
          if (toolCall) {
            // Add tool_use block
            contentBlocks.push({
              type: 'tool_use',
              id: part.toolCallId,
              name: toolCall.name,
              input: toolCall.input,
            });

            // Add tool_result block (if we have a result)
            const toolResult = toolResultsMap.get(part.toolCallId);
            if (toolResult !== undefined) {
              contentBlocks.push({
                type: 'tool_result',
                tool_use_id: part.toolCallId,
                content: toolResult,
              });
            }
          }
        }
      }

      // Save assistant message
      const assistantMessage = await this.chatService.addAssistantMessage(
        conversationId!,
        contentBlocks.length > 0 ? contentBlocks : [{ type: 'text', text: '' }]
      );
      assistantMessageId = assistantMessage.id;

      // Note: Per-step LLM generation tracking is handled by OpenTelemetry via experimental_telemetry
      // Logging timing metadata for observability (SC-001)
      const totalDurationMs = Date.now() - requestStartTime;

      // Send message_end event
      onEvent({
        type: 'message_end',
        usage: {
          inputTokens,
          outputTokens,
        },
      });

      // Flush Langfuse events
      await flushLangfuse();

      // Calculate total content length for logging
      const finalContentLength = contentBlocks.filter(b => b.type === 'text').reduce((sum, b) => sum + ((b as { type: 'text'; text: string }).text?.length || 0), 0);
      logger.info('chat_stream_completed', {
        conversationId,
        inputTokens,
        outputTokens,
        contentLength: finalContentLength,
        timeToFirstTokenMs: timeToFirstToken,
        totalDurationMs,
      });

      return {
        conversationId: conversationId!,
        assistantMessageId,
        inputTokens,
        outputTokens,
      };
    } catch (error) {
      // Save partial content if we have any (Task 4.2: include tool blocks in order)
      const errorTotalTextLength = currentTextBuffer.length + orderedParts.filter(p => p.type === 'text').reduce((sum, p) => sum + (p as { type: 'text'; content: string }).content.length, 0);
      if ((errorTotalTextLength > 0 || toolCallsMap.size > 0) && conversationId) {
        try {
          // Flush any remaining text buffer
          if (currentTextBuffer.length > 0) {
            orderedParts.push({ type: 'text', content: currentTextBuffer });
          }

          // Build content blocks from ordered parts
          const errorContentBlocks: ContentBlock[] = [];
          for (const part of orderedParts) {
            if (part.type === 'text') {
              errorContentBlocks.push({ type: 'text', text: part.content });
            } else if (part.type === 'tool') {
              const toolCall = toolCallsMap.get(part.toolCallId);
              if (toolCall) {
                errorContentBlocks.push({
                  type: 'tool_use',
                  id: part.toolCallId,
                  name: toolCall.name,
                  input: toolCall.input,
                });

                const toolResult = toolResultsMap.get(part.toolCallId);
                if (toolResult !== undefined) {
                  errorContentBlocks.push({
                    type: 'tool_result',
                    tool_use_id: part.toolCallId,
                    content: toolResult,
                  });
                }
              }
            }
          }

          const assistantMessage = await this.chatService.addAssistantMessage(
            conversationId,
            errorContentBlocks.length > 0 ? errorContentBlocks : [{ type: 'text', text: '' }]
          );
          assistantMessageId = assistantMessage.id;
        } catch (saveError) {
          logger.error('chat_save_partial_failed', {
            conversationId,
            error: saveError instanceof Error ? saveError.message : String(saveError),
          });
        }
      }

      // Determine error type
      if (signal?.aborted) {
        logger.info('chat_stream_aborted', {
          conversationId,
          partialContentLength: errorTotalTextLength,
        });
        // Don't send error for user-initiated abort
        return conversationId
          ? {
              conversationId,
              assistantMessageId,
              inputTokens,
              outputTokens,
            }
          : null;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('chat_stream_error', {
        conversationId,
        error: errorMessage,
      });

      // Check for specific error types
      let code = 'INTERNAL_ERROR';
      let userMessage = 'An unexpected error occurred. Please try again.';
      let retryable = true;

      if (errorMessage.includes('API key') || errorMessage.includes('authentication')) {
        code = 'AI_SERVICE_UNAVAILABLE';
        userMessage = 'The AI service is temporarily unavailable. Please try again later.';
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        code = 'RATE_LIMITED';
        userMessage = 'Too many requests. Please wait a moment and try again.';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
        code = 'TIMEOUT';
        userMessage = 'The request timed out. Please try again.';
      }

      onEvent({
        type: 'error',
        code,
        message: userMessage,
        retryable,
      });

      return null;
    }
  }

  /**
   * Build LLM message array from conversation history
   */
  private buildLLMMessages(
    existingMessages: Message[],
    newMessage: string
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Add existing messages
    for (const msg of existingMessages) {
      const textContent = this.extractTextContent(msg.content);
      if (textContent) {
        messages.push({
          role: msg.role,
          content: textContent,
        });
      }
    }

    // Add new user message
    messages.push({
      role: 'user',
      content: newMessage,
    });

    // Apply context limit (100K tokens ~ keep last 10 messages as safety)
    // For now, we'll use a simple message count limit
    const MAX_MESSAGES = 20; // 10 exchanges = 20 messages
    if (messages.length > MAX_MESSAGES) {
      return messages.slice(-MAX_MESSAGES);
    }

    return messages;
  }

  /**
   * Extract text content from content blocks
   */
  private extractTextContent(content: ContentBlock[]): string | null {
    const textBlocks = content.filter(b => b.type === 'text') as Array<{ type: 'text'; text: string }>;
    if (textBlocks.length === 0) {
      return null;
    }
    return textBlocks.map(b => b.text).join('\n');
  }
}
