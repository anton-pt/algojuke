import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
import { CacheService } from './services/cacheService.js';
import { TidalTokenService } from './services/tidalTokenService.js';
import { TidalService } from './services/tidalService.js';
import { LibraryService } from './services/libraryService.js';
import { IngestionScheduler } from './services/ingestionScheduler.js';
import { createBackendQdrantClient } from './clients/qdrantClient.js';
import { searchResolver } from './resolvers/searchResolver.js';
import { libraryResolvers } from './resolvers/library.js';
import { trackMetadataResolvers } from './resolvers/trackMetadata.js';
import { discoveryResolvers } from './resolvers/discoveryResolver.js';
import { chatResolvers } from './resolvers/chatResolver.js';
import { TrackMetadataService } from './services/trackMetadataService.js';
import { DiscoveryService } from './services/discoveryService.js';
import { ChatService } from './services/chatService.js';
import { createIsrcDataLoader } from './loaders/isrcDataLoader.js';
import { createChatRoutes } from './routes/chatRoutes.js';
import { logger } from './utils/logger.js';
import { initializeDatabase, AppDataSource } from './config/database.js';
import { LibraryAlbum } from './entities/LibraryAlbum.js';
import { LibraryTrack } from './entities/LibraryTrack.js';
import { initializeOpenTelemetry } from './utils/otel.js';

// Load environment variables
config();

// Initialize OpenTelemetry for AI SDK observability (must be before any AI SDK calls)
initializeOpenTelemetry();

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load GraphQL schemas
const searchSchema = readFileSync(
  join(__dirname, 'schema', 'schema.graphql'),
  'utf-8'
);

const librarySchema = readFileSync(
  join(__dirname, 'schema', 'library.graphql'),
  'utf-8'
);

const trackMetadataSchema = readFileSync(
  join(__dirname, 'schema', 'trackMetadata.graphql'),
  'utf-8'
);

const discoverySchema = readFileSync(
  join(__dirname, 'schema', 'discovery.graphql'),
  'utf-8'
);

const chatSchema = readFileSync(
  join(__dirname, 'schema', 'chat.graphql'),
  'utf-8'
);

const typeDefs = [searchSchema, librarySchema, trackMetadataSchema, discoverySchema, chatSchema];

// Initialize services (these will be created fresh after DB initialization)
const cache = new CacheService(parseInt(process.env.SEARCH_CACHE_TTL || '3600'));
const tokenService = new TidalTokenService();
const tidalService = new TidalService(tokenService);

// Merge resolvers from search, library, track metadata, discovery, and chat
const mergedResolvers = {
  Query: {
    ...searchResolver.Query,
    ...libraryResolvers.Query,
    ...trackMetadataResolvers.Query,
    ...discoveryResolvers.Query,
    ...chatResolvers.Query,
  },
  Mutation: {
    ...libraryResolvers.Mutation,
    ...chatResolvers.Mutation,
  },
  AddAlbumToLibraryResult: libraryResolvers.AddAlbumToLibraryResult,
  AddTrackToLibraryResult: libraryResolvers.AddTrackToLibraryResult,
  LibraryAlbum: libraryResolvers.LibraryAlbum,
  LibraryTrack: {
    ...libraryResolvers.LibraryTrack,
    ...trackMetadataResolvers.LibraryTrack,
  },
  TrackInfo: trackMetadataResolvers.TrackInfo,
  DiscoverySearchResult: discoveryResolvers.DiscoverySearchResult,
  // Chat union types
  ConversationsResult: chatResolvers.ConversationsResult,
  ConversationResult: chatResolvers.ConversationResult,
  DeleteConversationResult: chatResolvers.DeleteConversationResult,
};

// Start server
const port = parseInt(process.env.PORT || '4000');

async function startServer() {
  try {
    // Initialize database connection
    await initializeDatabase();
    logger.info('database_initialized', { message: 'Database connection established' });

    // Initialize library service with repositories and ingestion scheduler
    const albumRepository = AppDataSource.getRepository(LibraryAlbum);
    const trackRepository = AppDataSource.getRepository(LibraryTrack);

    // Initialize Qdrant client and ingestion scheduler for automatic track ingestion
    const qdrantClient = createBackendQdrantClient();
    const ingestionScheduler = new IngestionScheduler(qdrantClient);
    logger.info('ingestion_scheduler_initialized', {
      qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
    });

    // Initialize track metadata service for extended metadata display
    const trackMetadataService = new TrackMetadataService(qdrantClient);
    logger.info('track_metadata_service_initialized');

    // Initialize discovery service for semantic search
    const discoveryService = new DiscoveryService({ qdrantClient });
    logger.info('discovery_service_initialized');

    // Initialize chat service
    const chatService = new ChatService(AppDataSource);
    logger.info('chat_service_initialized');

    const libraryService = new LibraryService(
      albumRepository,
      trackRepository,
      tidalService,
      ingestionScheduler
    );

    // Create Express app and HTTP server
    const app = express();
    const httpServer = http.createServer(app);

    // Create Apollo Server with drain plugin
    const server = new ApolloServer({
      typeDefs,
      resolvers: mergedResolvers,
      plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    });

    // Start Apollo Server
    await server.start();

    // Apply middleware
    app.use(cors());
    app.use(express.json());

    // Mount chat REST routes (for SSE streaming) with tool support
    app.use('/api/chat', createChatRoutes({
      dataSource: AppDataSource,
      discoveryService,
      trackMetadataService,
      tidalService,
      qdrantClient,
      libraryTrackRepository: trackRepository,
      libraryAlbumRepository: albumRepository,
    }));

    // Mount GraphQL endpoint
    app.use(
      '/graphql',
      expressMiddleware(server, {
        context: async () => ({
          tidalService,
          cache,
          libraryService,
          trackMetadataService,
          discoveryService,
          chatService,
          // Create a new DataLoader per request for proper batching and caching
          isrcDataLoader: createIsrcDataLoader(trackMetadataService),
          dataSources: {
            db: AppDataSource,
          },
        }),
      })
    );

    // Start listening
    await new Promise<void>((resolve) => httpServer.listen({ port }, resolve));

    const url = `http://localhost:${port}/graphql`;
    logger.info('server_started', { url });
    console.log(`🚀 Server ready at ${url}`);
    console.log(`📡 Chat SSE endpoint at http://localhost:${port}/api/chat/stream`);
  } catch (error) {
    logger.error('server_start_failed', { error: String(error) });
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
