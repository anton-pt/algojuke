/**
 * Chat REST Routes
 *
 * Provides SSE streaming endpoint for chat responses.
 * GraphQL handles conversation list/history queries.
 */

import { Router, Request, Response } from 'express';
import { Repository } from 'typeorm';
import { ChatService } from '../services/chatService.js';
import { ChatStreamService, SSEEvent } from '../services/chatStreamService.js';
import { ChatStreamRequestSchema } from '../schemas/chat.js';
import { logger } from '../utils/logger.js';
import { DataSource } from 'typeorm';
import { DiscoveryService } from '../services/discoveryService.js';
import { TrackMetadataService } from '../services/trackMetadataService.js';
import { TidalService } from '../services/tidalService.js';
import { BackendQdrantClient } from '../clients/qdrantClient.js';
import { LibraryTrack } from '../entities/LibraryTrack.js';
import { LibraryAlbum } from '../entities/LibraryAlbum.js';

/**
 * Options for chat routes with tool support
 */
interface ChatRoutesOptions {
  dataSource: DataSource;
  discoveryService: DiscoveryService;
  trackMetadataService: TrackMetadataService;
  tidalService: TidalService;
  qdrantClient: BackendQdrantClient;
  libraryTrackRepository: Repository<LibraryTrack>;
  libraryAlbumRepository: Repository<LibraryAlbum>;
}

/**
 * Create chat routes with dependencies
 */
export function createChatRoutes(options: ChatRoutesOptions): Router {
  const router = Router();
  const chatService = new ChatService(options.dataSource);
  const streamService = new ChatStreamService(chatService, {
    discoveryService: options.discoveryService,
    trackMetadataService: options.trackMetadataService,
    tidalService: options.tidalService,
    qdrantClient: options.qdrantClient,
    libraryTrackRepository: options.libraryTrackRepository,
    libraryAlbumRepository: options.libraryAlbumRepository,
  });

  /**
   * POST /api/chat/stream
   *
   * Stream an AI response for a chat message via SSE.
   */
  router.post('/stream', async (req: Request, res: Response) => {
    // Validate request body
    const validation = ChatStreamRequestSchema.safeParse(req.body);
    if (!validation.success) {
      const errors = validation.error.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));

      logger.warn('chat_stream_validation_error', { errors });

      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: errors[0]?.message || 'Invalid request',
          details: errors,
        },
      });
    }

    const { message, conversationId } = validation.data;

    logger.info('chat_stream_request', {
      conversationId: conversationId || 'new',
      messageLength: message.length,
    });

    // Create abort controller for cancellation
    const abortController = new AbortController();

    // Handle client disconnect - use res.on('close') to detect actual disconnect
    // Note: req.on('close') fires when request body is received, NOT when client disconnects
    res.on('close', () => {
      // Only abort if we didn't close the response ourselves
      if (!res.writableFinished && !abortController.signal.aborted) {
        logger.info('chat_stream_client_disconnected', {
          conversationId: conversationId || 'new',
        });
        abortController.abort();
      }
    });

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Send SSE event helper
    const sendEvent = (event: SSEEvent) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    };

    try {
      // Stream the response
      await streamService.streamResponse(
        message,
        conversationId,
        sendEvent,
        abortController.signal
      );

      // End the response
      if (!res.writableEnded) {
        res.end();
      }
    } catch (error) {
      logger.error('chat_stream_route_error', {
        conversationId: conversationId || 'new',
        error: error instanceof Error ? error.message : String(error),
      });

      // Send error event if stream hasn't ended
      if (!res.writableEnded) {
        sendEvent({
          type: 'error',
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred. Please try again.',
          retryable: true,
        });
        res.end();
      }
    }
  });

  return router;
}

/**
 * Express middleware to attach chat routes
 */
export function chatRoutesMiddleware(options: ChatRoutesOptions) {
  return createChatRoutes(options);
}
